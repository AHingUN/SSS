/* ==========================================================================
   QR workshop
   ChengYu · Lumen Toolkit
   ========================================================================== */
"use strict";

  /* ----------------------------------------------------------------------
     QR tool
     ---------------------------------------------------------------------- */
  /*
    qrcode.js 是本地 vendor，不在首屏加载。第一次需要画二维码时由
    05-ui.js 的 loadQrLibrary() 动态插入；加载失败只影响本工具。

    预览和导出都从同一份 QR 矩阵重新绘制：
    - Canvas：适合 PNG 下载；
    - SVG：按模块路径生成，文件更小、可无限放大。
    颜色使用 HEX 输入；对比度不足时仍允许生成，不强制拦截，
    由使用者自行判断扫码可读性。
  */
  function initQrTool() {
    const textInput = $("#qrText");
    const canvas = $("#qrCanvas");
    const paper = $("#qrPaper");
    const empty = $("#qrEmpty");
    const error = $("#qrError");
    const download = $("#qrDownload");
    const downloadSvg = $("#qrDownloadSvg");
    const sizeSelect = $("#qrSize");
    const ecSelect = $("#qrEc");
    const fgInput = $("#qrFg");
    const bgInput = $("#qrBg");
    const fgSwatch = $("#qrFgSwatch");
    const bgSwatch = $("#qrBgSwatch");
    const fgCode = $("#qrFgCode");
    const bgCode = $("#qrBgCode");
    const charCount = $("#qrCharCount");
    const sizeLabel = $("#qrSizeLabel");
    const templateGroup = $("#qrTemplates");
    if (!textInput || !canvas || !download) return null;

    const templates = {
      text: "程宇工具箱 · 日常小事，一气呵成。",
      url: "https://example.com",
      wifi: "WIFI:T:WPA;S:我的网络;P:请替换密码;;",
      contact: [
        "BEGIN:VCARD",
        "VERSION:3.0",
        "FN:程宇",
        "ORG:Lumen Toolkit",
        "TEL:",
        "EMAIL:hello@example.com",
        "URL:https://example.com",
        "END:VCARD",
      ].join("\n"),
      email: "mailto:hello@example.com?subject=你好%20程宇",
    };

    let debounceTimer = 0;
    let libraryReady = typeof window.qrcode === "function";
    let disposed = false;
    textInput.maxLength = 1200;

    function setColorField(input, swatch, code) {
      const value = input.value;
      if (swatch) swatch.style.background = value;
      if (code) code.textContent = value.toUpperCase();
    }

    function updateCount() {
      if (!charCount) return;
      charCount.textContent = `${textInput.value.length} / 1200`;
      charCount.style.color = textInput.value.length > 1100 ? "var(--warning)" : "";
    }

    function renderQr() {
      if (!libraryReady || disposed) return;
      const text = textInput.value.trim();
      updateCount();
      error.hidden = true;
      if (!text) {
        canvas.hidden = true;
        empty.hidden = false;
        empty.textContent = "写下一点什么，二维码就会出现在这里。";
        download.disabled = true;
        if (downloadSvg) downloadSvg.disabled = true;
        return;
      }
      try {
        drawQr(canvas, text, {
          size: 720,
          margin: 4,
          foreground: fgInput.value,
          background: bgInput.value,
          level: ecSelect.value,
        });
        paper.style.background = bgInput.value;
        canvas.hidden = false;
        empty.hidden = true;
        download.disabled = false;
        if (downloadSvg) downloadSvg.disabled = false;
      } catch (err) {
        canvas.hidden = true;
        empty.hidden = false;
        empty.textContent = "内容有点长，试着精简一些。";
        error.textContent = "内容超出二维码容量，请删减或更换纠错级别。";
        error.hidden = false;
        download.disabled = true;
        if (downloadSvg) downloadSvg.disabled = true;
      }
    }

    function scheduleRender() {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(renderQr, 120);
    }

    function buildQrSvg(text, { size = 1024, margin = 4, foreground = "#141418", background = "#ffffff", level = "M" } = {}) {
      useUtf8Qr();
      const qr = window.qrcode(0, level);
      qr.addData(text, "Byte");
      qr.make();
      const count = qr.getModuleCount();
      const total = count + margin * 2;
      let path = "";
      for (let row = 0; row < count; row += 1) {
        let column = 0;
        while (column < count) {
          if (!qr.isDark(row, column)) {
            column += 1;
            continue;
          }
          const start = column;
          while (column < count && qr.isDark(row, column)) column += 1;
          path += `M${start + margin} ${row + margin}h${column - start}v1h-${column - start}z`;
        }
      }
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="${background}"/><path d="${path}" fill="${foreground}"/></svg>`;
    }

    function syncColor(input, swatch, code) {
      setColorField(input, swatch, code);
      clearPresetSelection();
      scheduleRender();
    }

    function clearPresetSelection() {
      $$(".color-preset", $("#qrPresets")).forEach((button) => {
        button.classList.toggle(
          "is-active",
          button.dataset.fg === fgInput.value && button.dataset.bg === bgInput.value
        );
      });
    }

    fgInput.addEventListener("input", () => syncColor(fgInput, fgSwatch, fgCode));
    bgInput.addEventListener("input", () => syncColor(bgInput, bgSwatch, bgCode));
    ecSelect.addEventListener("change", scheduleRender);
    sizeSelect.addEventListener("change", () => {
      if (sizeLabel) sizeLabel.textContent = `${sizeSelect.value} px`;
    });
    textInput.addEventListener("input", () => {
      $$("button", templateGroup).forEach((button) => button.classList.remove("is-active"));
      scheduleRender();
    });

    templateGroup?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-qr-template]");
      if (!button) return;
      const value = templates[button.dataset.qrTemplate];
      if (!value) return;
      textInput.value = value;
      $$("button", templateGroup).forEach((item) => {
        item.classList.toggle("is-active", item === button);
      });
      window.clearTimeout(debounceTimer);
      renderQr();
      textInput.focus();
      toast("已填入模板，替换示例内容即可", { type: "info" });
    });

    $$(".color-preset", $("#qrPresets")).forEach((button) => {
      button.addEventListener("click", () => {
        fgInput.value = button.dataset.fg;
        bgInput.value = button.dataset.bg;
        setColorField(fgInput, fgSwatch, fgCode);
        setColorField(bgInput, bgSwatch, bgCode);
        clearPresetSelection();
        renderQr();
      });
    });

    download.addEventListener("click", () => {
      const text = textInput.value.trim();
      if (!text || !libraryReady) return;
      try {
        const exportCanvas = document.createElement("canvas");
        const size = Number(sizeSelect.value) || 1024;
        drawQr(exportCanvas, text, {
          size,
          margin: 4,
          foreground: fgInput.value,
          background: bgInput.value,
          level: ecSelect.value,
        });
        exportCanvas.toBlob((blob) => {
          if (!blob) {
            toast("二维码导出失败，请再试一次", { type: "info" });
            return;
          }
          downloadBlob(blob, `lumen-qr-${size}.png`);
          toast("二维码已下载");
        }, "image/png");
      } catch (errorObj) {
        toast("二维码导出失败，请再试一次", { type: "info" });
      }
    });

    downloadSvg?.addEventListener("click", () => {
      const text = textInput.value.trim();
      if (!text || !libraryReady) return;
      try {
        const size = Number(sizeSelect.value) || 1024;
        const svg = buildQrSvg(text, {
          size,
          margin: 4,
          foreground: fgInput.value,
          background: bgInput.value,
          level: ecSelect.value,
        });
        downloadText(svg, `lumen-qr-${size}.svg`, "image/svg+xml;charset=utf-8");
        toast("SVG 二维码已下载");
      } catch (errorObj) {
        toast("SVG 导出失败，请再试一次", { type: "info" });
      }
    });

    setColorField(fgInput, fgSwatch, fgCode);
    setColorField(bgInput, bgSwatch, bgCode);
    clearPresetSelection();
    if (sizeLabel) sizeLabel.textContent = `${sizeSelect.value} px`;

    if (libraryReady) {
      renderQr();
    } else {
      canvas.hidden = true;
      empty.hidden = false;
      empty.textContent = "正在准备二维码…";
      download.disabled = true;
      if (downloadSvg) downloadSvg.disabled = true;
      loadQrLibrary()
        .then(() => {
          if (disposed) return;
          libraryReady = true;
          renderQr();
        })
        .catch(() => {
          if (disposed) return;
          empty.hidden = false;
          empty.textContent = "二维码引擎暂时不可用。";
          error.textContent = "加载二维码组件失败，请检查本地文件后重试。";
          error.hidden = false;
          download.disabled = true;
          if (downloadSvg) downloadSvg.disabled = true;
        });
    }

    return () => {
      disposed = true;
      window.clearTimeout(debounceTimer);
    };
  }

