/* ==========================================================================
   Core helpers, DOM utilities and shared text helpers
   ========================================================================== */
"use strict";

  /* ----------------------------------------------------------------------
     Small helpers
     ---------------------------------------------------------------------- */
  /*
    所有工具共享的最小运行时：
    - `$` / `$$`：带 scope 的 querySelector 包装，避免重复写 querySelectorAll。
    - `reducedMotion` / `canHover`：只在启动时读取一次，后续按此降级。
    - `icon()`：生成内联 SVG use 引用，图标 sprite 在 index.html 中。
    - `wait()`：只用于少量一次性交互，不用于渲染循环。
  */
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
  const root = document.documentElement;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);
  const shortcutLabel = isMac ? "⌘ K" : "Ctrl K";
  const modLabel = isMac ? "⌘" : "Ctrl";

  const icon = (name, extraClass = "") =>
    `<svg class="icon ${extraClass}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  /*
    文件大小格式化：按 1024 进制选择单位。
    0 / 非有限值直接返回 "0 B"，避免出现 NaN 或负单位。
  */
  function formatBytes(bytes, decimals = 1) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / 1024 ** index;
    return `${value.toFixed(index === 0 ? 0 : decimals).replace(/\.0$/, "")} ${units[index]}`;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  /*
    debounce 返回的函数带有 `.cancel()`，工具 cleanup 或路由切换时可以取消
    尚未执行的输入分析，避免在已销毁的 DOM 上跑回调。
  */
  function debounce(fn, delay = 160) {
    let timer = 0;
    const wrapped = (...args) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => fn(...args), delay);
    };
    wrapped.cancel = () => window.clearTimeout(timer);
    return wrapped;
  }

  function isTypingTarget(target) {
    if (!(target instanceof Element)) return false;
    return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
  }

  function animateStagger(container, selector, { limit = 12, distance = 7, duration = 340 } = {}) {
    if (!container || reducedMotion || typeof Element.prototype.animate !== "function") return;
    Array.from(container.querySelectorAll(selector))
      .slice(0, limit)
      .forEach((element, index) => {
        element.getAnimations().forEach((animation) => {
          if (animation.id === "stagger-in") animation.cancel();
        });
        element.animate(
          [
            { opacity: 0, transform: `translateY(${distance}px)` },
            { opacity: 1, transform: "translateY(0)" },
          ],
          {
            id: "stagger-in",
            duration,
            delay: Math.min(index, 10) * 24,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
            fill: "both",
          }
        );
      });
  }

  /*
    滚动位置归零要绕过全局的 `scroll-behavior: smooth`：
    先临时改成 auto，强制一次布局，再恢复。工具页进入和退出都依赖它，
    否则旧页动画还没结束时会看到新页从中间位置开始。
  */
  let scrollBehaviorRestore = null;
  let scrollRestoreFrame = 0;

  function scrollInstant(top = 0) {
    if (scrollBehaviorRestore === null) {
      scrollBehaviorRestore = root.style.scrollBehavior;
    }
    root.style.scrollBehavior = "auto";
    // Flush the style change so the browser does not keep a pending smooth scroll.
    void root.offsetHeight;
    try {
      window.scrollTo({ top, left: 0, behavior: "instant" });
    } catch (error) {
      window.scrollTo(0, top);
    }
    const scrollingElement = document.scrollingElement || root;
    if (Math.abs(scrollingElement.scrollTop - top) > 1) {
      scrollingElement.scrollTop = top;
    }
    window.cancelAnimationFrame(scrollRestoreFrame);
    scrollRestoreFrame = window.requestAnimationFrame(() => {
      root.style.scrollBehavior = scrollBehaviorRestore;
      scrollBehaviorRestore = null;
      scrollRestoreFrame = 0;
    });
  }

  function scrollToTop({ smooth = true } = {}) {
    window.scrollTo({ top: 0, behavior: smooth && !reducedMotion ? "smooth" : "auto" });
  }

  /*
    localStorage 的安全封装：
    隐私模式 / 文件协议受限 / 配额满时，读写失败不能让整个应用崩溃。
    -- get 带 fallback，set 失败静默降级为仅当前页面有效。
  */
  function safeStorageGet(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch (error) {
      return fallback;
    }
  }

  function safeStorageSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      /* Storage can be unavailable in private windows. The app still works. */
    }
  }

  /*
    所有插入 innerHTML 的用户可见文本都先经过这两个函数。
    escapeHTML 负责文本节点，escapeAttribute 额外处理属性引号。
  */
  function escapeHTML(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function escapeAttribute(value) {
    return escapeHTML(value)
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }


  function normalizePaletteText(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
