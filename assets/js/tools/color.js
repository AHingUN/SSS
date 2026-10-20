/* ==========================================================================
   Color laboratory
   ChengYu · Lumen Toolkit
   ========================================================================== */
"use strict";

  /* ----------------------------------------------------------------------
     Color tool
     ---------------------------------------------------------------------- */
  function initColorTool() {
    const preview = $("#colorPreview");
    const tone = $("#colorTone");
    const hexBig = $("#colorHexBig");
    const picker = $("#colorPicker");
    const hexInput = $("#colorHexInput");
    const hueSlider = $("#hueSlider");
    const satSlider = $("#satSlider");
    const lightSlider = $("#lightSlider");
    const hueValue = $("#hueValue");
    const satValue = $("#satValue");
    const lightValue = $("#lightValue");
    const valueHex = $("#valueHex");
    const valueRgb = $("#valueRgb");
    const valueHsl = $("#valueHsl");
    const shadeRow = $("#shadeRow");
    const harmonyList = $("#harmonyList");
    const contrastSampleLight = $("#contrastSampleLight");
    const contrastSampleDark = $("#contrastSampleDark");
    const contrastWhite = $("#contrastWhite");
    const contrastDark = $("#contrastDark");
    const contrastWhiteGrade = $("#contrastWhiteGrade");
    const contrastDarkGrade = $("#contrastDarkGrade");
    if (!preview || !hueSlider || !shadeRow) return null;

    let state = { h: 227, s: 89, l: 67 };

    function normalizeHue(hue) {
      return ((hue % 360) + 360) % 360;
    }

    function hslToRgb(hue, sat, light) {
      const h = normalizeHue(hue) / 360;
      const s = clamp(sat, 0, 100) / 100;
      const l = clamp(light, 0, 100) / 100;
      if (s === 0) {
        const gray = Math.round(l * 255);
        return [gray, gray, gray];
      }
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      const channel = (value) => {
        let t = value;
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      return [
        Math.round(channel(h + 1 / 3) * 255),
        Math.round(channel(h) * 255),
        Math.round(channel(h - 1 / 3) * 255),
      ];
    }

    function rgbToHsl(r, g, b) {
      const red = r / 255;
      const green = g / 255;
      const blue = b / 255;
      const max = Math.max(red, green, blue);
      const min = Math.min(red, green, blue);
      const delta = max - min;
      let h = 0;
      if (delta !== 0) {
        if (max === red) h = ((green - blue) / delta) % 6;
        else if (max === green) h = (blue - red) / delta + 2;
        else h = (red - green) / delta + 4;
        h *= 60;
        if (h < 0) h += 360;
      }
      const l = (max + min) / 2;
      const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
      return {
        h,
        s: s * 100,
        l: l * 100,
      };
    }

    function rgbToHex(r, g, b) {
      return `#${[r, g, b]
        .map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase()}`;
    }

    function hexToRgb(hex) {
      let normalized = String(hex).trim().replace(/^#/, "");
      if (/^[0-9a-f]{3}$/i.test(normalized)) {
        normalized = normalized
          .split("")
          .map((char) => char + char)
          .join("");
      }
      if (!/^[0-9a-f]{6}$/i.test(normalized)) return null;
      return [
        parseInt(normalized.slice(0, 2), 16),
        parseInt(normalized.slice(2, 4), 16),
        parseInt(normalized.slice(4, 6), 16),
      ];
    }

    function isLight(rgb) {
      return relativeLuminance(rgb) > 0.46;
    }

    function relativeLuminance(rgb) {
      const linear = rgb.map((value) => {
        const channel = value / 255;
        return channel <= 0.03928
          ? channel / 12.92
          : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
    }

    function contrastRatio(a, b) {
      const l1 = relativeLuminance(a);
      const l2 = relativeLuminance(b);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    }

    function gradeContrast(ratio) {
      if (ratio >= 7) return { grade: "AAA", state: "pass" };
      if (ratio >= 4.5) return { grade: "AA", state: "pass" };
      if (ratio >= 3) return { grade: "AA 大字", state: "large" };
      return { grade: "偏低", state: "fail" };
    }

    function paintContrast(rgb, hex) {
      const white = contrastRatio(rgb, [255, 255, 255]);
      const dark = contrastRatio(rgb, [23, 23, 27]);
      if (contrastWhite) contrastWhite.textContent = `${white.toFixed(2)} : 1`;
      if (contrastDark) contrastDark.textContent = `${dark.toFixed(2)} : 1`;
      const whiteGrade = gradeContrast(white);
      const darkGrade = gradeContrast(dark);
      if (contrastWhiteGrade) {
        contrastWhiteGrade.textContent = whiteGrade.grade;
        contrastWhiteGrade.dataset.state = whiteGrade.state;
      }
      if (contrastDarkGrade) {
        contrastDarkGrade.textContent = darkGrade.grade;
        contrastDarkGrade.dataset.state = darkGrade.state;
      }
      if (contrastSampleLight) contrastSampleLight.style.color = hex;
      if (contrastSampleDark) contrastSampleDark.style.color = hex;
    }

    function toneName(hue, sat, light) {
      if (sat < 8) {
        if (light > 87) return "雾白";
        if (light > 65) return "浅灰";
        if (light > 32) return "石墨";
        return "曜石";
      }
      const names = [
        [15, "绯红"],
        [33, "珊瑚"],
        [48, "琥珀"],
        [68, "暖黄"],
        [92, "青柠"],
        [145, "青翠"],
        [170, "薄荷"],
        [190, "松石"],
        [210, "湖蓝"],
        [238, "天青"],
        [260, "靛蓝"],
        [288, "紫罗兰"],
        [315, "品红"],
        [338, "玫红"],
        [361, "绯红"],
      ];
      return (names.find(([bound]) => hue < bound) || names[names.length - 1])[1];
    }

    function currentRgb() {
      return hslToRgb(state.h, state.s, state.l);
    }

    function paintRange(input, progress) {
      if (!input) return;
      input.style.setProperty("--range-progress", `${clamp(progress, 0, 100)}%`);
    }

    function buildShades() {
      if (!shadeRow) return;
      const lightnesses = [92, 81, 70, 58, 46, 34, 22];
      if (shadeRow.children.length !== lightnesses.length) {
        shadeRow.innerHTML = lightnesses
          .map(() => '<button class="shade-swatch" type="button"><span></span></button>')
          .join("");
      }

      lightnesses.forEach((light, index) => {
        const rgb = hslToRgb(state.h, state.s, light);
        const hex = rgbToHex(...rgb);
        const textColor = isLight(rgb) ? "rgba(22,22,28,.68)" : "rgba(255,255,255,.9)";
        const button = shadeRow.children[index];
        if (!button) return;
        button.dataset.hex = hex;
        button.style.background = hex;
        button.style.color = textColor;
        button.setAttribute("aria-label", `应用颜色 ${hex}`);
        const label = button.firstElementChild;
        if (label) label.textContent = hex.slice(1, 7);
      });
    }

    function harmonyHex(hue, sat = state.s, light = state.l) {
      return rgbToHex(...hslToRgb(normalizeHue(hue), clamp(sat, 0, 100), clamp(light, 0, 100)));
    }

    function renderHarmony() {
      if (!harmonyList) return;
      if (harmonyList.children.length !== 3) {
        const names = ["互补", "类似", "三角"];
        harmonyList.innerHTML = names
          .map(
            (name) => `<div class="harmony-row">
              <span class="harmony-name">${name}</span>
              <span class="harmony-swatches">${Array.from({ length: 3 }, () => '<button class="harmony-swatch" type="button"></button>').join("")}</span>
            </div>`
          )
          .join("");
      }
      const colors = [
        harmonyHex(state.h),
        harmonyHex(state.h + 180),
        harmonyHex(state.h + 180, Math.max(20, state.s - 18), clamp(state.l + 16, 20, 88)),
        harmonyHex(state.h - 30),
        harmonyHex(state.h),
        harmonyHex(state.h + 30),
        harmonyHex(state.h),
        harmonyHex(state.h + 120),
        harmonyHex(state.h + 240),
      ];
      $$(".harmony-swatch", harmonyList).forEach((button, index) => {
        const hex = colors[index] || colors[0];
        button.dataset.hex = hex;
        button.style.setProperty("--swatch", hex);
        button.setAttribute("aria-label", `应用 ${hex}`);
        button.title = hex;
      });
    }

    function renderColor({ skipHexInput = false } = {}) {
      const rgb = currentRgb();
      const hex = rgbToHex(...rgb);
      const lightText = isLight(rgb);
      preview.style.backgroundColor = hex;
      preview.style.color = lightText ? "#17171b" : "#ffffff";
      if (tone) tone.textContent = toneName(state.h, state.s, state.l);
      if (hexBig) hexBig.textContent = hex;
      if (picker) picker.value = hex.toLowerCase();
      if (hexInput && !skipHexInput) hexInput.value = hex.slice(1);
      if (hueSlider) hueSlider.value = Math.round(state.h);
      if (satSlider) satSlider.value = Math.round(state.s);
      if (lightSlider) lightSlider.value = Math.round(state.l);
      if (hueValue) hueValue.textContent = String(Math.round(state.h));
      if (satValue) satValue.textContent = String(Math.round(state.s));
      if (lightValue) lightValue.textContent = String(Math.round(state.l));
      if (valueHex) valueHex.textContent = hex;
      if (valueRgb) valueRgb.textContent = `${rgb[0]}, ${rgb[1]}, ${rgb[2]}`;
      if (valueHsl) valueHsl.textContent = `${Math.round(state.h)}, ${Math.round(state.s)}%, ${Math.round(state.l)}%`;
      paintContrast(rgb, hex);
      if (hueSlider) paintRange(hueSlider, (state.h / 360) * 100);
      if (satSlider) {
        paintRange(satSlider, state.s);
        satSlider.style.setProperty("--range-accent", hex);
      }
      if (lightSlider) {
        paintRange(lightSlider, state.l);
        lightSlider.style.setProperty("--range-accent", hex);
      }
      buildShades();
      renderHarmony();
    }

    let colorRenderFrame = 0;
    function scheduleColorRender() {
      if (colorRenderFrame) return;
      colorRenderFrame = window.requestAnimationFrame(() => {
        colorRenderFrame = 0;
        renderColor();
      });
    }

    function applyHex(hex, { skipHexInput = false } = {}) {
      const rgb = hexToRgb(hex);
      if (!rgb) return false;
      state = rgbToHsl(...rgb);
      renderColor({ skipHexInput });
      return true;
    }

    hueSlider.addEventListener("input", () => {
      state.h = Number(hueSlider.value);
      scheduleColorRender();
    });
    satSlider.addEventListener("input", () => {
      state.s = Number(satSlider.value);
      scheduleColorRender();
    });
    lightSlider.addEventListener("input", () => {
      state.l = Number(lightSlider.value);
      scheduleColorRender();
    });

    picker.addEventListener("input", () => {
      const rgb = hexToRgb(picker.value);
      if (!rgb) return;
      state = rgbToHsl(...rgb);
      scheduleColorRender();
    });
    hexInput.addEventListener("input", () => {
      const raw = hexInput.value.replace(/^#/, "");
      if (/^[0-9a-f]{6}$/i.test(raw)) {
        applyHex(raw, { skipHexInput: true });
      }
    });
    hexInput.addEventListener("change", () => {
      const raw = hexInput.value.replace(/^#/, "");
      if (!applyHex(raw)) {
        const fallback = rgbToHex(...currentRgb()).slice(1);
        hexInput.value = fallback;
        toast("请输入 6 位十六进制色值", { type: "info" });
      }
    });
    hexInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        hexInput.blur();
      }
    });

    $("#colorRandom")?.addEventListener("click", () => {
      state = {
        h: secureRandomInt(360),
        s: 58 + secureRandomInt(36),
        l: 48 + secureRandomInt(23),
      };
      scheduleColorRender();
    });

    const eyedropperButton = $("#colorEyedropper");
    if (eyedropperButton) {
      if (typeof window.EyeDropper !== "function") {
        eyedropperButton.hidden = true;
      } else {
        eyedropperButton.hidden = false;
        eyedropperButton.addEventListener("click", async () => {
          try {
            const result = await new window.EyeDropper().open();
            if (result?.sRGBHex && applyHex(result.sRGBHex)) {
              toast(`已从屏幕取色 ${result.sRGBHex.toUpperCase()}`);
            }
          } catch (error) {
            if (error?.name !== "AbortError") {
              toast("当前环境无法打开屏幕取色器", { type: "info" });
            }
          }
        });
      }
    }

    $("#colorCopyBig")?.addEventListener("click", () => {
      copyText(rgbToHex(...currentRgb()), "已复制色值");
    });

    $$('[data-copy-format]', $("#colorPreview")?.parentElement?.parentElement || document).forEach((button) => {
      if (!button.closest(".color-panel")) return;
      button.addEventListener("click", () => {
        const rgb = currentRgb();
        const format = button.dataset.copyFormat;
        if (format === "css") {
          const hex = rgbToHex(...rgb);
          const shades = [
            [50, 92],
            [100, 81],
            [200, 70],
            [300, 58],
            [400, 46],
            [500, 34],
            [600, 22],
          ];
          const variables = [
            `  --color: ${hex};`,
            `  --color-rgb: ${rgb[0]}, ${rgb[1]}, ${rgb[2]};`,
            `  --color-hsl: ${Math.round(state.h)}, ${Math.round(state.s)}%, ${Math.round(state.l)}%;`,
            ...shades.map(([step, light]) => `  --color-${step}: ${rgbToHex(...hslToRgb(state.h, state.s, light))};`),
          ].join("\n");
          copyText(`:root {\n${variables}\n}`, "CSS 颜色变量已复制");
          return;
        }
        const value =
          format === "rgb"
            ? `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`
            : format === "hsl"
              ? `hsl(${Math.round(state.h)}, ${Math.round(state.s)}%, ${Math.round(state.l)}%)`
              : rgbToHex(...rgb);
        copyText(value, `已复制 ${format.toUpperCase()} 色值`);
      });
    });

    shadeRow.addEventListener("click", (event) => {
      const swatch = event.target.closest(".shade-swatch");
      if (!swatch) return;
      applyHex(swatch.dataset.hex);
    });

    harmonyList?.addEventListener("click", (event) => {
      const swatch = event.target.closest(".harmony-swatch");
      if (!swatch) return;
      applyHex(swatch.dataset.hex);
    });

    applyHex("#5B7CFA");
    return () => {
      if (colorRenderFrame) window.cancelAnimationFrame(colorRenderFrame);
    };
  }

