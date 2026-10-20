/* ==========================================================================
   About, author and clock overlay screens
   ChengYu · Lumen Toolkit
   ========================================================================== */
"use strict";

  /* ----------------------------------------------------------------------
     About dialog
     ---------------------------------------------------------------------- */
  /*
    四个覆盖层共享的原生 <dialog> 约定见下方 About / Author / Clock。
    进入时 showModal() 保留焦点陷阱，body.modal-open 锁背景滚动；
    关闭只执行 close() 和退出动画，不销毁内部 DOM。
    时钟是例外：秒表 / 倒计时的计时循环只在 dialog 打开期间运行。
  */
  function openAbout() {
    if (paletteDialog.open) closePalette({ instant: true });
    if (authorDialog.open) closeAuthor({ instant: true });
    if (clockDialog.open) closeClock({ instant: true });
    aboutClosing = false;
    aboutDialog.classList.remove("is-closing");
    aboutSurface.classList.remove("is-closing");
    if (!aboutDialog.open) aboutDialog.showModal();
    document.body.classList.add("modal-open");
    window.requestAnimationFrame(() => $("#aboutClose")?.focus());
  }

  function closeAbout({ instant = false } = {}) {
    if (!aboutDialog.open || aboutClosing) return;
    if (instant || reducedMotion) {
      aboutDialog.close();
      aboutDialog.classList.remove("is-closing");
      aboutSurface.classList.remove("is-closing");
      aboutClosing = false;
      return;
    }
    aboutClosing = true;
    aboutDialog.classList.add("is-closing");
    aboutSurface.classList.add("is-closing");
    window.setTimeout(() => {
      if (aboutDialog.open) aboutDialog.close();
      aboutDialog.classList.remove("is-closing");
      aboutSurface.classList.remove("is-closing");
      aboutClosing = false;
    }, 170);
  }

  let authorOpeningTimer = 0;

  function openAuthor(source = null) {
    if (!authorDialog) return;
    if (paletteDialog.open) closePalette({ instant: true });
    if (aboutDialog.open) closeAbout({ instant: true });
    if (clockDialog.open) closeClock({ instant: true });
    if (authorDialog.open) {
      $("#authorClose")?.focus();
      return;
    }
    window.clearTimeout(authorOpeningTimer);
    authorClosing = false;
    authorDialog.classList.remove("is-closing", "is-opening");
    if (authorScreen) authorScreen.scrollTop = 0;
    const rect = source instanceof Element ? source.getBoundingClientRect() : null;
    const originX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const originY = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
    authorDialog.style.setProperty("--author-x", `${originX}px`);
    authorDialog.style.setProperty("--author-y", `${originY}px`);
    authorDialog.classList.add("is-opening");
    authorDialog.showModal();
    document.body.classList.add("modal-open");
    authorOpeningTimer = window.setTimeout(() => {
      authorDialog.classList.remove("is-opening");
      authorOpeningTimer = 0;
    }, 1100);
    window.requestAnimationFrame(() => $("#authorClose")?.focus());
  }

  function closeAuthor({ instant = false } = {}) {
    if (!authorDialog?.open || authorClosing) return;
    window.clearTimeout(authorOpeningTimer);
    authorOpeningTimer = 0;
    authorDialog.classList.remove("is-opening");
    if (instant || reducedMotion) {
      authorDialog.close();
      authorDialog.classList.remove("is-closing");
      authorClosing = false;
      return;
    }
    authorClosing = true;
    authorDialog.classList.add("is-closing");
    window.setTimeout(() => {
      if (authorDialog.open) authorDialog.close();
      authorDialog.classList.remove("is-closing");
      authorClosing = false;
    }, 340);
  }

  function goFromAuthorToTools() {
    closeAuthor();
    const action = () => {
      $("#tools")?.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "start",
      });
    };
    if (reducedMotion) {
      goHomeWith(action);
      return;
    }
    window.setTimeout(() => goHomeWith(action), 340);
  }

  function applyClockSettings() {
    if (clockEls.format) {
      clockEls.format.textContent = clockSettings.hours24 ? "24 小时" : "12 小时";
      clockEls.format.setAttribute(
        "aria-label",
        clockSettings.hours24 ? "切换为 12 小时制" : "切换为 24 小时制"
      );
    }
    if (clockEls.secondsToggle) {
      clockEls.secondsToggle.textContent = "显示秒";
      clockEls.secondsToggle.setAttribute("aria-pressed", String(clockSettings.seconds));
      clockEls.secondsToggle.classList.toggle("is-on", clockSettings.seconds);
    }
    updateFocusControls();
    updateClockScreen(new Date());
  }

  function updateClockScreen(now = new Date()) {
    if (!clockEls.time) return;
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    const hour12 = hours % 12 || 12;
    const displayHour = clockSettings.hours24 ? hours : hour12;
    const secondsText = `:${two(seconds)}`;
    const write = (node, value) => {
      if (node && node.textContent !== value) node.textContent = value;
    };

    write(clockEls.time, `${two(displayHour)}:${two(minutes)}`);
    const secondsChanged = clockEls.seconds?.textContent !== secondsText;
    write(clockEls.seconds, secondsText);
    if (clockEls.focusPreview) {
      clockEls.focusPreview.textContent = `${two(displayHour)}:${two(minutes)}${clockSettings.seconds ? `:${two(seconds)}` : ""}`;
    }
    if (clockEls.seconds) clockEls.seconds.hidden = !clockSettings.seconds;
    if (clockEls.period) {
      clockEls.period.hidden = clockSettings.hours24;
      clockEls.period.textContent = hours < 12 ? "上午" : "下午";
    }

    const daypart =
      hours < 5 ? "night" : hours < 8 ? "dawn" : hours < 17 ? "day" : hours < 20 ? "dusk" : "evening";
    if (clockScreen) clockScreen.dataset.daypart = daypart;
    if (clockEls.focusRule) clockEls.focusRule.style.transform = `scaleX(${seconds / 60})`;
    if (
      secondsChanged &&
      clockSettings.seconds &&
      clockScreen?.classList.contains("is-focus") &&
      !reducedMotion &&
      clockEls.seconds
    ) {
      clockEls.seconds.animate(
        [
          { opacity: 0.28, transform: "translateY(-5px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
        { duration: 250, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
      );
    }

    const dateText = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 · ${WEEKDAYS[now.getDay()]}`;
    write(clockEls.date, dateText);
    write(clockEls.zone, `${timeZoneLabel(now)} · ${localTimeZone}`);

    const daySeconds = hours * 3600 + minutes * 60 + seconds;
    const dayRatio = daySeconds / 86400;
    const weekIndex = (now.getDay() + 6) % 7;
    const weekRatio = (weekIndex * 86400 + daySeconds) / 604800;
    const startOfYear = Date.UTC(now.getFullYear(), 0, 1);
    const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const dayOfYear = Math.floor((todayUtc - startOfYear) / 86400000) + 1;
    const yearDays =
      (now.getFullYear() % 4 === 0 && now.getFullYear() % 100 !== 0) ||
      now.getFullYear() % 400 === 0
        ? 366
        : 365;
    const yearRatio = dayOfYear / yearDays;
    const percent = (ratio) => `${(ratio * 100).toFixed(1)}%`;

    write(clockEls.dayProgress, percent(dayRatio));
    write(clockEls.dayMetric, percent(dayRatio));
    write(clockEls.weekMetric, percent(weekRatio));
    write(clockEls.yearMetric, percent(yearRatio));
    if (clockEls.dayBar) clockEls.dayBar.style.width = `${Math.min(100, dayRatio * 100)}%`;
    if (clockEls.weekBar) clockEls.weekBar.style.width = `${Math.min(100, weekRatio * 100)}%`;
    if (clockEls.yearBar) clockEls.yearBar.style.width = `${Math.min(100, yearRatio * 100)}%`;
    clockEls.dayRing?.style.setProperty("--day-angle", `${dayRatio * 360}deg`);

    const hourAngle = (hours % 12) * 30 + minutes * 0.5 + seconds / 120;
    const minuteAngle = minutes * 6 + seconds * 0.1;
    const secondAngle = seconds * 6;
    clockEls.hourHand?.style.setProperty("--angle", `${hourAngle}deg`);
    clockEls.minuteHand?.style.setProperty("--angle", `${minuteAngle}deg`);
    clockEls.secondHand?.style.setProperty("--angle", `${secondAngle}deg`);

    const zoneCity = localTimeZone.split("/").pop()?.replace(/_/g, " ") || "LOCAL";
    write(
      clockEls.dialCaption,
      `${clockSettings.hours24 ? "24H" : "12H"} · ${zoneCity.toUpperCase()}`
    );
  }

  function formatStopwatch(ms) {
    const totalCentiseconds = Math.max(0, Math.floor(ms / 10));
    const centiseconds = totalCentiseconds % 100;
    const totalSeconds = Math.floor(totalCentiseconds / 100);
    const seconds = totalSeconds % 60;
    const totalMinutes = Math.floor(totalSeconds / 60);
    const minutes = totalMinutes % 60;
    const hours = Math.floor(totalMinutes / 60);
    return hours
      ? `${hours}:${two(minutes)}:${two(seconds)}.${two(centiseconds)}`
      : `${two(minutes)}:${two(seconds)}.${two(centiseconds)}`;
  }

  function formatCountdown(ms) {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const hours = Math.floor(totalSeconds / 3600);
    return hours ? `${hours}:${two(minutes)}:${two(seconds)}` : `${two(minutes)}:${two(seconds)}`;
  }

  function stopwatchValue(now = performance.now()) {
    return stopwatch.elapsed + (stopwatch.running ? now - stopwatch.startedAt : 0);
  }

  function countdownValue(now = performance.now()) {
    return countdown.running ? Math.max(0, countdown.endAt - now) : countdown.remaining;
  }

  function renderStopwatch() {
    if (clockEls.stopwatchDisplay) {
      clockEls.stopwatchDisplay.textContent = formatStopwatch(stopwatchValue());
    }
    if (clockEls.stopwatchToggle) {
      clockEls.stopwatchToggle.textContent = stopwatch.running ? "暂停" : stopwatch.elapsed > 0 ? "继续" : "开始";
    }
  }

  function renderCountdown() {
    if (clockEls.countdownDisplay) {
      clockEls.countdownDisplay.textContent = formatCountdown(countdownValue());
    }
    if (clockEls.countdownToggle) {
      clockEls.countdownToggle.textContent = countdown.running
        ? "暂停"
        : countdown.remaining <= 0
          ? "重新开始"
          : countdown.remaining < countdown.total
            ? "继续"
            : "开始";
    }
  }

  function stopClockTimerLoop() {
    if (clockTimerLoop) window.clearInterval(clockTimerLoop);
    clockTimerLoop = 0;
  }

  function ensureClockTimerLoop() {
    if (!stopwatch.running && !countdown.running) {
      stopClockTimerLoop();
      return;
    }
    if (clockTimerLoop) return;
    clockTimerLoop = window.setInterval(updateClockTimers, 32);
  }

  function updateClockTimers() {
    if (stopwatch.running) renderStopwatch();
    if (countdown.running) {
      const remaining = countdownValue();
      countdown.remaining = remaining;
      if (remaining <= 0) {
        countdown.running = false;
        countdown.remaining = 0;
        clockEls.countdownCard?.classList.add("is-finished");
      }
      renderCountdown();
    }
    ensureClockTimerLoop();
  }

  function toggleStopwatch() {
    if (stopwatch.running) {
      stopwatch.elapsed += performance.now() - stopwatch.startedAt;
      stopwatch.running = false;
    } else {
      stopwatch.startedAt = performance.now();
      stopwatch.running = true;
    }
    renderStopwatch();
    ensureClockTimerLoop();
  }

  function resetStopwatch() {
    stopwatch.running = false;
    stopwatch.startedAt = 0;
    stopwatch.elapsed = 0;
    renderStopwatch();
    ensureClockTimerLoop();
  }

  function toggleCountdown() {
    if (countdown.running) {
      countdown.remaining = countdownValue();
      countdown.running = false;
    } else {
      if (countdown.remaining <= 0) countdown.remaining = countdown.total;
      countdown.endAt = performance.now() + countdown.remaining;
      countdown.running = true;
      clockEls.countdownCard?.classList.remove("is-finished");
    }
    renderCountdown();
    ensureClockTimerLoop();
  }

  function resetCountdown(nextTotal = countdown.total) {
    countdown.total = nextTotal;
    countdown.remaining = nextTotal;
    countdown.running = false;
    clockEls.countdownCard?.classList.remove("is-finished");
    clockEls.countdownPresets.forEach((button) => {
      button.classList.toggle("is-active", Number(button.dataset.countdown) * 1000 === nextTotal);
    });
    renderCountdown();
    ensureClockTimerLoop();
  }

  function saveFocusPrefs() {
    safeStorageSet("lumen.clockFocus", focusPrefs);
  }

  function updateFocusControls() {
    const format = `${clockSettings.hours24 ? "24" : "12"}${clockSettings.seconds ? "s" : ""}`;
    clockEls.focusFormatButtons.forEach((button) => {
      const active = button.dataset.focusFormat === format;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    clockEls.focusStyleButtons.forEach((button) => {
      const active = button.dataset.focusStyle === focusPrefs.style;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    clockEls.focusWeightButtons.forEach((button) => {
      const active = button.dataset.focusWeight === focusPrefs.weight;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    clockEls.focusAlignButtons.forEach((button) => {
      const active = button.dataset.focusAlign === focusPrefs.align;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    clockEls.focusAtmosphereButtons.forEach((button) => {
      const active = button.dataset.focusAtmosphere === focusPrefs.atmosphere;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    clockEls.focusGlowButtons.forEach((button) => {
      const active = (button.dataset.focusGlow === "on") === focusPrefs.glow;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    if (clockEls.focusSize) clockEls.focusSize.value = String(focusPrefs.size);
    if (clockEls.focusSizeValue) clockEls.focusSizeValue.textContent = `${focusPrefs.size}%`;
    if (clockEls.focusTracking) clockEls.focusTracking.value = String(Math.round(focusPrefs.tracking * 100));
    if (clockEls.focusTrackingValue) clockEls.focusTrackingValue.textContent = `${focusPrefs.tracking.toFixed(2)}em`;
    if (clockEls.focusOffset) clockEls.focusOffset.value = String(focusPrefs.offset);
    if (clockEls.focusOffsetValue) {
      const offset = Math.round(focusPrefs.offset);
      clockEls.focusOffsetValue.textContent = `${offset > 0 ? "+" : ""}${offset}vh`;
    }
  }

  function applyFocusPrefs() {
    if (!clockScreen) return;
    clockScreen.style.setProperty("--focus-scale", String(focusPrefs.size / 100));
    clockScreen.style.setProperty("--focus-weight", String(FOCUS_WEIGHTS[focusPrefs.weight] || 590));
    clockScreen.style.setProperty("--focus-tracking", `${focusPrefs.tracking}em`);
    clockScreen.style.setProperty("--focus-offset", `${focusPrefs.offset}vh`);
    clockScreen.dataset.focusAlign = focusPrefs.align;
    clockScreen.dataset.focusAtmosphere = focusPrefs.atmosphere;
    clockScreen.classList.toggle("focus-glow", focusPrefs.glow);
    FOCUS_STYLES.forEach((style) => {
      clockScreen.classList.toggle(`focus-style-${style}`, style === focusPrefs.style);
    });
    updateFocusControls();
  }

  function setFocusFormat(format) {
    const value = ["24", "24s", "12", "12s"].includes(format) ? format : "24";
    clockSettings.hours24 = value.startsWith("24");
    clockSettings.seconds = value.endsWith("s");
    safeStorageSet("lumen.clock", clockSettings);
    applyClockSettings();
  }

  function resetFocusPrefs() {
    focusPrefs.size = 100;
    focusPrefs.weight = "regular";
    focusPrefs.style = "minimal";
    focusPrefs.tracking = -0.06;
    focusPrefs.align = "center";
    focusPrefs.offset = 0;
    focusPrefs.atmosphere = "auto";
    focusPrefs.glow = false;
    saveFocusPrefs();
    applyFocusPrefs();
    setFocusFormat("24s");
  }

  function clearFocusChromeTimer() {
    if (focusChromeTimer) window.clearTimeout(focusChromeTimer);
    focusChromeTimer = 0;
  }

  function hideFocusChrome() {
    clearFocusChromeTimer();
    clockScreen?.classList.add("is-chrome-hidden");
  }

  function focusPanelIsOpen() {
    return Boolean(clockEls.focusPanel && !clockEls.focusPanel.hidden);
  }

  function scheduleFocusChromeHide(delay = 2800) {
    clearFocusChromeTimer();
    if (!clockScreen?.classList.contains("is-focus") || focusPanelIsOpen()) return;
    focusChromeTimer = window.setTimeout(() => {
      if (!clockScreen?.classList.contains("is-focus") || focusPanelIsOpen()) return;
      hideFocusChrome();
    }, delay);
  }

  function showFocusChrome() {
    if (!clockScreen?.classList.contains("is-focus")) return;
    clockScreen.classList.remove("is-chrome-hidden");
    if (!focusPanelIsOpen()) scheduleFocusChromeHide();
    else clearFocusChromeTimer();
  }

  function openFocusPanel() {
    const panel = clockEls.focusPanel;
    if (!panel || !clockScreen?.classList.contains("is-focus")) return;
    clearFocusChromeTimer();
    clockScreen.classList.remove("is-chrome-hidden");
    focusPanelClosing = false;
    panel.classList.remove("is-closing");
    panel.hidden = false;
    panel.classList.add("is-open");
    clockScreen.classList.add("is-panel-open");
    clockEls.focusCustomize?.setAttribute("aria-expanded", "true");
    applyFocusPrefs();
    window.requestAnimationFrame(() => {
      clockEls.focusFormatButtons.find((button) => button.classList.contains("is-active"))?.focus({
        preventScroll: true,
      });
    });
  }

  function closeFocusPanel({ instant = false, hideChrome = false } = {}) {
    const panel = clockEls.focusPanel;
    if (!panel || panel.hidden || focusPanelClosing) return;
    const finish = () => {
      panel.hidden = true;
      panel.classList.remove("is-open", "is-closing");
      clockScreen?.classList.remove("is-panel-open");
      focusPanelClosing = false;
      clockEls.focusCustomize?.setAttribute("aria-expanded", "false");
      if (hideChrome) {
        hideFocusChrome();
      } else if (clockScreen?.classList.contains("is-focus")) {
        showFocusChrome();
        clockEls.focusCustomize?.focus({ preventScroll: true });
      }
    };
    if (instant || reducedMotion) {
      finish();
      return;
    }
    focusPanelClosing = true;
    panel.classList.add("is-closing");
    window.setTimeout(finish, 180);
  }

  function setClockFocus(focus, { instant = false } = {}) {
    if (!clockScreen) return;
    const next = Boolean(focus);
    if (clockScreen.classList.contains("is-focus") === next) {
      if (next) showFocusChrome();
      return;
    }
    if (focusTransitioning) return;
    const apply = () => {
      clockScreen.classList.toggle("is-focus", next);
      if (clockEls.focusExit) clockEls.focusExit.hidden = !next;
      if (clockEls.focusCustomize) clockEls.focusCustomize.hidden = !next;
      if (next) {
        applyFocusPrefs();
        showFocusChrome();
        window.requestAnimationFrame(() => clockEls.focusExit?.focus({ preventScroll: true }));
      } else {
        clearFocusChromeTimer();
        clockScreen.classList.remove("is-chrome-hidden");
        closeFocusPanel({ instant: true, hideChrome: false });
        window.requestAnimationFrame(() => clockEls.close?.focus({ preventScroll: true }));
      }
    };
    if (instant || reducedMotion || !clockDialog.open) {
      apply();
      return;
    }
    focusTransitioning = true;
    const out = clockScreen.animate(
      [{ opacity: 1 }, { opacity: 0.22 }],
      { duration: 110, easing: "ease-in", fill: "forwards" }
    );
    out.finished
      .catch(() => {})
      .then(() => {
        apply();
        const enter = clockScreen.animate(
          [{ opacity: 0.22 }, { opacity: 1 }],
          { duration: 240, easing: "ease-out", fill: "forwards" }
        );
        enter.finished
          .catch(() => {})
          .then(() => {
            enter.cancel();
            out.cancel();
            focusTransitioning = false;
          });
      });
  }

  function openClock(sourceElement = null) {
    if (!clockDialog) return;
    const sourceRect = sourceElement?.getBoundingClientRect?.();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const rect =
      sourceRect && sourceRect.width > 0 && sourceRect.height > 0
        ? sourceRect
        : {
            left: viewportWidth / 2 - 56,
            top: viewportHeight / 2 - 24,
            right: viewportWidth / 2 + 56,
            bottom: viewportHeight / 2 + 24,
          };
    if (clockScreen) {
      clockScreen.style.setProperty("--clock-inset-top", `${Math.max(0, Math.min(rect.top, viewportHeight))}px`);
      clockScreen.style.setProperty("--clock-inset-right", `${Math.max(0, viewportWidth - rect.right)}px`);
      clockScreen.style.setProperty("--clock-inset-bottom", `${Math.max(0, viewportHeight - rect.bottom)}px`);
      clockScreen.style.setProperty("--clock-inset-left", `${Math.max(0, Math.min(rect.left, viewportWidth))}px`);
    }
    if (paletteDialog.open) closePalette({ instant: true });
    if (aboutDialog.open) closeAbout({ instant: true });
    if (authorDialog.open) closeAuthor({ instant: true });
    if (clockDialog.open) {
      clockEls.close?.focus();
      return;
    }
    clockClosing = false;
    clockDialog.classList.remove("is-closing");
    if (clockScreen) clockScreen.scrollTop = 0;
    setClockFocus(false, { instant: true });
    applyClockSettings();
    applyFocusPrefs();
    renderStopwatch();
    renderCountdown();
    clockDialog.showModal();
    document.body.classList.add("modal-open");
    updateClockScreen(new Date());
    ensureClockTimerLoop();
    window.requestAnimationFrame(() => clockEls.close?.focus({ preventScroll: true }));
  }

  function closeClock({ instant = false } = {}) {
    if (!clockDialog?.open || clockClosing) return;
    if (document.fullscreenElement && clockDialog.contains(document.fullscreenElement)) {
      document.exitFullscreen?.().catch(() => {});
    }
    setClockFocus(false, { instant: true });
    stopClockTimerLoop();
    if (instant || reducedMotion) {
      clockDialog.close();
      clockDialog.classList.remove("is-closing");
      clockClosing = false;
      return;
    }
    clockClosing = true;
    clockDialog.classList.add("is-closing");
    window.setTimeout(() => {
      if (clockDialog.open) clockDialog.close();
      clockDialog.classList.remove("is-closing");
      clockClosing = false;
    }, 240);
  }

  async function toggleClockFullscreen() {
    try {
      if (!document.fullscreenElement) {
        if (!clockScreen?.requestFullscreen) throw new Error("unsupported");
        await clockScreen.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      toast("当前浏览器无法进入全屏", { type: "info" });
    }
  }

  function syncClockFullscreenButton() {
    if (!clockEls.fullscreen) return;
    clockEls.fullscreen.textContent = document.fullscreenElement ? "退出全屏" : "全屏";
  }

  function copyClockTime() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    const displayHour = clockSettings.hours24 ? hours : hours % 12 || 12;
    const time = `${two(displayHour)}:${two(minutes)}${clockSettings.seconds ? `:${two(seconds)}` : ""}${clockSettings.hours24 ? "" : hours < 12 ? " 上午" : " 下午"}`;
    const text = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${WEEKDAYS[now.getDay()]} ${time} · ${timeZoneLabel(now)} · ${localTimeZone}`;
    copyText(text, "当前时间已复制");
  }

