/* ==========================================================================
   Application boot, hero orbit and button feedback
   ChengYu · Lumen Toolkit
   ========================================================================== */
"use strict";

  /* ----------------------------------------------------------------------
     Boot
     ---------------------------------------------------------------------- */
  /*
    启动阶段只做一次性的页面增强：
    - 渲染首页友情链接；
    - 初始化 Hero 信息卡轨道和拖动；
    - 给按钮加轻量按压反馈；
    - 最后进入 initApp()，由首页 / 路由接管交互。
    具体工具不在这里初始化。
  */
  function renderFriendLinks() {
    const grid = $("#friendsGrid");
    if (!grid) return;
    grid.innerHTML = FRIEND_LINKS.map(
      (friend) => `
        <a class="friend-card" href="${friend.url}" target="_blank" rel="noopener noreferrer" aria-label="打开 ${friend.name}（新标签页）">
          <span class="friend-mark tool-icon tint-${friend.tint}" aria-hidden="true">${friend.mark}</span>
          <span class="friend-copy">
            <span class="friend-title"><strong>${friend.name}</strong><span class="friend-tag">${friend.tag}</span></span>
            <small>${friend.desc}</small>
          </span>
          <span class="friend-arrow" aria-hidden="true">${icon("arrow-up-right")}</span>
        </a>`
    ).join("");
  }

  function initCardOrbit() {
    const orbit = $("#cardOrbit");
    if (!orbit) return;
    let angle = 0;
    let dragging = false;
    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let startPointerAngle = 0;
    let startOrbitAngle = 0;
    let lastMoveTime = 0;
    let velocity = 0;
    let moved = false;
    let suppressClick = false;
    let suppressTimer = 0;
    let inertiaFrame = 0;
    let pointerFrame = 0;
    let pendingAngle = 0;
    let orbitRect = null;

    const setAngle = (next) => {
      angle = next;
      orbit.style.setProperty("--orbit-angle", `${angle}deg`);
      const normalized = ((Math.round(angle) % 360) + 360) % 360;
      orbit.setAttribute("aria-valuenow", String(normalized));
      orbit.setAttribute("aria-valuetext", `旋转 ${normalized} 度`);
    };

    const scheduleAngle = (next) => {
      pendingAngle = next;
      if (pointerFrame) return;
      pointerFrame = window.requestAnimationFrame(() => {
        pointerFrame = 0;
        setAngle(pendingAngle);
      });
    };

    const flushAngle = () => {
      if (pointerFrame) {
        window.cancelAnimationFrame(pointerFrame);
        pointerFrame = 0;
      }
      setAngle(pendingAngle);
    };

    const stopInertia = () => {
      if (inertiaFrame) window.cancelAnimationFrame(inertiaFrame);
      inertiaFrame = 0;
    };

    const startInertia = () => {
      if (reducedMotion || Math.abs(velocity) < 0.06) return;
      velocity = Math.max(-1.8, Math.min(1.8, velocity));
      const step = () => {
        angle += velocity;
        velocity *= 0.94;
        setAngle(angle);
        if (Math.abs(velocity) > 0.025) {
          inertiaFrame = window.requestAnimationFrame(step);
        } else {
          inertiaFrame = 0;
        }
      };
      inertiaFrame = window.requestAnimationFrame(step);
    };

    const pointerAngle = (event) => {
      const rect = orbitRect || orbit.getBoundingClientRect();
      return (
        (Math.atan2(
          event.clientY - (rect.top + rect.height / 2),
          event.clientX - (rect.left + rect.width / 2)
        ) *
          180) /
        Math.PI
      );
    };

    const clearSuppression = () => {
      if (suppressTimer) window.clearTimeout(suppressTimer);
      suppressTimer = 0;
      suppressClick = false;
    };

    orbit.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      stopInertia();
      if (pointerFrame) {
        window.cancelAnimationFrame(pointerFrame);
        pointerFrame = 0;
      }
      clearSuppression();
      dragging = true;
      pointerId = event.pointerId;
      orbitRect = orbit.getBoundingClientRect();
      startX = event.clientX;
      startY = event.clientY;
      startPointerAngle = pointerAngle(event);
      startOrbitAngle = angle;
      pendingAngle = angle;
      lastMoveTime = performance.now();
      velocity = 0;
      moved = false;
      orbit.classList.add("is-holding");
    });

    orbit.addEventListener("pointermove", (event) => {
      if (!dragging || event.pointerId !== pointerId) return;
      const distance = Math.hypot(event.clientX - startX, event.clientY - startY);
      if (!moved && distance < 5) return;
      if (!moved) {
        moved = true;
        orbit.classList.add("is-dragging");
        orbit.setPointerCapture?.(event.pointerId);
      }
      let pointerDelta = pointerAngle(event) - startPointerAngle;
      while (pointerDelta > 180) pointerDelta -= 360;
      while (pointerDelta < -180) pointerDelta += 360;
      const next = startOrbitAngle + pointerDelta;
      const now = performance.now();
      if (now - lastMoveTime < 90) {
        velocity = ((next - angle) / Math.max(1, now - lastMoveTime)) * 16;
      } else {
        velocity = 0;
      }
      lastMoveTime = now;
      scheduleAngle(next);
      if (event.pointerType !== "touch") event.preventDefault();
    });

    const finishDrag = (event) => {
      if (!dragging || (event && event.pointerId !== pointerId)) return;
      dragging = false;
      pointerId = null;
      orbit.classList.remove("is-holding", "is-dragging");
      if (moved) flushAngle();
      orbitRect = null;
      if (event && orbit.hasPointerCapture?.(event.pointerId)) orbit.releasePointerCapture?.(event.pointerId);
      if (moved) {
        suppressClick = true;
        suppressTimer = window.setTimeout(clearSuppression, 420);
        if (performance.now() - lastMoveTime > 90) velocity = 0;
        startInertia();
      }
    };

    orbit.addEventListener("pointerup", finishDrag);
    orbit.addEventListener("pointercancel", finishDrag);
    orbit.addEventListener("lostpointercapture", () => {
      if (!dragging) return;
      dragging = false;
      pointerId = null;
      orbit.classList.remove("is-holding", "is-dragging");
      orbitRect = null;
    });
    orbit.addEventListener(
      "click",
      (event) => {
        if (!suppressClick) return;
        event.preventDefault();
        event.stopPropagation();
        clearSuppression();
      },
      true
    );

    orbit.addEventListener("keydown", (event) => {
      const step = event.shiftKey ? 30 : 8;
      let next = null;
      if (event.key === "ArrowRight" || event.key === "ArrowUp") next = angle + step;
      else if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = angle - step;
      else if (event.key === "Home") next = 0;
      if (next === null) return;
      event.preventDefault();
      stopInertia();
      if (pointerFrame) {
        window.cancelAnimationFrame(pointerFrame);
        pointerFrame = 0;
      }
      pendingAngle = next;
      setAngle(next);
    });
  }

  function initButtonJelly() {
    const animations = new WeakMap();
    document.addEventListener("pointerdown", (event) => {
      if (reducedMotion || (event.pointerType === "mouse" && event.button !== 0)) return;
      const button = event.target instanceof Element ? event.target.closest("button") : null;
      if (!button || button.disabled || button.getAttribute("aria-disabled") === "true") return;
      if (button.closest("#cardOrbit")) return;
      const previous = animations.get(button);
      if (previous) previous.cancel();
      const animation = button.animate(
        [
          { transform: "scale(1)" },
          { transform: "scale(0.94, 0.96)", offset: 0.18 },
          { transform: "scale(1.035, 0.985)", offset: 0.62 },
          { transform: "scale(1)" },
        ],
        {
          duration: 420,
          easing: "cubic-bezier(0.22, 1.4, 0.36, 1)",
        }
      );
      animations.set(button, animation);
      animation.finished
        .catch(() => {})
        .finally(() => {
          if (animations.get(button) === animation) animations.delete(button);
        });
    });
  }

  function initApp() {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    $$("[data-tool-total]").forEach((node) => {
      node.textContent = String(TOOLS.length);
    });

    const initialTheme = root.dataset.theme === "dark" ? "dark" : "light";
    applyTheme(initialTheme);
    syncShortcutLabels();
    renderToolGrid();
    renderFriendLinks();
    updateFavoriteUI();
    renderRecent();
    startClock();
    initModalBindings();
    initHomeInteractions();
    initMotionSystem();
    bindCardPointer();
    initCardOrbit();
    initButtonJelly();
    enhanceSegmentedControls();
    setTimeout(syncShortcutLabels, 0);

    const route = parseRoute();
    if (route.view === "tool") {
      window.history.replaceState(
        { view: "tool", fromHome: false, homeScroll: 0 },
        "",
        `#/tool/${route.id}`
      );
      renderToolPage(route.id);
    } else {
      window.history.replaceState(
        { view: "home" },
        "",
        `${window.location.pathname}${window.location.search}`
      );
      showHomePage({ restoreScroll: false });
    }

    window.addEventListener("popstate", handlePopState);
  }

