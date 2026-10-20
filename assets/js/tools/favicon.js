/* ==========================================================================
   Favicon studio: center-cropped PNG icons in common sizes
   ChengYu · Lumen Toolkit
   ========================================================================== */
"use strict";

function initFaviconTool() {
  const fileInput = $("#faviconFile");
  const sourcePreview = $("#faviconPreview");
  const padding = $("#faviconPadding");
  const paddingValue = $("#faviconPaddingValue");
  const background = $("#faviconBg");
  const sizesNode = $("#faviconSizes");
  const status = $("#faviconStatus");
  const generateButton = $("#faviconGenerate");
  const snippetButton = $("#faviconSnippet");
  if (!fileInput || !sizesNode) return;
  let image = null;
  let objectUrl = "";
  const sizes = [16, 32, 48, 180, 192, 512];

  const setStatus = (text) => {
    if (status) status.textContent = text;
  };
  const setPadding = () => {
    if (paddingValue) paddingValue.textContent = `${padding?.value || 0}%`;
  };
  const reset = () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = "";
    image = null;
    fileInput.value = "";
    if (snippetButton) snippetButton.disabled = true;
    if (sourcePreview) {
      sourcePreview.hidden = true;
      sourcePreview.removeAttribute("src");
    }
    sizesNode.replaceChildren();
    setStatus("等待图片");
  };

  const loadFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setStatus("请选择图片文件");
      return;
    }
    if (file.size > 18 * 1024 * 1024) {
      setStatus("图片需小于 18 MB");
      return;
    }
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);
    const next = new Image();
    next.onload = () => {
      image = next;
      if (sourcePreview) {
        sourcePreview.src = objectUrl;
        sourcePreview.hidden = false;
      }
      setStatus(`已载入 ${next.naturalWidth}×${next.naturalHeight}`);
      generate();
    };
    next.onerror = () => setStatus("图片读取失败");
    next.src = objectUrl;
  };

  const generate = () => {
    if (!image) {
      setStatus("请先选择图片");
      return;
    }
    const pad = Math.max(0, Math.min(28, Number(padding?.value || 0)));
    const bg = background?.value || "#ffffff";
    sizesNode.replaceChildren();
    sizes.forEach((size) => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      context.fillStyle = bg;
      context.fillRect(0, 0, size, size);
      const inset = (size * pad) / 100;
      const inner = size - inset * 2;
      const scale = Math.max(inner / image.naturalWidth, inner / image.naturalHeight);
      const width = image.naturalWidth * scale;
      const height = image.naturalHeight * scale;
      context.imageSmoothingQuality = "high";
      context.drawImage(
        image,
        (size - width) / 2,
        (size - height) / 2,
        width,
        height
      );
      const dataUrl = canvas.toDataURL("image/png");
      const card = document.createElement("article");
      card.className = "favicon-card";
      const preview = document.createElement("img");
      preview.src = dataUrl;
      preview.alt = `${size}px 图标`;
      preview.width = Math.min(size, 96);
      preview.height = Math.min(size, 96);
      const label = document.createElement("div");
      const strong = document.createElement("strong");
      strong.textContent = `${size}×${size}`;
      const small = document.createElement("small");
      small.textContent = `${size}px PNG`;
      const link = document.createElement("a");
      link.className = "favicon-download";
      link.href = dataUrl;
      link.download = `favicon-${size}.png`;
      link.textContent = "下载";
      label.append(strong, small);
      card.append(preview, label, link);
      sizesNode.appendChild(card);
    });
    setStatus(`已生成 ${sizes.length} 个尺寸`);
    if (snippetButton) snippetButton.disabled = false;
  };

  fileInput.addEventListener("change", () => loadFile(fileInput.files?.[0]));
  $("#faviconDrop")?.addEventListener("dragover", (event) => {
    event.preventDefault();
    event.currentTarget.classList.add("is-dragging");
  });
  $("#faviconDrop")?.addEventListener("dragleave", (event) => {
    event.currentTarget.classList.remove("is-dragging");
  });
  $("#faviconDrop")?.addEventListener("drop", (event) => {
    event.preventDefault();
    event.currentTarget.classList.remove("is-dragging");
    loadFile(event.dataTransfer?.files?.[0]);
  });
  padding?.addEventListener("input", setPadding);
  padding?.addEventListener("change", () => {
    if (image) generate();
  });
  background?.addEventListener("input", () => {
    if (image) generate();
  });
  generateButton?.addEventListener("click", generate);
  $("#faviconSnippet")?.addEventListener("click", () => {
    if (!image) {
      toast("先选择图片并生成图标", { type: "info" });
      return;
    }
    const snippet = [
      '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">',
      '<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png">',
      '<link rel="apple-touch-icon" sizes="180x180" href="/favicon-180.png">',
      '<link rel="manifest" href="/site.webmanifest">',
    ].join("\n");
    copyText(snippet, "站点图标代码已复制");
  });
  setPadding();
  reset();
  return () => {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = "";
    }
  };
}
