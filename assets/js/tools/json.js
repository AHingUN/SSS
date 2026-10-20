/* ==========================================================================
   JSON workspace
   ChengYu · Lumen Toolkit
   ========================================================================== */
"use strict";

  /* ----------------------------------------------------------------------
     JSON tool
     ---------------------------------------------------------------------- */
  /*
    处理链：parse → 操作（格式化 / 压缩 / 排序）/ 错误定位 → 输出。
    解析失败时尽量把错误信息的 position 转成“第几行第几列”，显示在错误条中。
    输出只写 textContent / value，不把 JSON 直接当 HTML 插入；语法高亮
    会先 escapeHTML，再包 token，避免粘贴内容被解释成标签。
  */
  function initJsonTool() {
    const input = $("#jsonInput");
    const output = $("#jsonOutput");
    const status = $("#jsonStatus");
    const errorBox = $("#jsonError");
    const statLine = $("#jsonStatLine");
    const statSize = $("#jsonStatSize");
    const copyButton = $("#jsonCopy");
    const downloadButton = $("#jsonDownload");
    const sortButton = $("#jsonSort");
    if (!input || !output || !status) return null;

    input.maxLength = 1000000;
    let sortKeys = false;

    const sample = JSON.stringify(
      {
        name: "程宇工具箱",
        version: "1.0.0",
        local: true,
        tools: ["JSON", "二维码", "颜色实验室"],
        privacy: { uploads: 0, tracking: false },
        motto: "日常小事，一气呵成。",
      },
      null,
      2
    );

    let validSerialized = sample;
    let debounceTimer = 0;

    function setStatus(text, state = "valid") {
      status.className = `status-pill ${state === "invalid" ? "is-invalid" : "is-valid"}`;
      status.innerHTML = `<span class="status-dot"></span>${text}`;
    }

    function highlightJson(source) {
      const safe = source
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return safe.replace(
        /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"\s*:)|("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*")|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g,
        (match, key, string, literal) => {
          if (key) return `<span class="tok-key">${match}</span>`;
          if (string) return `<span class="tok-string">${match}</span>`;
          if (literal === "null") return `<span class="tok-null">${match}</span>`;
          if (literal) return `<span class="tok-boolean">${match}</span>`;
          return `<span class="tok-number">${match}</span>`;
        }
      );
    }

    function paintOutput(serialized) {
      validSerialized = serialized;
      output.innerHTML = highlightJson(serialized);
      const lineCount = serialized ? serialized.split("\n").length : 0;
      const bytes = new TextEncoder().encode(serialized).length;
      if (statLine) statLine.textContent = `${lineCount} 行`;
      if (statSize) statSize.textContent = formatBytes(bytes);
      setOutputAvailable(Boolean(serialized));
    }

    function setOutputAvailable(available) {
      if (copyButton) copyButton.disabled = !available;
      if (downloadButton) downloadButton.disabled = !available;
    }

    function clearOutput() {
      validSerialized = "";
      output.innerHTML = "";
      if (statLine) statLine.textContent = "0 行";
      if (statSize) statSize.textContent = "0 B";
      setOutputAvailable(false);
    }

    function sortValue(value) {
      if (Array.isArray(value)) return value.map(sortValue);
      if (!value || typeof value !== "object") return value;
      const sorted = {};
      Object.keys(value)
        .sort((a, b) => a.localeCompare(b))
        .forEach((key) => {
          Object.defineProperty(sorted, key, {
            value: sortValue(value[key]),
            enumerable: true,
            configurable: true,
            writable: true,
          });
        });
      return sorted;
    }

    function describeError(error, raw) {
      const message = String(error.message || "");
      let line = null;
      let column = null;
      const lineMatch = message.match(/line\s+(\d+)\s+column\s+(\d+)/i);
      const positionMatch = message.match(/position\s+(\d+)/i);
      if (lineMatch) {
        line = Number(lineMatch[1]);
        column = Number(lineMatch[2]);
      } else if (positionMatch) {
        const position = Number(positionMatch[1]);
        const before = raw.slice(0, position).split(/\r\n|\n|\r/);
        line = before.length;
        column = before[before.length - 1].length + 1;
      }
      errorBox.title = message;
      return line
        ? `第 ${line} 行 · 第 ${column} 列附近有语法错误`
        : "JSON 语法有错误，请检查括号、引号或逗号";
    }

    function parseInput({ minify = false, notify = false } = {}) {
      const raw = input.value.trim();
      if (!raw) {
        clearOutput();
        errorBox.hidden = true;
        setStatus("就绪");
        return;
      }

      try {
        const parsed = JSON.parse(raw);
        const value = sortKeys ? sortValue(parsed) : parsed;
        const serialized = minify
          ? JSON.stringify(value)
          : JSON.stringify(value, null, 2);
        paintOutput(serialized);
        errorBox.hidden = true;
        setStatus(minify ? "已压缩" : "有效");
        if (notify) toast(minify ? "已压缩 JSON" : "已格式化 JSON");
      } catch (error) {
        clearOutput();
        setStatus("语法错误", "invalid");
        errorBox.textContent = describeError(error, raw);
        errorBox.hidden = false;
      }
    }

    function scheduleParse() {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => parseInput(), 170);
    }

    input.addEventListener("input", scheduleParse);
    input.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        window.clearTimeout(debounceTimer);
        parseInput({ notify: true });
      }
    });

    $("#jsonFormat")?.addEventListener("click", () => {
      window.clearTimeout(debounceTimer);
      parseInput({ notify: true });
    });

    $("#jsonMinify")?.addEventListener("click", () => {
      window.clearTimeout(debounceTimer);
      parseInput({ minify: true, notify: true });
    });

    $("#jsonTypescript")?.addEventListener("click", () => {
      const raw = input.value.trim();
      if (!raw) return toast("先输入 JSON 再生成类型", { type: "info" });
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        toast("JSON 语法有误，暂时无法生成类型", { type: "info" });
        return;
      }
      const safeKey = (key) => (/^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key));
      const typeOf = (value, depth = 0) => {
        if (depth > 8) return "unknown";
        if (value === null) return "null";
        if (Array.isArray(value)) {
          if (!value.length) return "unknown[]";
          const types = [...new Set(value.map((item) => typeOf(item, depth + 1)))];
          return types.length === 1 ? `${types[0]}[]` : `Array<${types.join(" | ")}>`;
        }
        if (typeof value === "object") {
          const entries = Object.entries(value);
          if (!entries.length) return "Record<string, unknown>";
          const indent = "  ".repeat(depth + 1);
          const close = "  ".repeat(depth);
          return `{\n${entries
            .map(([key, item]) => `${indent}${safeKey(key)}: ${typeOf(item, depth + 1)};`)
            .join("\n")}\n${close}}`;
        }
        return typeof value;
      };
      const source = `// Generated from JSON · 程宇\nexport type JsonRoot = ${typeOf(parsed)};\n`;
      copyText(source, "TypeScript 类型已复制");
    });

    $("#jsonYaml")?.addEventListener("click", () => {
      const raw = input.value.trim();
      if (!raw) return toast("先输入 JSON 再转换 YAML", { type: "info" });
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        toast("JSON 语法有误，暂时无法转换 YAML", { type: "info" });
        return;
      }
      const yamlKey = (key) =>
        /^[A-Za-z_][\w-]*$/.test(key) && !/^(true|false|null|yes|no|on|off)$/i.test(key)
          ? key
          : JSON.stringify(key);
      const yamlScalar = (value) => {
        if (value === null) return "null";
        if (typeof value === "number" || typeof value === "boolean") return String(value);
        const text = String(value);
        if (/^[A-Za-z0-9_./-]+$/.test(text) && !/^(true|false|null|yes|no|on|off)$/i.test(text)) {
          return text;
        }
        return JSON.stringify(text);
      };
      const yamlNode = (value, depth = 0) => {
        const pad = "  ".repeat(depth);
        if (Array.isArray(value)) {
          if (!value.length) return "[]";
          return value
            .map((item) => {
              if (item && typeof item === "object") {
                const child = yamlNode(item, depth + 1);
                return `${pad}- ${child.trimStart()}`;
              }
              return `${pad}- ${yamlScalar(item)}`;
            })
            .join("\n");
        }
        if (value && typeof value === "object") {
          const entries = Object.entries(value);
          if (!entries.length) return "{}";
          return entries
            .map(([key, item]) => {
              const head = `${pad}${yamlKey(key)}:`;
              if (item && typeof item === "object") {
                if (Array.isArray(item) && !item.length) return `${head} []`;
                if (!Array.isArray(item) && !Object.keys(item).length) return `${head} {}`;
                return `${head}\n${yamlNode(item, depth + 1)}`;
              }
              return `${head} ${yamlScalar(item)}`;
            })
            .join("\n");
        }
        return `${pad}${yamlScalar(value)}`;
      };
      const source = `# Generated from JSON · 程宇\n${yamlNode(parsed)}\n`;
      copyText(source, "YAML 已复制");
    });

    $("#jsonSample")?.addEventListener("click", () => {
      input.value = sample;
      parseInput();
      toast("已填入示例 JSON");
    });

    sortButton?.addEventListener("click", () => {
      sortKeys = !sortKeys;
      sortButton.classList.toggle("is-active", sortKeys);
      sortButton.setAttribute("aria-pressed", String(sortKeys));
      window.clearTimeout(debounceTimer);
      parseInput();
      toast(sortKeys ? "输出已按对象键排序" : "已关闭键排序", { type: "info" });
    });

    $("#jsonClear")?.addEventListener("click", () => {
      input.value = "";
      parseInput();
      input.focus();
    });

    $("#jsonCopy")?.addEventListener("click", () => {
      if (!validSerialized) {
        toast("还没有可复制的结果", { type: "info" });
        return;
      }
      copyText(validSerialized, "已复制格式化结果");
    });

    $("#jsonDownload")?.addEventListener("click", () => {
      if (!validSerialized) {
        toast("还没有可下载的内容", { type: "info" });
        return;
      }
      downloadText(validSerialized, "lumen-formatted.json", "application/json;charset=utf-8");
      toast("JSON 已下载");
    });

    input.value = sample;
    parseInput();
    input.style.height = "";

    return () => window.clearTimeout(debounceTimer);
  }

