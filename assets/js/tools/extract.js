/* ==========================================================================
   Link extractor
   ChengYu · Lumen Toolkit
   ========================================================================== */
"use strict";

  /* ----------------------------------------------------------------------
     Link extractor
     ---------------------------------------------------------------------- */
  function initExtractTool() {
    const input = $("#extractInput");
    const list = $("#extractList");
    const count = $("#extractCount");
    const inputCount = $("#extractInputCount");
    const dedupe = $("#extractDedupe");
    const filterInput = $("#extractFilter");
    const copyAll = $("#extractCopyAll");
    const downloadAll = $("#extractDownload");
    const domainsButton = $("#extractDomains");
    const note = $("#extractNote");
    if (!input || !list) return null;

    input.maxLength = 200000;
    const sample =
      '<a href="https://www.apple.com/cn/">Apple 中国</a>\n' +
      "灵感与文档：https://developer.mozilla.org/zh-CN/docs/Web\n" +
      "浏览器特性查询 https://caniuse.com/?search=view-transition\n" +
      "图片压缩工具：https://squoosh.app/\n" +
      "带参数的示例：https://example.com/article?utm_source=newsletter&id=42\n" +
      "重复一次：https://developer.mozilla.org/zh-CN/docs/Web";

    const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>"'\u0060]+/gi;
    const TRAILING_PUNCTUATION = /[),.;:!?，。；：！？）】》」』"'\u0060]+$/;
    const MAX_RESULTS = 200;

    let allLinks = [];
    let limitHit = false;

    const scheduledExtract = debounce(extractLinks, 170);
    const scheduledRender = debounce(renderResults, 80);

    function normalizeLink(raw) {
      const candidate = raw.replace(TRAILING_PUNCTUATION, "");
      const withProtocol = /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`;
      try {
        const url = new URL(withProtocol);
        if (!/^https?:$/.test(url.protocol) || !url.hostname) return null;
        return {
          href: url.href,
          display: candidate,
          domain: url.hostname.replace(/^www\./i, ""),
        };
      } catch (error) {
        return null;
      }
    }

    function renderEmpty(message) {
      list.innerHTML = `<div class="extract-empty">${icon("scan")}<strong>${message}</strong><span>链接只会留在当前页面，不会被访问。</span></div>`;
    }

    function extractLinks() {
      const text = input.value;
      inputCount.textContent = `${text.length} 字符`;
      filterInput.value = "";
      limitHit = false;

      if (!text.trim()) {
        allLinks = [];
        renderEmpty("粘贴文字后自动提取");
        count.textContent = "0 个链接";
        copyAll.disabled = true;
        if (downloadAll) downloadAll.disabled = true;
        if (domainsButton) domainsButton.disabled = true;
        if (note) note.textContent = "只识别 http(s) 链接，不会访问它们。";
        return;
      }

      const matches = text.match(URL_PATTERN) || [];
      const seen = new Set();
      const found = [];

      for (const match of matches) {
        const item = normalizeLink(match);
        if (!item) continue;
        if (dedupe.checked && seen.has(item.href)) continue;
        seen.add(item.href);
        found.push(item);
        if (found.length >= MAX_RESULTS) {
          limitHit = true;
          break;
        }
      }

      allLinks = found;
      if (downloadAll) downloadAll.disabled = found.length === 0;
      if (domainsButton) domainsButton.disabled = found.length === 0;
      if (note) {
        note.textContent = limitHit
          ? `内容较多，已展示前 ${MAX_RESULTS} 个链接。`
          : "只识别 http(s) 链接，不会访问它们。";
      }
      renderResults();
    }

    function hueFromDomain(domain) {
      let hash = 0;
      for (let index = 0; index < domain.length; index += 1) {
        hash = (hash * 31 + domain.charCodeAt(index)) % 360;
      }
      return hash;
    }

    function createLinkItem(item) {
      const row = document.createElement("article");
      row.className = "extract-item";

      const mark = document.createElement("span");
      mark.className = "extract-mark";
      mark.textContent = (item.domain.charAt(0) || "?").toUpperCase();
      mark.style.setProperty("--mark-hue", String(hueFromDomain(item.domain)));

      const body = document.createElement("div");
      body.className = "extract-item-body";

      const link = document.createElement("a");
      link.className = "extract-item-link";
      link.href = item.href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = item.display;
      link.title = item.href;

      const domain = document.createElement("span");
      domain.className = "extract-item-domain";
      domain.textContent = item.domain;

      body.append(link, domain);

      const actions = document.createElement("div");
      actions.className = "extract-item-actions";

      const copyButton = document.createElement("button");
      copyButton.className = "chrome-action";
      copyButton.type = "button";
      copyButton.setAttribute("aria-label", `复制 ${item.domain} 链接`);
      copyButton.innerHTML = icon("copy");
      copyButton.addEventListener("click", () => copyText(item.href, "链接已复制"));

      const openLink = document.createElement("a");
      openLink.className = "extract-item-open";
      openLink.href = item.href;
      openLink.target = "_blank";
      openLink.rel = "noopener noreferrer";
      openLink.setAttribute("aria-label", `在新标签页打开 ${item.domain}`);
      openLink.innerHTML = icon("external");

      actions.append(copyButton, openLink);
      row.append(mark, body, actions);
      return row;
    }

    function renderResults() {
      const query = filterInput.value.trim().toLowerCase();
      const visible = query
        ? allLinks.filter(
            (item) =>
              item.display.toLowerCase().includes(query) ||
              item.domain.toLowerCase().includes(query)
          )
        : allLinks;

      list.innerHTML = "";

      if (!visible.length) {
        renderEmpty(allLinks.length ? "没有匹配的链接" : "还没有提取到链接");
        count.textContent = query ? `0 / ${allLinks.length} 个链接` : `${allLinks.length} 个链接`;
        copyAll.disabled = true;
        return;
      }

      const fragment = document.createDocumentFragment();
      visible.forEach((item) => fragment.appendChild(createLinkItem(item)));
      list.appendChild(fragment);
      count.textContent = query
        ? `${visible.length} / ${allLinks.length} 个链接`
        : `${visible.length} 个链接`;
      copyAll.disabled = false;
      animateStagger(list, ".extract-item", { limit: 10, distance: 5, duration: 280 });
    }

    input.addEventListener("input", () => {
      inputCount.textContent = `${input.value.length} 字符`;
      scheduledExtract();
    });
    dedupe.addEventListener("change", extractLinks);
    filterInput.addEventListener("input", scheduledRender);

    $("#extractExample")?.addEventListener("click", () => {
      input.value = sample;
      extractLinks();
      input.focus();
    });
    $("#extractClear")?.addEventListener("click", () => {
      scheduledExtract.cancel();
      input.value = "";
      filterInput.value = "";
      allLinks = [];
      inputCount.textContent = "0 字符";
      count.textContent = "0 个链接";
      copyAll.disabled = true;
      if (downloadAll) downloadAll.disabled = true;
      if (note) note.textContent = "只识别 http(s) 链接，不会访问它们。";
      renderEmpty("粘贴文字后自动提取");
      input.focus();
    });
    copyAll.addEventListener("click", () => {
      const query = filterInput.value.trim().toLowerCase();
      const links = (query
        ? allLinks.filter(
            (item) =>
              item.display.toLowerCase().includes(query) ||
              item.domain.toLowerCase().includes(query)
          )
        : allLinks
      ).map((item) => item.href);
      if (!links.length) {
        toast("当前没有可复制的链接", { type: "info" });
        return;
      }
      copyText(links.join("\n"), `已复制 ${links.length} 个链接`);
    });

    downloadAll?.addEventListener("click", () => {
      if (!allLinks.length) {
        toast("还没有可下载的链接", { type: "info" });
        return;
      }
      const text = allLinks.map((item) => item.href).join("\n");
      downloadText(text, "lumen-links.txt", "text/plain;charset=utf-8");
      toast(`已下载 ${allLinks.length} 个链接`);
    });
    domainsButton?.addEventListener("click", () => {
      const domains = [...new Set(allLinks.map((item) => item.domain).filter(Boolean))];
      if (!domains.length) return toast("还没有可复制的域名", { type: "info" });
      copyText(domains.join("\n"), `已复制 ${domains.length} 个域名`);
    });

    input.value = sample;
    extractLinks();
    if (downloadAll) downloadAll.disabled = allLinks.length === 0;
    if (domainsButton) domainsButton.disabled = allLinks.length === 0;

    return () => {
      scheduledExtract.cancel();
      scheduledRender.cancel();
    };
  }

