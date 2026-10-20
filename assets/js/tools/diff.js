/* ==========================================================================
   Line-by-line text diff
   ChengYu · Lumen Toolkit
   ========================================================================== */
"use strict";

  /* ----------------------------------------------------------------------
     Line diff
     ---------------------------------------------------------------------- */
  /*
    按行比较，不做字符级 diff：
    1. 可选忽略大小写 / 首尾空白；
    2. 用最长公共子序列找回共同行；
    3. 其余行标成 added / removed；
    4. 只渲染行级结果，长文本也不会产生大量 DOM。

    输出使用 textContent，不把用户内容当 HTML 注入。
  */
  function initDiffTool() {
    const left = $("#diffLeft");
    const right = $("#diffRight");
    const output = $("#diffOutput");
    if (!left || !right || !output) return;
    const summary = $("#diffSummary");
    const outputStat = $("#diffOutputStat");
    const copyButton = $("#diffCopy");
    const ignoreCase = $("#diffIgnoreCase");
    const ignoreSpace = $("#diffIgnoreSpace");
    let lastDiff = "";
    const sampleLeft = "程宇工具箱\n所有处理都在浏览器完成\n支持 CSV 与 JSON\n支持文本对比\n谢谢你使用";
    const sampleRight = "程宇工具箱\n所有处理都在本地浏览器完成\n支持 CSV / JSON 双向转换\n支持文本对比\n新增 JWT 解码\n谢谢你使用";

    const lineOps = (a, b) => {
      const n = a.length;
      const m = b.length;
      const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
      for (let i = 1; i <= n; i += 1) {
        for (let j = 1; j <= m; j += 1) {
          dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
      const ops = [];
      let i = n;
      let j = m;
      while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
          ops.push({ type: "same", text: a[i - 1] });
          i -= 1;
          j -= 1;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
          ops.push({ type: "add", text: b[j - 1] });
          j -= 1;
        } else {
          ops.push({ type: "remove", text: a[i - 1] });
          i -= 1;
        }
      }
      return ops.reverse();
    };

    const renderEmpty = (message) => {
      output.replaceChildren();
      const empty = document.createElement("div");
      empty.className = "diff-empty";
      empty.textContent = message;
      output.appendChild(empty);
    };

    const compare = () => {
      const normalize = (line) => {
        let value = line;
        if (ignoreSpace?.checked) value = value.replace(/\s+/g, " ").trim();
        if (ignoreCase?.checked) value = value.toLocaleLowerCase();
        return value;
      };
      const a = left.value.replace(/\r\n/g, "\n").split("\n").map(normalize);
      const b = right.value.replace(/\r\n/g, "\n").split("\n").map(normalize);
      if (!left.value && !right.value) {
        renderEmpty("输入原文和修改后的文本，再开始对比。");
        if (summary) summary.textContent = "逐行比较";
        if (outputStat) outputStat.textContent = "等待对比";
        lastDiff = "";
        return;
      }
      if (a.length > 1000 || b.length > 1000) {
        renderEmpty("单边最多对比 1000 行，请拆分后再试。");
        if (summary) summary.textContent = "内容过长";
        if (outputStat) outputStat.textContent = "超出限制";
        lastDiff = "";
        return;
      }
      const ops = lineOps(a, b);
      let oldLine = 1;
      let newLine = 1;
      let added = 0;
      let removed = 0;
      let same = 0;
      const fragment = document.createDocumentFragment();
      const diffLines = [];
      ops.forEach((op) => {
        const row = document.createElement("div");
        row.className = `diff-row is-${op.type}`;
        const oldNo = document.createElement("span");
        oldNo.className = "diff-gutter";
        const newNo = document.createElement("span");
        newNo.className = "diff-gutter";
        const sign = document.createElement("span");
        sign.className = "diff-sign";
        const text = document.createElement("span");
        text.className = "diff-text";
        text.textContent = op.text;
        if (op.type === "same") {
          oldNo.textContent = String(oldLine++);
          newNo.textContent = String(newLine++);
          sign.textContent = " ";
          same += 1;
          diffLines.push(` ${op.text}`);
        } else if (op.type === "remove") {
          oldNo.textContent = String(oldLine++);
          sign.textContent = "−";
          removed += 1;
          diffLines.push(`-${op.text}`);
        } else {
          newNo.textContent = String(newLine++);
          sign.textContent = "+";
          added += 1;
          diffLines.push(`+${op.text}`);
        }
        row.append(oldNo, newNo, sign, text);
        fragment.appendChild(row);
      });
      output.replaceChildren(fragment);
      const statsText = `新增 ${added} 行 · 删除 ${removed} 行 · 相同 ${same} 行`;
      if (summary) summary.textContent = statsText;
      if (outputStat) outputStat.textContent = statsText;
      lastDiff = diffLines.join("\n");
    };

    $("#diffRun")?.addEventListener("click", compare);
    $("#diffSwap")?.addEventListener("click", () => {
      [left.value, right.value] = [right.value, left.value];
      compare();
    });
    $("#diffClear")?.addEventListener("click", () => {
      left.value = "";
      right.value = "";
      compare();
      left.focus();
    });
    copyButton?.addEventListener("click", () => {
      if (!lastDiff) return toast("还没有可复制的差异", { type: "info" });
      copyText(lastDiff, "差异内容已复制");
    });
    [left, right].forEach((textarea) => {
      textarea.addEventListener("keydown", (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
          event.preventDefault();
          compare();
        }
      });
    });
    ignoreCase?.addEventListener("change", compare);
    ignoreSpace?.addEventListener("change", compare);
    left.value = sampleLeft;
    right.value = sampleRight;
    compare();
  }

