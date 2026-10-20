/* ==========================================================================
   Image palette extraction
   ChengYu · Lumen Toolkit
   ========================================================================== */
"use strict";

  /* ----------------------------------------------------------------------
     Image palette (Canvas + local quantization, inspired by Color Thief)
     ---------------------------------------------------------------------- */
  function initImagePaletteTool() {
    const input = $("#paletteImageInput");
    const drop = $("#paletteDrop");
    const preview = $("#palettePreview");
    const swatches = $("#paletteSwatches");
    const dominant = $("#paletteDominant");
    const dominantSwatch = $("#paletteDominantSwatch");
    const status = $("#paletteStatus");
    const copyButton = $("#paletteCopy");
    const cssButton = $("#paletteCss");
    const jsonButton = $("#paletteJson");
    if (!input || !drop || !swatches) return;
    let objectUrl = "";
    let colors = [];

    const setStatus = (message, state = "") => {
      if (!status) return;
      status.textContent = message;
      status.dataset.state = state;
    };

    const clear = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = "";
      input.value = "";
      if (preview) {
        preview.hidden = true;
        preview.removeAttribute("src");
      }
      swatches.replaceChildren();
      if (dominant) dominant.textContent = "—";
      if (dominantSwatch) dominantSwatch.style.removeProperty("--swatch");
      if (copyButton) copyButton.disabled = true;
      if (cssButton) cssButton.disabled = true;
      if (jsonButton) jsonButton.disabled = true;
      drop.classList.remove("has-image");
      setStatus("等待图片");
    };

    const render = (list) => {
      colors = list;
      swatches.replaceChildren();
      list.forEach((hex, index) => {
        const button = document.createElement("button");
        button.className = "imagepalette-swatch";
        button.type = "button";
        button.style.setProperty("--swatch", hex);
        button.setAttribute("aria-label", `复制颜色 ${hex}`);
        const code = document.createElement("span");
        code.textContent = hex;
        button.appendChild(code);
        button.addEventListener("click", () => copyText(hex, `已复制 ${hex}`));
        swatches.appendChild(button);
      });
      if (dominant) dominant.textContent = list[0] || "—";
      if (dominantSwatch) {
        if (list[0]) dominantSwatch.style.setProperty("--swatch", list[0]);
        else dominantSwatch.style.removeProperty("--swatch");
      }
      if (copyButton) copyButton.disabled = !list.length;
      if (cssButton) cssButton.disabled = !list.length;
      if (jsonButton) jsonButton.disabled = !list.length;
      setStatus(list.length ? `已提取 ${list.length} 个颜色` : "没有识别到颜色", list.length ? "valid" : "");
    };

    const extract = (image) => {
      const canvas = document.createElement("canvas");
      const size = 128;
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return [];
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, size, size);
      const scale = Math.max(size / image.width, size / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
      const pixels = context.getImageData(0, 0, size, size).data;
      const buckets = new Map();
      for (let y = 0; y < size; y += 2) {
        for (let x = 0; x < size; x += 2) {
          const offset = (y * size + x) * 4;
          if (pixels[offset + 3] < 160) continue;
          const r = Math.round(pixels[offset] / 24) * 24;
          const g = Math.round(pixels[offset + 1] / 24) * 24;
          const b = Math.round(pixels[offset + 2] / 24) * 24;
          const key = `${r},${g},${b}`;
          const entry = buckets.get(key) || { r: 0, g: 0, b: 0, count: 0 };
          entry.r += pixels[offset];
          entry.g += pixels[offset + 1];
          entry.b += pixels[offset + 2];
          entry.count += 1;
          buckets.set(key, entry);
        }
      }
      const candidates = [...buckets.values()]
        .map((entry) => ({
          r: Math.round(entry.r / entry.count),
          g: Math.round(entry.g / entry.count),
          b: Math.round(entry.b / entry.count),
          count: entry.count,
        }))
        .sort((a, b) => b.count - a.count);
      const selected = [];
      for (const color of candidates) {
        const distance = Math.max(
          ...selected.map((item) =>
            Math.hypot(item.r - color.r, item.g - color.g, item.b - color.b)
          )
        );
        if (selected.length < 6 && (!selected.length || distance > 54)) selected.push(color);
        if (selected.length === 6) break;
      }
      return selected.map(({ r, g, b }) => `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`);
    };

    const useImage = (image, label = "图片") => {
      if (preview) {
        preview.src = image.src;
        preview.hidden = false;
      }
      drop.classList.add("has-image");
      const palette = extract(image);
      render(palette);
      setStatus(`${label} · ${palette.length} 个颜色`, palette.length ? "valid" : "");
    };

    const loadUrl = (url) => {
      const image = new Image();
      image.onload = () => useImage(image, "图片");
      image.onerror = () => setStatus("图片读取失败，请换一张试试", "error");
      image.src = url;
    };

    const loadFile = (file) => {
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        setStatus("请选择 PNG、JPEG 或 WebP 图片", "error");
        return;
      }
      if (file.size > 18 * 1024 * 1024) {
        setStatus("图片需小于 18 MB", "error");
        return;
      }
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(file);
      loadUrl(objectUrl);
    };

    input.addEventListener("change", () => loadFile(input.files?.[0]));
    ["dragenter", "dragover"].forEach((type) => {
      drop.addEventListener(type, (event) => {
        event.preventDefault();
        drop.classList.add("is-dragging");
      });
    });
    ["dragleave", "drop"].forEach((type) => {
      drop.addEventListener(type, (event) => {
        event.preventDefault();
        drop.classList.remove("is-dragging");
      });
    });
    drop.addEventListener("drop", (event) => {
      const file = event.dataTransfer?.files?.[0];
      if (file) loadFile(file);
    });
    $("#paletteSample")?.addEventListener("click", () => {
      clear();
      const canvas = document.createElement("canvas");
      canvas.width = 480;
      canvas.height = 320;
      const context = canvas.getContext("2d");
      if (!context) return;
      const gradient = context.createLinearGradient(0, 0, 480, 320);
      gradient.addColorStop(0, "#ff9b82");
      gradient.addColorStop(0.32, "#ffd66b");
      gradient.addColorStop(0.58, "#7bd8c2");
      gradient.addColorStop(0.8, "#7e8cff");
      gradient.addColorStop(1, "#d38bff");
      context.fillStyle = gradient;
      context.fillRect(0, 0, 480, 320);
      context.globalAlpha = 0.72;
      [
        [104, 96, 78, "#ff8f6b"],
        [342, 92, 86, "#7e8cff"],
        [220, 218, 112, "#7bd8c2"],
        [390, 245, 68, "#ffd66b"],
      ].forEach(([x, y, radius, color]) => {
        context.fillStyle = color;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      });
      const image = new Image();
      image.onload = () => useImage(image, "示例图片");
      image.src = canvas.toDataURL("image/png");
    });
    $("#paletteClear")?.addEventListener("click", clear);
    copyButton?.addEventListener("click", () => {
      if (!colors.length) return toast("还没有提取到颜色", { type: "info" });
      copyText(colors.join("\n"), "色板已复制");
    });
    cssButton?.addEventListener("click", () => {
      if (!colors.length) return;
      const css = `:root {\n${colors.map((hex, index) => `  --palette-${index + 1}: ${hex};`).join("\n")}\n}`;
      copyText(css, "CSS 颜色变量已复制");
    });
    jsonButton?.addEventListener("click", () => {
      if (!colors.length) return;
      copyText(JSON.stringify({ dominant: colors[0], colors }, null, 2), "色板 JSON 已复制");
    });
    clear();
  }

