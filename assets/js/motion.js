/* ==========================================================================
   Motion system
   ChengYu · Lumen Toolkit
   ========================================================================== */
"use strict";

  /* ----------------------------------------------------------------------
     Motion system
     ---------------------------------------------------------------------- */
  /*
    动效只做反馈，不参与布局：
    - segmented 指示块在尺寸变化时重新测量；
    - scroll progress DOM 仍保留，但当前视觉层已隐藏；
    - 只改 transform / opacity；
    - prefers-reduced-motion 下全部降级为静态。
  */
  function syncSegmentedThumb(group) {
    if (!group) return;
    const thumb = group.querySelector(":scope > .seg-thumb");
    const active = group.querySelector("button.is-active");
    if (!thumb || !active) return;
    thumb.style.width = `${active.offsetWidth}px`;
    thumb.style.transform = `translate3d(${active.offsetLeft}px, 0, 0)`;
    thumb.style.opacity = "1";
    if (!thumb.classList.contains("is-ready")) {
      window.requestAnimationFrame(() => thumb.classList.add("is-ready"));
    }
  }

  function enhanceSegmentedControls(scope = document) {
    $$(".segmented", scope).forEach((group) => {
      if (group.dataset.motionReady === "true") {
        syncSegmentedThumb(group);
        return;
      }
      const thumb = document.createElement("span");
      thumb.className = "seg-thumb";
      thumb.setAttribute("aria-hidden", "true");
      group.prepend(thumb);
      group.classList.add("has-thumb");
      group.dataset.motionReady = "true";
      syncSegmentedThumb(group);
    });
  }

  let scrollMaxHeight = 0;

  function measureScrollProgress() {
    scrollMaxHeight = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  }

  function updateScrollProgress() {
    const indicator = $("#scrollProgress");
    if (!indicator) return;
    if (!scrollMaxHeight) measureScrollProgress();
    const value = scrollMaxHeight > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollMaxHeight)) : 0;
    indicator.style.transform = `scaleX(${value})`;
  }

  function refreshScrollMetrics() {
    window.requestAnimationFrame(() => {
      measureScrollProgress();
      updateScrollProgress();
    });
  }

  function initMotionSystem() {
    document.addEventListener("click", (event) => {
      const group = event.target.closest(".segmented");
      if (!group) return;
      window.requestAnimationFrame(() => syncSegmentedThumb(group));
    });

    let resizeFrame = 0;
    window.addEventListener(
      "resize",
      () => {
        if (resizeFrame) return;
        resizeFrame = window.requestAnimationFrame(() => {
          $$(".segmented").forEach(syncSegmentedThumb);
          measureScrollProgress();
          updateScrollProgress();
          resizeFrame = 0;
        });
      },
      { passive: true }
    );

    const heroArt = $(".hero-art");
    if (heroArt) {
      if (reducedMotion || !("IntersectionObserver" in window)) {
        heroArt.classList.add("is-animated");
      } else {
        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              heroArt.classList.toggle("is-animated", entry.isIntersecting);
            });
          },
          { rootMargin: "80px 0px", threshold: 0.01 }
        );
        observer.observe(heroArt);
      }
    }
    measureScrollProgress();
    updateScrollProgress();
  }

