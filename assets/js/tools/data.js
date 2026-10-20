/* ==========================================================================
   Data studio: XML formatting, Gzip compression and base conversion
   ChengYu · Lumen Toolkit
   ========================================================================== */
"use strict";

function initDataTool() {
  const tabs = $$("#dataTabs [data-studio-tab]");
  const panes = $$(".studio-pane", $("#dataTabs")?.closest(".studio-panel"));
  if (!tabs.length || !panes.length) return;
  const activate = (id) => {
    tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.studioTab === id));
    panes.forEach((pane) => {
      const active = pane.dataset.studioPane === id;
      pane.hidden = !active;
      pane.classList.toggle("is-active", active);
    });
  };
  tabs.forEach((tab) => tab.addEventListener("click", () => activate(tab.dataset.studioTab)));

  const xmlInput = $("#xmlInput");
  const xmlOutput = $("#xmlOutput");
  const xmlStatus = $("#xmlStatus");
  const xmlFormat = () => {
    if (!xmlInput || !xmlOutput) return;
    const text = xmlInput.value.trim();
    if (!text) {
      xmlOutput.textContent = "";
      if (xmlStatus) xmlStatus.textContent = "等待输入";
      return;
    }
    const documentNode = new DOMParser().parseFromString(text, "application/xml");
    if (documentNode.querySelector("parsererror")) {
      xmlOutput.textContent = "";
      if (xmlStatus) xmlStatus.textContent = "XML 语法错误，请检查标签闭合";
      return;
    }
    const serialize = (node, depth = 0) => {
      const indent = "  ".repeat(depth);
      if (node.nodeType === Node.TEXT_NODE) {
        const value = node.nodeValue.trim();
        return value ? `${indent}${escapeHTML(value)}` : "";
      }
      if (node.nodeType === Node.COMMENT_NODE) return `${indent}<!--${node.nodeValue}-->`;
      if (node.nodeType !== Node.ELEMENT_NODE) return "";
      const attributes = [...node.attributes]
        .map((attribute) => ` ${attribute.name}="${escapeAttribute(attribute.value)}"`)
        .join("");
      const children = [...node.childNodes].filter((child) =>
        child.nodeType === Node.ELEMENT_NODE ||
        (child.nodeType === Node.TEXT_NODE && child.nodeValue.trim()) ||
        child.nodeType === Node.COMMENT_NODE
      );
      if (!children.length) return `${indent}<${node.nodeName}${attributes} />`;
      if (children.length === 1 && children[0].nodeType === Node.TEXT_NODE) {
        return `${indent}<${node.nodeName}${attributes}>${escapeHTML(children[0].nodeValue.trim())}</${node.nodeName}>`;
      }
      const inner = children.map((child) => serialize(child, depth + 1)).filter(Boolean).join("\n");
      return `${indent}<${node.nodeName}${attributes}>\n${inner}\n${indent}</${node.nodeName}>`;
    };
    xmlOutput.textContent = serialize(documentNode.documentElement);
    if (xmlStatus) xmlStatus.textContent = "XML 已格式化";
  };
  xmlFormat && xmlFormat();
  $("#xmlFormat")?.addEventListener("click", xmlFormat);
  $("#xmlToJson")?.addEventListener("click", () => {
    if (!xmlInput || !xmlOutput) return;
    const text = xmlInput.value.trim();
    if (!text) return;
    const documentNode = new DOMParser().parseFromString(text, "application/xml");
    if (documentNode.querySelector("parsererror")) {
      if (xmlStatus) xmlStatus.textContent = "XML 语法错误，无法转换";
      return;
    }
    const nodeValue = (node) => {
      const attributes = {};
      Array.from(node.attributes || []).forEach((attribute) => {
        attributes[`@${attribute.name}`] = attribute.value;
      });
      const children = Array.from(node.children || []);
      if (!children.length) {
        const content = node.textContent.trim();
        if (Object.keys(attributes).length) {
          return content ? { ...attributes, "#text": content } : attributes;
        }
        return content;
      }
      const result = { ...attributes };
      children.forEach((child) => {
        const value = nodeValue(child);
        if (Object.prototype.hasOwnProperty.call(result, child.nodeName)) {
          if (!Array.isArray(result[child.nodeName])) result[child.nodeName] = [result[child.nodeName]];
          result[child.nodeName].push(value);
        } else {
          result[child.nodeName] = value;
        }
      });
      return result;
    };
    const root = documentNode.documentElement;
    xmlOutput.textContent = JSON.stringify({ [root.nodeName]: nodeValue(root) }, null, 2);
    if (xmlStatus) xmlStatus.textContent = "已转为 JSON";
  });
  $("#xmlCopy")?.addEventListener("click", () => {
    if (xmlOutput?.textContent) copyText(xmlOutput.textContent, "XML 已复制");
  });
  xmlInput?.addEventListener("input", () => {
    if (xmlStatus) xmlStatus.textContent = "等待格式化";
  });

  const gzipInput = $("#gzipInput");
  const gzipStatus = $("#gzipStatus");
  const gzipOutput = $("#gzipOutput");
  const setGzipStatus = (text) => {
    if (gzipStatus) gzipStatus.textContent = text;
  };
  const gzipFallback = () => {
    toast("当前浏览器不支持 CompressionStream", { type: "info" });
    setGzipStatus("浏览器不支持 Gzip");
  };
  $("#gzipCompress")?.addEventListener("click", async () => {
    if (typeof CompressionStream === "undefined") return gzipFallback();
    const text = gzipInput?.value || "";
    try {
      const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
      const blob = await new Response(stream).blob();
      downloadBlob(blob, "lumen-text.gz");
      setGzipStatus(`已压缩 ${(blob.size / 1024).toFixed(1)} KB`);
      if (gzipOutput) gzipOutput.textContent = `原始 ${new Blob([text]).size} B\n压缩后 ${blob.size} B\n已下载 lumen-text.gz`;
    } catch (error) {
      setGzipStatus("压缩失败");
    }
  });
  $("#gzipFile")?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (typeof DecompressionStream === "undefined") return gzipFallback();
    try {
      const stream = file.stream().pipeThrough(new DecompressionStream("gzip"));
      const text = await new Response(stream).text();
      if (gzipOutput) gzipOutput.textContent = text.slice(0, 20000);
      setGzipStatus(`已解压 ${(file.size / 1024).toFixed(1)} KB`);
      if (gzipInput) gzipInput.value = text;
    } catch (error) {
      setGzipStatus("解压失败，请确认是 .gz 文件");
    }
    event.target.value = "";
  });

  const baseInput = $("#baseInput");
  const baseFrom = $("#baseFrom");
  const baseStatus = $("#baseStatus");
  const baseResults = $("#baseResults");
  const convertBase = () => {
    if (!baseResults) return;
    const raw = baseInput?.value.trim().replace(/^0x/i, "") || "";
    const radix = Number(baseFrom?.value || 10);
    const patterns = { 2: /^[01]+$/, 8: /^[0-7]+$/, 10: /^[0-9]+$/, 16: /^[0-9a-f]+$/i };
    if (!raw || !patterns[radix]?.test(raw)) {
      baseResults.replaceChildren();
      if (baseStatus) baseStatus.textContent = "请输入当前进制下的有效数字";
      return;
    }
    const value = Number.parseInt(raw, radix);
    if (!Number.isSafeInteger(value)) {
      if (baseStatus) baseStatus.textContent = "数值超出安全整数范围";
      return;
    }
    const rows = [
      ["二进制", value.toString(2)],
      ["八进制", value.toString(8)],
      ["十进制", value.toString(10)],
      ["十六进制", value.toString(16).toUpperCase()],
    ];
    baseResults.replaceChildren();
    rows.forEach(([label, output]) => {
      const button = document.createElement("button");
      button.className = "base-result";
      button.type = "button";
      const key = document.createElement("span");
      key.textContent = label;
      const code = document.createElement("strong");
      code.textContent = output;
      button.append(key, code);
      button.addEventListener("click", () => copyText(output, `${label}已复制`));
      baseResults.appendChild(button);
    });
    if (baseStatus) baseStatus.textContent = "点击结果即可复制";
  };
  $("#baseConvert")?.addEventListener("click", convertBase);
  baseInput?.addEventListener("input", convertBase);
  baseFrom?.addEventListener("change", convertBase);
  convertBase();
}
