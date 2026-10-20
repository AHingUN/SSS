/* ==========================================================================
   Regular expression tester
   ChengYu · Lumen Toolkit
   ========================================================================== */
"use strict";

  /* ----------------------------------------------------------------------
     Regular expression tester
     ---------------------------------------------------------------------- */
  function initRegexTool() {
    const patternInput = $("#regexPattern");
    const textInput = $("#regexText");
    const flagsBox = $("#regexFlags");
    const status = $("#regexStatus");
    const statusText = $("#regexStatusText");
    const timeLabel = $("#regexTime");
    const charCount = $("#regexCharCount");
    const matchCount = $("#regexMatchCount");
    const highlight = $("#regexHighlight");
    const matchesList = $("#regexMatches");
    const copyButton = $("#regexCopy");
    const replacementInput = $("#regexReplacement");
    const replaceOutput = $("#regexReplaceOutput");
    const replaceCopy = $("#regexReplaceCopy");
    if (!patternInput || !textInput || !highlight || !matchesList) return null;

    patternInput.maxLength = 500;
    textInput.maxLength = 60000;
    patternInput.value = "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}";
    textInput.value =
      "联系邮箱：hello@lumen.tools\n协作邮箱：team@example.com\n订单号：LM-2026-1018\n备用邮箱：design@studio.dev";

    let currentMatches = [];
    let matchingRegex = null;

    function selectedFlags() {
      return $$('input[type="checkbox"]', flagsBox)
        .filter((input) => input.checked)
        .map((input) => input.value)
        .join("");
    }

    function setStatus(message, state = "idle") {
      status.dataset.state = state;
      statusText.textContent = message;
    }

    function renderNoResults(message) {
      highlight.innerHTML = `<span class="regex-placeholder">${message}</span>`;
      matchesList.innerHTML = "";
      currentMatches = [];
      copyButton.disabled = true;
      updateReplacement();
    }

    function scheduleRender() {
      window.clearTimeout(matchTimer);
      matchTimer = window.setTimeout(runRegex, 130);
    }

    let matchTimer = 0;

    function runRegex() {
      const pattern = patternInput.value;
      const text = textInput.value;
      charCount.textContent = `${text.length} 字符`;
      timeLabel.textContent = "";

      if (!pattern) {
        matchingRegex = null;
        setStatus("输入正则表达式后开始匹配", "idle");
        matchCount.textContent = "0 处";
        renderNoResults("等待输入正则表达式");
        return;
      }

      if (!text) {
        matchingRegex = null;
        setStatus("正则有效 · 等待测试文本", "valid");
        matchCount.textContent = "0 处";
        renderNoResults("在左侧输入测试文本");
        return;
      }

      const flags = selectedFlags();
      let regex;
      try {
        regex = new RegExp(pattern, flags);
      } catch (error) {
        matchingRegex = null;
        setStatus("正则语法有误，请检查", "error");
        matchCount.textContent = "—";
        renderNoResults("修正表达式后即可重新匹配");
        return;
      }

      matchingRegex = regex;
      const started = performance.now();
      const found = [];
      let match;
      let guard = 0;

      if (flags.includes("g")) {
        while ((match = regex.exec(text)) !== null) {
          found.push({
            index: match.index,
            value: match[0],
            groups: match.slice(1),
          });
          if (match[0].length === 0) regex.lastIndex += 1;
          guard += 1;
          if (found.length >= 500 || guard > 5000) break;
        }
      } else {
        match = regex.exec(text);
        if (match) {
          found.push({ index: match.index, value: match[0], groups: match.slice(1) });
        }
      }

      const elapsed = performance.now() - started;
      currentMatches = found;
      timeLabel.textContent = `${elapsed.toFixed(2)} ms`;
      setStatus(found.length ? "匹配成功" : "没有匹配结果", "valid");
      matchCount.textContent = found.length >= 500 ? "500+" : `${found.length} 处`;
      copyButton.disabled = found.length === 0;
      updateReplacement();

      highlight.innerHTML = "";
      highlight.appendChild(document.createTextNode(text));
      if (found.length) {
        const fragment = document.createDocumentFragment();
        let cursor = 0;
        found.forEach((item) => {
          if (!item.value.length) return;
          if (item.index > cursor) {
            fragment.appendChild(document.createTextNode(text.slice(cursor, item.index)));
          }
          const mark = document.createElement("mark");
          mark.className = "regex-hit";
          mark.textContent = item.value;
          fragment.appendChild(mark);
          cursor = item.index + item.value.length;
        });
        if (cursor < text.length) {
          fragment.appendChild(document.createTextNode(text.slice(cursor)));
        }
        highlight.replaceChildren(fragment);
      }

      matchesList.innerHTML = "";
      if (!found.length) {
        const empty = document.createElement("p");
        empty.className = "regex-empty";
        empty.textContent = "没有找到匹配项，换个表达式试试。";
        matchesList.appendChild(empty);
        return;
      }

      const fragment = document.createDocumentFragment();
      found.slice(0, 40).forEach((item, index) => {
        const row = document.createElement("div");
        row.className = "regex-match-row";
        const number = document.createElement("span");
        number.className = "regex-match-index";
        number.textContent = String(index + 1).padStart(2, "0");
        const value = document.createElement("code");
        value.className = "regex-match-value";
        value.textContent = item.value || "（空）";
        row.append(number, value);
        const groups = item.groups.filter((group) => group !== undefined);
        if (groups.length) {
          const groupList = document.createElement("span");
          groupList.className = "regex-groups";
          groupList.textContent = groups.map((group, groupIndex) => `组 ${groupIndex + 1}: ${group}`).join(" · ");
          row.appendChild(groupList);
        }
        fragment.appendChild(row);
      });
      matchesList.appendChild(fragment);
      if (found.length > 40) {
        const note = document.createElement("p");
        note.className = "regex-empty";
        note.textContent = `仅显示前 40 条，共 ${found.length} 条匹配。`;
        matchesList.appendChild(note);
      }
      animateStagger(matchesList, ".regex-match-row", { limit: 8, distance: 4, duration: 260 });
    }

    function updateReplacement() {
      if (!replaceOutput) return;
      if (!matchingRegex || !currentMatches.length) {
        replaceOutput.textContent = "";
        if (replaceCopy) replaceCopy.disabled = true;
        return;
      }
      try {
        replaceOutput.textContent = textInput.value.replace(
          matchingRegex,
          replacementInput?.value || ""
        );
        if (replaceCopy) replaceCopy.disabled = false;
      } catch (error) {
        replaceOutput.textContent = "替换表达式有误";
        if (replaceCopy) replaceCopy.disabled = true;
      }
    }

    patternInput.addEventListener("input", scheduleRender);
    textInput.addEventListener("input", () => {
      charCount.textContent = `${textInput.value.length} 字符`;
      scheduleRender();
    });
    $$('input[type="checkbox"]', flagsBox).forEach((input) => {
      input.addEventListener("change", () => {
        window.clearTimeout(matchTimer);
        runRegex();
      });
    });
    copyButton.addEventListener("click", () => {
      const values = currentMatches.map((match) => match.value);
      if (!values.length) {
        toast("还没有可复制的匹配结果", { type: "info" });
        return;
      }
      copyText(values.join("\n"), `已复制 ${values.length} 条匹配`);
    });
    replacementInput?.addEventListener("input", updateReplacement);
    replaceCopy?.addEventListener("click", () => {
      if (!replaceOutput?.textContent) return;
      copyText(replaceOutput.textContent, "替换结果已复制");
    });

    if (charCount) charCount.textContent = `${textInput.value.length} 字符`;
    runRegex();
    return () => window.clearTimeout(matchTimer);
  }

