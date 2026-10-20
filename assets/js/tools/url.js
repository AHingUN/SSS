/* ==========================================================================
   URL parser and query editor
   ChengYu · Lumen Toolkit
   ========================================================================== */
"use strict";

  /* ----------------------------------------------------------------------
     URL parser / query editor
     ---------------------------------------------------------------------- */
  function initUrlTool() {
    const input = $("#urlInput");
    const status = $("#urlStatus");
    const statusText = $("#urlStatusText");
    const openButton = $("#urlOpen");
    const copyButton = $("#urlCopy");
    const markdownButton = $("#urlMarkdown");
    const preview = $("#urlPreview");
    const schemePill = $("#urlSchemePill");
    const paramList = $("#urlParamList");
    const queryCount = $("#urlQueryCount");
    const addButton = $("#urlAddParam");
    const inputLine = input?.closest(".url-input-line");
    const fields = {
      scheme: $("#urlScheme"),
      host: $("#urlHost"),
      port: $("#urlPort"),
      path: $("#urlPath"),
      hash: $("#urlHash"),
      origin: $("#urlOrigin"),
    };
    if (!input || !paramList || !preview) return null;

    input.maxLength = 8192;
    const MAX_PARAMS = 100;

    const sample =
      "https://example.com/products/aurora?utm_source=newsletter&color=blue&size=large&ref=home#details";
    const trackingKeys = new Set([
      "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
      "utm_id", "utm_name", "utm_reader", "utm_referrer", "fbclid", "gclid",
      "dclid", "msclkid", "mc_cid", "mc_eid", "igshid", "ref_src", "_ga",
    ]);

    let parsed = null;
    let params = [];
    let finalUrl = "";
    let parseTimer = 0;

    function setStatus(message, state = "idle") {
      status.dataset.state = state;
      statusText.textContent = message;
      inputLine?.classList.toggle("is-invalid", state === "error");
    }

    function setActionsEnabled(enabled) {
      openButton.disabled = !enabled;
      copyButton.disabled = !enabled;
      if (markdownButton) markdownButton.disabled = !enabled;
      addButton.disabled = !enabled;
    }

    function clearDetails(message = "粘贴网址后会自动解析") {
      parsed = null;
      finalUrl = "";
      params = [];
      Object.values(fields).forEach((field) => {
        if (field) field.textContent = "—";
      });
      if (schemePill) schemePill.textContent = "—";
      preview.textContent = "—";
      if (queryCount) queryCount.textContent = "0 项";
      paramList.innerHTML = '<p class="url-param-empty">输入一个有效网址后，这里会列出查询参数。</p>';
      setActionsEnabled(false);
      setStatus(message, message === "粘贴网址后会自动解析" ? "idle" : "error");
    }

    function updatePreview() {
      if (!parsed) return;
      const target = new URL(parsed.href);
      target.search = "";
      params.forEach((param) => {
        const key = param.key.trim();
        if (!key) return;
        target.searchParams.append(key, param.value);
      });
      finalUrl = target.href;
      preview.textContent = finalUrl;
      const activeCount = params.filter((param) => param.key.trim()).length;
      if (queryCount) queryCount.textContent = `${activeCount} 项`;
      setActionsEnabled(Boolean(finalUrl));
    }

    function createParamRow(param, index) {
      const row = document.createElement("div");
      row.className = "url-param-row";

      const keyInput = document.createElement("input");
      keyInput.className = "url-param-key";
      keyInput.type = "text";
      keyInput.value = param.key;
      keyInput.placeholder = "参数名";
      keyInput.spellcheck = false;
      keyInput.setAttribute("aria-label", `第 ${index + 1} 个参数名`);

      const valueInput = document.createElement("input");
      valueInput.className = "url-param-value";
      valueInput.type = "text";
      valueInput.value = param.value;
      valueInput.placeholder = "参数值";
      valueInput.spellcheck = false;
      valueInput.setAttribute("aria-label", `第 ${index + 1} 个参数值`);

      const removeButton = document.createElement("button");
      removeButton.className = "url-param-remove";
      removeButton.type = "button";
      removeButton.setAttribute("aria-label", `删除参数 ${param.key || index + 1}`);
      removeButton.innerHTML = icon("x");

      keyInput.addEventListener("input", () => {
        param.key = keyInput.value;
        updatePreview();
      });
      valueInput.addEventListener("input", () => {
        param.value = valueInput.value;
        updatePreview();
      });
      keyInput.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        addParam();
      });
      valueInput.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        addParam();
      });
      removeButton.addEventListener("click", () => {
        const at = params.indexOf(param);
        if (at >= 0) params.splice(at, 1);
        renderParams();
        updatePreview();
      });

      row.append(keyInput, valueInput, removeButton);
      return row;
    }

    function renderParams(focusIndex = -1) {
      paramList.innerHTML = "";
      if (!params.length) {
        paramList.innerHTML = '<p class="url-param-empty">这个网址没有查询参数，点下方按钮添加。</p>';
      } else {
        const fragment = document.createDocumentFragment();
        params.forEach((param, index) => {
          fragment.appendChild(createParamRow(param, index));
        });
        paramList.appendChild(fragment);
      }
      if (focusIndex >= 0) {
        paramList.querySelectorAll(".url-param-key")[focusIndex]?.focus();
      }
      updatePreview();
    }

    function addParam() {
      if (!parsed) return;
      if (params.length >= MAX_PARAMS) {
        toast(`最多支持 ${MAX_PARAMS} 个查询参数`, { type: "info" });
        return;
      }
      params.push({ key: "", value: "" });
      renderParams(params.length - 1);
    }

    function parseInput() {
      const raw = input.value.trim();
      if (!raw) {
        clearDetails();
        return;
      }

      let candidate = raw;
      const prefixed = !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(candidate);
      if (prefixed) candidate = `https://${candidate}`;

      let next;
      try {
        next = new URL(candidate);
        if (!/^https?:$/.test(next.protocol) || !next.hostname) throw new Error("Invalid URL");
      } catch (error) {
        clearDetails("这不像是有效的 http(s) 网址");
        return;
      }

      parsed = next;
      params = [];
      next.searchParams.forEach((value, key) => {
        params.push({ key, value });
      });

      const displayPath = next.pathname || "/";
      if (fields.scheme) fields.scheme.textContent = next.protocol;
      if (fields.host) fields.host.textContent = next.hostname || "—";
      if (fields.port) fields.port.textContent = next.port || "默认";
      if (fields.path) fields.path.textContent = displayPath;
      if (fields.hash) fields.hash.textContent = next.hash || "无";
      if (fields.origin) fields.origin.textContent = next.origin;
      if (schemePill) schemePill.textContent = next.protocol.replace(":", "").toUpperCase();
      setActionsEnabled(true);
      renderParams();
      setStatus(prefixed ? "已自动补全 https:// · 解析完成" : "网址有效 · 所有解析都在本地完成", "valid");
    }

    function scheduleParse() {
      window.clearTimeout(parseTimer);
      parseTimer = window.setTimeout(parseInput, 120);
    }

    input.addEventListener("input", scheduleParse);
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      window.clearTimeout(parseTimer);
      parseInput();
    });

    $("#urlExample")?.addEventListener("click", () => {
      input.value = sample;
      parseInput();
      input.focus();
    });

    openButton.addEventListener("click", () => {
      if (!finalUrl) return;
      window.open(finalUrl, "_blank", "noopener,noreferrer");
    });

    copyButton.addEventListener("click", () => {
      copyText(finalUrl, "整理后的链接已复制");
    });
    markdownButton?.addEventListener("click", () => {
      if (!finalUrl) return;
      let label = "链接";
      try {
        label = new URL(finalUrl).hostname.replace(/^www\./i, "") || label;
      } catch (error) {
        // Keep the generic label.
      }
      copyText(`[${label}](${finalUrl})`, "Markdown 链接已复制");
    });

    addButton.addEventListener("click", addParam);

    $("#urlCleanTracking")?.addEventListener("click", () => {
      if (!params.length) return;
      const before = params.length;
      params = params.filter((param) => {
        const key = param.key.toLowerCase();
        return !(key.startsWith("utm_") || trackingKeys.has(key));
      });
      if (before === params.length) {
        toast("没有发现常见的跟踪参数", { type: "info" });
        return;
      }
      renderParams();
      toast(`已清理 ${before - params.length} 个跟踪参数`);
    });

    $("#urlSortParams")?.addEventListener("click", () => {
      if (!params.length) return;
      params.sort((a, b) => a.key.localeCompare(b.key) || a.value.localeCompare(b.value));
      renderParams();
      toast("参数已按名称排序");
    });

    $("#urlClearParams")?.addEventListener("click", () => {
      if (!params.length) return;
      params = [];
      renderParams();
      toast("已清空查询参数", { type: "info" });
    });

    input.value = sample;
    parseInput();

    return () => window.clearTimeout(parseTimer);
  }

