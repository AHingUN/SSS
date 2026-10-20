/* ==========================================================================
   Image compressor
   ChengYu · Lumen Toolkit
   ========================================================================== */
"use strict";

  /* ----------------------------------------------------------------------
     Image compressor
     ---------------------------------------------------------------------- */
  function initImageTool() {
    const fileInput = $("#imageFile");
    const dropzone = $("#imageDrop");
    const workbench = $("#imageWorkbench");
    const pickButton = $("#imagePick");
    const replaceButton = $("#imageReplace");
    const preview = $("#imagePreview");
    const previewBadge = $("#imagePreviewBadge");
    const fileName = $("#imageFileName");
    const fileMeta = $("#imageFileMeta");
    const widthInput = $("#imageWidth");
    const originalDims = $("#imageOriginalDims");
    const quality = $("#imageQuality");
    const qualityValue = $("#imageQualityValue");
    const formatGroup = $("#imageFormats");
    const resultSize = $("#imageResultSize");
    const savingPill = $("#imageSaving");
    const progress = $("#imageProgress");
    const downloadButton = $("#imageDownload");
    const note = $("#imageNote");
    if (!fileInput || !dropzone || !workbench) return null;

    let currentFile = null;
    let sourceUrl = "";
    let outputUrl = "";
    let outputBlob = null;
    let sourceImage = null;
    let originalWidth = 0;
    let originalHeight = 0;
    let format = "webp";
    let loadToken = 0;
    let processingToken = 0;

    const scheduledProcess = debounce(() => processImage(), 200);

    function setFormat(next) {
      format = next;
      $$("button", formatGroup).forEach((button) => {
        const active = button.dataset.format === format;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", active ? "true" : "false");
      });
      const lossless = format === "png";
      quality.disabled = lossless;
      if (note) {
        note.textContent = lossless
          ? "PNG 为无损格式，画质滑杆不会影响输出。"
          : "调整参数后会立即重新生成。";
      }
      scheduledProcess();
    }

    function resetUrls() {
      if (sourceUrl) {
        URL.revokeObjectURL(sourceUrl);
        sourceUrl = "";
      }
      if (outputUrl) {
        URL.revokeObjectURL(outputUrl);
        outputUrl = "";
      }
      outputBlob = null;
      if (downloadButton) downloadButton.disabled = true;
    }

    function clearLoadedImage() {
      sourceImage = null;
      currentFile = null;
      originalWidth = 0;
      originalHeight = 0;
      if (preview) preview.removeAttribute("src");
      if (resultSize) resultSize.textContent = "—";
      if (progress) progress.hidden = true;
      if (workbench) workbench.hidden = true;
      if (dropzone) dropzone.hidden = false;
    }

    function paintControls() {
      paintRange(quality);
      if (qualityValue) qualityValue.textContent = quality.value;
    }

    function acceptFile(file) {
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        toast("请选择图片文件", { type: "info" });
        return;
      }
      if (file.size > 30 * 1024 * 1024) {
        toast("图片超过 30 MB，换一张小一点的吧", { type: "info" });
        return;
      }

      const token = ++loadToken;
      processingToken += 1;
      resetUrls();
      clearLoadedImage();
      if (resultSize) resultSize.textContent = "—";
      if (savingPill) {
        savingPill.textContent = "计算中";
        savingPill.classList.add("is-neutral");
      }
      if (progress) progress.hidden = false;

      const url = URL.createObjectURL(file);
      sourceUrl = url;
      const image = new Image();
      image.onload = () => {
        if (token !== loadToken) {
          URL.revokeObjectURL(url);
          return;
        }
        sourceImage = image;
        currentFile = file;
        originalWidth = image.naturalWidth;
        originalHeight = image.naturalHeight;
        if (widthInput) {
          widthInput.max = String(Math.min(originalWidth, 8192));
          widthInput.value = String(Math.min(originalWidth, 1920));
        }
        if (originalDims) originalDims.textContent = `${originalWidth} × ${originalHeight}`;
        if (fileName) {
          fileName.textContent = file.name;
          fileName.title = file.name;
        }
        if (fileMeta) fileMeta.textContent = formatBytes(file.size);
        if (preview) preview.src = url;
        dropzone.hidden = true;
        workbench.hidden = false;
        if (previewBadge) previewBadge.textContent = "预览";
        paintControls();
        processImage();
      };
      image.onerror = () => {
        if (token !== loadToken) return;
        resetUrls();
        clearLoadedImage();
        toast("这张图片无法读取，换一张试试", { type: "info" });
      };
      image.src = url;
    }

    function canvasToBlob(canvas, mime, qualityValue) {
      return new Promise((resolve) => {
        canvas.toBlob(resolve, mime, qualityValue);
      });
    }

    async function processImage() {
      if (!sourceImage || !currentFile) return;
      const run = ++processingToken;
      if (progress) progress.hidden = false;
      if (downloadButton) downloadButton.disabled = true;

      const mimeMap = { webp: "image/webp", jpeg: "image/jpeg", png: "image/png" };
      const mime = mimeMap[format] || "image/webp";
      const requestedWidth = Number(widthInput.value) || originalWidth;
      const targetWidth = clamp(Math.round(requestedWidth), 64, Math.min(originalWidth, 8192));
      const targetHeight = Math.max(1, Math.round((targetWidth / originalWidth) * originalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext("2d", { alpha: format !== "jpeg" });

      if (format === "jpeg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, targetWidth, targetHeight);
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(sourceImage, 0, 0, targetWidth, targetHeight);

      const qualityNumber = format === "png" ? undefined : Number(quality.value) / 100;
      let blob;
      try {
        blob = await canvasToBlob(canvas, mime, qualityNumber);
      } catch (error) {
        blob = null;
      }
      if (run !== processingToken) return;
      if (!blob) {
        if (progress) progress.hidden = true;
        toast("图片处理失败，请调低尺寸后再试", { type: "info" });
        return;
      }

      if (outputUrl) URL.revokeObjectURL(outputUrl);
      outputUrl = URL.createObjectURL(blob);
      outputBlob = blob;
      if (preview) preview.src = outputUrl;

      const actualType = blob.type || mime;
      const extension = actualType.includes("jpeg")
        ? "jpg"
        : actualType.includes("webp")
          ? "webp"
          : "png";
      const saving = Math.round((1 - blob.size / currentFile.size) * 100);
      if (resultSize) resultSize.textContent = formatBytes(blob.size);
      if (savingPill) {
        savingPill.classList.toggle("is-neutral", saving <= 0);
        savingPill.textContent = saving > 0 ? `-${saving}%` : "已尽力";
      }
      if (previewBadge) previewBadge.textContent = extension.toUpperCase();
      if (progress) progress.hidden = true;
      if (downloadButton) downloadButton.disabled = false;
      if (note) {
        note.textContent =
          format === "png"
            ? `已输出 ${targetWidth} × ${targetHeight} · PNG 无损`
            : `已输出 ${targetWidth} × ${targetHeight} · 画质 ${quality.value}%`;
      }
      const baseName = currentFile.name.replace(/\.[^.]+$/, "");
      outputBlob = blob;
      downloadButton.dataset.filename = `${baseName}-lumen.${extension}`;
    }

    function openPicker() {
      fileInput.value = "";
      fileInput.click();
    }

    pickButton?.addEventListener("click", openPicker);
    replaceButton?.addEventListener("click", openPicker);
    fileInput.addEventListener("change", (event) => {
      acceptFile(event.target.files?.[0]);
    });

    formatGroup.addEventListener("click", (event) => {
      const button = event.target.closest("[data-format]");
      if (!button) return;
      setFormat(button.dataset.format);
    });

    quality.addEventListener("input", () => {
      paintControls();
      scheduledProcess();
    });
    widthInput.addEventListener("input", scheduledProcess);

    $("#imagePresets")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-image-width]");
      if (!button) return;
      widthInput.value = button.dataset.imageWidth;
      scheduledProcess();
    });

    downloadButton?.addEventListener("click", () => {
      if (!outputBlob) {
        toast("还没有可下载的图片", { type: "info" });
        return;
      }
      downloadBlob(outputBlob, downloadButton.dataset.filename || "lumen-image.webp");
      toast("图片已导出");
    });

    const dragTargets = [dropzone, workbench];
    dragTargets.forEach((target) => {
      target.addEventListener("dragover", (event) => {
        event.preventDefault();
        dropzone.classList.add("is-dragover");
      });
      target.addEventListener("dragleave", (event) => {
        if (target.contains(event.relatedTarget)) return;
        dropzone.classList.remove("is-dragover");
      });
      target.addEventListener("drop", (event) => {
        event.preventDefault();
        dropzone.classList.remove("is-dragover");
        const file = event.dataTransfer?.files?.[0];
        acceptFile(file);
      });
    });

    $$("button", formatGroup).forEach((button) => {
      button.setAttribute("aria-pressed", button.classList.contains("is-active") ? "true" : "false");
    });
    paintControls();

    return () => {
      scheduledProcess.cancel();
      loadToken += 1;
      processingToken += 1;
      resetUrls();
      sourceImage = null;
      currentFile = null;
    };
  }

