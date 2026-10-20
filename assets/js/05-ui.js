/* ==========================================================================
   Theme, live time and shared QR rendering
   ChengYu · Lumen Toolkit
   ========================================================================== */
"use strict";

  /* ----------------------------------------------------------------------
     Theme
     ---------------------------------------------------------------------- */
  const THEME_COLORS = { light: "#f3f0ea", dark: "#07080b" };
  let themeTransitioning = false;

  /*
    主题切换有两种路径：
    - 支持 View Transition 且未要求减少动效：从按钮位置做圆形揭示；
    - 否则直接切换 class / color-scheme，不阻塞 UI。
    主题值始终写入 localStorage，启动时由 index.html 的内联脚本提前读取。
  */
  function applyTheme(theme) {
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", THEME_COLORS[theme]);
    const toggle = $("#themeToggle");
    if (toggle) toggle.setAttribute("aria-label", theme === "dark" ? "切换到浅色模式" : "切换到深色模式");
    try {
      localStorage.setItem("lumen.theme", theme);
    } catch (error) {
      /* no-op */
    }
  }

  function toggleTheme(event) {
    const current = root.dataset.theme === "dark" ? "dark" : "light";
    const next = current === "dark" ? "light" : "dark";
    const target =
      (event?.target instanceof Element
        ? event.target.closest("[data-theme-action], #themeToggle")
        : null) || $("#themeToggle");

    if (themeTransitioning) return;

    const animateTrigger = () => {
      if (reducedMotion) return;
      target?.animate(
        [
          { transform: "scale(1)" },
          { transform: "scale(0.9)" },
          { transform: "scale(1)" },
        ],
        { duration: 260, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
      );
    };

    if (reducedMotion || typeof document.startViewTransition !== "function") {
      applyTheme(next);
      animateTrigger();
      return;
    }

    const rect = target?.getBoundingClientRect();
    const originX = rect ? rect.left + rect.width / 2 : window.innerWidth * 0.82;
    const originY = rect ? rect.top + rect.height / 2 : 48;
    const radius =
      Math.hypot(
        Math.max(originX, window.innerWidth - originX),
        Math.max(originY, window.innerHeight - originY)
      ) + 24;

    root.style.setProperty("--theme-x", `${originX}px`);
    root.style.setProperty("--theme-y", `${originY}px`);
    root.style.setProperty("--theme-radius", `${radius}px`);

    let transition;
    try {
      transition = document.startViewTransition(() => applyTheme(next));
    } catch (error) {
      root.style.removeProperty("--theme-x");
      root.style.removeProperty("--theme-y");
      root.style.removeProperty("--theme-radius");
      applyTheme(next);
      animateTrigger();
      return;
    }

    themeTransitioning = true;
    Promise.resolve(transition.finished)
      .catch(() => {})
      .then(() => {
        themeTransitioning = false;
        root.style.removeProperty("--theme-x");
        root.style.removeProperty("--theme-y");
        root.style.removeProperty("--theme-radius");
        animateTrigger();
      });
  }

  /* ----------------------------------------------------------------------
     Live time
     ---------------------------------------------------------------------- */
  const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

  function two(value) {
    return String(value).padStart(2, "0");
  }

  function timeZoneLabel(date = new Date()) {
    const offset = -date.getTimezoneOffset();
    const sign = offset >= 0 ? "+" : "-";
    const hours = two(Math.floor(Math.abs(offset) / 60));
    const minutes = two(Math.abs(offset) % 60);
    return `UTC${sign}${hours}:${minutes}`;
  }

  function updateLiveClock() {
    const now = new Date();
    const clock = `${two(now.getHours())}:${two(now.getMinutes())}`;
    const seconds = `:${two(now.getSeconds())}`;
    const date = `${now.getMonth() + 1}月${now.getDate()}日 ${WEEKDAYS[now.getDay()]}`;
    const zone = timeZoneLabel(now);

    const write = (node, value) => {
      if (node.textContent !== value) node.textContent = value;
    };

    $$("[data-now-clock]").forEach((node) => write(node, clock));
    $$("[data-now-clock-seconds]").forEach((node) => write(node, seconds));
    $$("[data-now-date]").forEach((node) => write(node, date));
    $$("[data-now-seconds]").forEach((node) => {
      write(node, String(Math.floor(Date.now() / 1000)));
    });
    $$("[data-now-ms]").forEach((node) => {
      write(node, String(Date.now()));
    });
    $$("[data-tz]").forEach((node) => write(node, zone));
    if (clockDialog?.open) updateClockScreen(now);
  }

  function startClock() {
    updateLiveClock();
    window.clearInterval(clockTimer);
    clockTimer = window.setInterval(updateLiveClock, 1000);
  }

  /* ----------------------------------------------------------------------
     QR rendering (shared by the hero ornament and the QR tool)
     ---------------------------------------------------------------------- */
  /*
    二维码库不在首屏加载：只有真正打开二维码工具时才由 loadQrLibrary()
    插入本地 vendor/qrcode.js。useUtf8Qr() 把 qrcode-generator 的字节转换
    固定为 UTF-8，保证中文和任意 Unicode 都能正确编码。
  */
  function useUtf8Qr() {
    if (typeof window.qrcode === "function" && window.qrcode.stringToBytesFuncs?.["UTF-8"]) {
      window.qrcode.stringToBytes = window.qrcode.stringToBytesFuncs["UTF-8"];
    }
  }

  function drawQr(canvas, text, options = {}) {
    if (!canvas || typeof window.qrcode !== "function") return null;
    useUtf8Qr();
    const {
      size = 640,
      margin = 4,
      foreground = "#141418",
      background = "#ffffff",
      level = "M",
    } = options;

    const qr = window.qrcode(0, level);
    qr.addData(text, "Byte");
    qr.make();

    const count = qr.getModuleCount();
    const total = count + margin * 2;
    const cell = size / total;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = foreground;

    for (let row = 0; row < count; row += 1) {
      for (let column = 0; column < count; column += 1) {
        if (!qr.isDark(row, column)) continue;
        const left = Math.round((column + margin) * cell);
        const top = Math.round((row + margin) * cell);
        const right = Math.round((column + margin + 1) * cell);
        const bottom = Math.round((row + margin + 1) * cell);
        ctx.fillRect(left, top, right - left, bottom - top);
      }
    }
    return qr;
  }

  let qrLibraryPromise = null;

  function loadQrLibrary() {
    if (typeof window.qrcode === "function") return Promise.resolve();
    if (qrLibraryPromise) return qrLibraryPromise;

    qrLibraryPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "assets/vendor/qrcode.js";
      script.async = true;
      script.onload = () => {
        if (typeof window.qrcode === "function") {
          useUtf8Qr();
          resolve();
        } else {
          qrLibraryPromise = null;
          reject(new Error("QR library unavailable"));
        }
      };
      script.onerror = () => {
        qrLibraryPromise = null;
        reject(new Error("QR library failed to load"));
      };
      document.head.appendChild(script);
    });

    return qrLibraryPromise;
  }

