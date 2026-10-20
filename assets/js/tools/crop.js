/* ==========================================================================
   Image crop: pan, zoom, rotate and export with Canvas
   ChengYu · Lumen Toolkit
   ========================================================================== */
"use strict";

/*
  Canvas 坐标约定：
  - image 是原始 Image；
  - zoom 只影响绘制缩放，不修改源图；
  - offsetX / offsetY 是图像在输出画布中的平移；
  - rotation 只允许 0 / 90 / 180 / 270，旋转后重新计算适配尺寸。

  导出时按当前画布尺寸重绘，而不是截取屏幕；所以下载结果与预览一致，
  且不会因为设备像素比不同而模糊。本工具不包含 OCR，只做像素裁剪与编码。
*/
function initCropTool() {
  const canvas = $("#cropCanvas");
  const fileInput = $("#cropFile");
  if (!canvas || !fileInput) return;
  const context = canvas.getContext("2d");
  const empty = $("#cropEmpty");
  const sourceInfo = $("#cropSourceInfo");
  const status = $("#cropStatus");
  const zoom = $("#cropZoom");
  const zoomValue = $("#cropZoomValue");
  const offsetX = $("#cropOffsetX");
  const offsetY = $("#cropOffsetY");
  const ratioButtons = $$("[data-crop-ratio]");
  const format = $("#cropFormat");
  const quality = $("#cropQuality");
  const qualityValue = $("#cropQualityValue");
  const qualityBlock = $("#cropQualityBlock");
  const download = $("#cropDownload");
  const rotate = $("#cropRotate");
  let image = null;
  let objectUrl = "";
  let ratio = "free";
  let rotation = 0;
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startOffsetX = 0;
  let startOffsetY = 0;
  const setStatus = (text) => {
    if (status) status.textContent = text;
  };
  const ratioSize = () => {
    if (ratio === "1:1") return [680, 680];
    if (ratio === "4:3") return [720, 540];
    if (ratio === "16:9") return [720, 405];
    return [720, 480];
  };
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const render = () => {
    const [width, height] = ratioSize();
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    context.clearRect(0, 0, width, height);
    if (format?.value === "jpeg") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
    }
    if (!image) return;
    const rad = (rotation * Math.PI) / 180;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    const rotatedWidth = image.naturalWidth * cos + image.naturalHeight * sin;
    const rotatedHeight = image.naturalWidth * sin + image.naturalHeight * cos;
    const scale = Math.max(width / rotatedWidth, height / rotatedHeight) * (Number(zoom?.value || 100) / 100);
    const centerX = width / 2 + (Number(offsetX?.value || 0) / 100) * (width / 2);
    const centerY = height / 2 + (Number(offsetY?.value || 0) / 100) * (height / 2);
    context.save();
    context.imageSmoothingQuality = "high";
    context.translate(centerX, centerY);
    context.rotate(rad);
    context.drawImage(
      image,
      (-image.naturalWidth * scale) / 2,
      (-image.naturalHeight * scale) / 2,
      image.naturalWidth * scale,
      image.naturalHeight * scale
    );
    context.restore();
    if (zoomValue) zoomValue.textContent = `${zoom?.value || 100}%`;
    if (qualityValue) qualityValue.textContent = `${quality?.value || 92}%`;
    if (qualityBlock) qualityBlock.hidden = format?.value === "png";
  };

  const loadFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setStatus("请选择图片文件");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setStatus("图片需小于 20 MB");
      return;
    }
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);
    const next = new Image();
    next.onload = () => {
      image = next;
      if (empty) empty.hidden = true;
      if (download) download.disabled = false;
      if (sourceInfo) sourceInfo.textContent = `${file.name} · ${next.naturalWidth}×${next.naturalHeight}`;
      setStatus("拖动画面调整位置");
      render();
    };
    next.onerror = () => setStatus("图片读取失败");
    next.src = objectUrl;
  };

  fileInput.addEventListener("change", () => loadFile(fileInput.files?.[0]));
  zoom?.addEventListener("input", render);
  offsetX?.addEventListener("input", render);
  offsetY?.addEventListener("input", render);
  format?.addEventListener("change", render);
  quality?.addEventListener("input", render);
  ratioButtons.forEach((button) => {
    button.addEventListener("click", () => {
      ratio = button.dataset.cropRatio;
      ratioButtons.forEach((item) => item.classList.toggle("is-active", item === button));
      if (offsetX) offsetX.value = "0";
      if (offsetY) offsetY.value = "0";
      render();
    });
  });
  rotate?.addEventListener("click", () => {
    rotation = (rotation + 90) % 360;
    render();
  });
  $("#cropReset")?.addEventListener("click", () => {
    ratio = "free";
    rotation = 0;
    if (zoom) zoom.value = "100";
    if (offsetX) offsetX.value = "0";
    if (offsetY) offsetY.value = "0";
    ratioButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.cropRatio === "free"));
    render();
    setStatus("已重置");
  });
  canvas.addEventListener("pointerdown", (event) => {
    if (!image) return;
    dragging = true;
    startX = event.clientX;
    startY = event.clientY;
    startOffsetX = Number(offsetX?.value || 0);
    startOffsetY = Number(offsetY?.value || 0);
    canvas.setPointerCapture?.(event.pointerId);
    canvas.classList.add("is-dragging");
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const rect = canvas.getBoundingClientRect();
    if (offsetX) offsetX.value = String(clamp(startOffsetX + ((event.clientX - startX) / rect.width) * 200, -100, 100));
    if (offsetY) offsetY.value = String(clamp(startOffsetY + ((event.clientY - startY) / rect.height) * 200, -100, 100));
    render();
  });
  const finishDrag = () => {
    dragging = false;
    canvas.classList.remove("is-dragging");
  };
  canvas.addEventListener("pointerup", finishDrag);
  canvas.addEventListener("pointercancel", finishDrag);
  download?.addEventListener("click", () => {
    if (!image) return;
    render();
    const type =
      format?.value === "jpeg"
        ? "image/jpeg"
        : format?.value === "webp"
          ? "image/webp"
          : "image/png";
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const extension = type === "image/jpeg" ? "jpg" : type === "image/webp" ? "webp" : "png";
        downloadBlob(blob, `lumen-crop.${extension}`);
        setStatus(`已导出 ${Math.round(blob.size / 1024)} KB`);
      },
      type,
      type === "image/png" ? undefined : Number(quality?.value || 92) / 100
    );
  });
  const cleanup = () => {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = "";
    }
    window.removeEventListener("pagehide", cleanup);
  };
  window.addEventListener("pagehide", cleanup, { once: true });
  setStatus("等待图片");
  render();
  return cleanup;
}
