/* ==========================================================================
   Global interaction bindings and modal bindings
   ChengYu · Lumen Toolkit
   ========================================================================== */
"use strict";

  /* ----------------------------------------------------------------------
     Global interaction bindings
     ---------------------------------------------------------------------- */
  /*
    绑定层只处理全局入口，不写业务算法：
    - 文档级 click 委托：动态生成的卡片不需要逐个 addEventListener；
    - 全局键盘：Ctrl/Cmd+K、/、Esc；
    - 四个 dialog 的 cancel / 点击背景 / 关闭同步；
    - 工具内部快捷键（例如文本编辑器的 Ctrl+S）由工具自己处理。
  */
  function openByRecent(id) {
    const tool = TOOL_MAP.get(id);
    if (!tool) return;
    const source = $(`.tool-card[data-tool="${id}"] .tool-icon`);
    openTool(id, source);
  }

  function handleDocumentClick(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const favoriteButton = target.closest("[data-fav]");
    if (favoriteButton) {
      event.preventDefault();
      event.stopPropagation();
      toggleFavorite(favoriteButton.dataset.fav);
      return;
    }

    const searchButton = target.closest("[data-open-search]");
    if (searchButton) {
      event.preventDefault();
      openPalette();
      return;
    }

    const toolsChip = target.closest("[data-scroll-tools]");
    if (toolsChip) {
      event.preventDefault();
      $("#tools")?.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "start",
      });
      return;
    }

    const clockButton = target.closest("[data-open-clock]");
    if (clockButton) {
      event.preventDefault();
      openClock(clockButton);
      return;
    }

    const authorButton = target.closest("[data-open-author]");
    if (authorButton) {
      event.preventDefault();
      openAuthor(authorButton);
      return;
    }

    const aboutButton = target.closest("[data-open-about]");
    if (aboutButton) {
      event.preventDefault();
      openAbout();
      return;
    }

    const themeButton = target.closest("[data-theme-action]");
    if (themeButton) {
      event.preventDefault();
      toggleTheme(event);
      return;
    }

    const backButton = target.closest("[data-back]");
    if (backButton) {
      event.preventDefault();
      closeTool();
      return;
    }

    const navButton = target.closest("[data-nav]");
    if (navButton) {
      event.preventDefault();
      if (navButton.dataset.nav === "favorites") goToFavorites();
      else goToHomeTop();
      return;
    }

    const relatedButton = target.closest("[data-related]");
    if (relatedButton) {
      event.preventDefault();
      openTool(relatedButton.dataset.related, $(".tool-icon", relatedButton));
      return;
    }

    const cardLink = target.closest(".card-hit");
    if (cardLink) {
      event.preventDefault();
      const card = cardLink.closest(".tool-card");
      if (!card) return;
      openTool(card.dataset.tool, $(".tool-icon", card));
      return;
    }

    const recentButton = target.closest("[data-recent]");
    if (recentButton) {
      event.preventDefault();
      openByRecent(recentButton.dataset.recent);
      return;
    }

    if (target.closest("#emptyBrowse")) {
      setFilter("all", { animate: true });
      window.requestAnimationFrame(() => $("#tools")?.scrollIntoView({ behavior: "smooth", block: "start" }));
      return;
    }

    const brand = target.closest("#brandLink");
    if (brand) {
      event.preventDefault();
      goToHomeTop();
    }
  }

  function handleGlobalKeydown(event) {
    const key = event.key.toLowerCase();
    const modifier = event.metaKey || event.ctrlKey;

    if (modifier && key === "k") {
      event.preventDefault();
      openPalette();
      return;
    }

    if (paletteDialog.open) return;

    if (event.key === "Escape" && currentToolId && !aboutDialog.open && !authorDialog.open && !clockDialog.open && !isTypingTarget(event.target)) {
      event.preventDefault();
      closeTool();
      return;
    }

    if (event.key === "/" && !modifier && !event.altKey && !isTypingTarget(event.target) && !aboutDialog.open && !authorDialog.open && !clockDialog.open) {
      event.preventDefault();
      openPalette();
    }
  }

  function initModalBindings() {
    $("#themeToggle")?.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleTheme(event);
    });

    $("#paletteClose")?.addEventListener("click", () => closePalette());
    $("#aboutClose")?.addEventListener("click", () => closeAbout());
    $("#aboutDone")?.addEventListener("click", () => closeAbout());
    $("#authorClose")?.addEventListener("click", () => closeAuthor());
    $("#authorExplore")?.addEventListener("click", goFromAuthorToTools);
    clockEls.close?.addEventListener("click", () => closeClock());
    clockEls.format?.addEventListener("click", () => {
      clockSettings.hours24 = !clockSettings.hours24;
      safeStorageSet("lumen.clock", clockSettings);
      applyClockSettings();
    });
    clockEls.secondsToggle?.addEventListener("click", () => {
      clockSettings.seconds = !clockSettings.seconds;
      safeStorageSet("lumen.clock", clockSettings);
      applyClockSettings();
    });
    clockEls.fullscreen?.addEventListener("click", toggleClockFullscreen);
    clockEls.copy?.addEventListener("click", copyClockTime);
    clockEls.focus?.addEventListener("click", () => setClockFocus(true));
    clockEls.focusExit?.addEventListener("click", () => setClockFocus(false));
    clockEls.focusCustomize?.addEventListener("click", openFocusPanel);
    clockEls.focusDone?.addEventListener("click", () => closeFocusPanel({ hideChrome: true }));
    clockEls.focusReset?.addEventListener("click", resetFocusPrefs);
    clockEls.focusFormatButtons.forEach((button) => {
      button.addEventListener("click", () => setFocusFormat(button.dataset.focusFormat));
    });
    clockEls.focusStyleButtons.forEach((button) => {
      button.addEventListener("click", () => {
        focusPrefs.style = button.dataset.focusStyle;
        saveFocusPrefs();
        applyFocusPrefs();
      });
    });
    clockEls.focusWeightButtons.forEach((button) => {
      button.addEventListener("click", () => {
        focusPrefs.weight = button.dataset.focusWeight;
        saveFocusPrefs();
        applyFocusPrefs();
      });
    });
    clockEls.focusSize?.addEventListener("input", (event) => {
      focusPrefs.size = Math.min(180, Math.max(55, Number(event.target.value) || 100));
      saveFocusPrefs();
      applyFocusPrefs();
    });
    clockEls.focusTracking?.addEventListener("input", (event) => {
      focusPrefs.tracking = Math.min(0.18, Math.max(-0.12, (Number(event.target.value) || 0) / 100));
      saveFocusPrefs();
      applyFocusPrefs();
    });
    clockEls.focusOffset?.addEventListener("input", (event) => {
      focusPrefs.offset = Math.min(18, Math.max(-18, Number(event.target.value) || 0));
      saveFocusPrefs();
      applyFocusPrefs();
    });
    clockEls.focusAlignButtons.forEach((button) => {
      button.addEventListener("click", () => {
        if (!FOCUS_ALIGNS.includes(button.dataset.focusAlign)) return;
        focusPrefs.align = button.dataset.focusAlign;
        saveFocusPrefs();
        applyFocusPrefs();
      });
    });
    clockEls.focusAtmosphereButtons.forEach((button) => {
      button.addEventListener("click", () => {
        if (!FOCUS_ATMOSPHERES.includes(button.dataset.focusAtmosphere)) return;
        focusPrefs.atmosphere = button.dataset.focusAtmosphere;
        saveFocusPrefs();
        applyFocusPrefs();
      });
    });
    clockEls.focusGlowButtons.forEach((button) => {
      button.addEventListener("click", () => {
        focusPrefs.glow = button.dataset.focusGlow === "on";
        saveFocusPrefs();
        applyFocusPrefs();
      });
    });
    clockScreen?.addEventListener("pointermove", () => {
      if (clockScreen.classList.contains("is-focus") && !focusPanelIsOpen()) showFocusChrome();
    });
    clockScreen?.addEventListener("pointerdown", (event) => {
      if (!clockScreen.classList.contains("is-focus")) return;
      if (!(event.target instanceof Element) || event.target.closest("button, input, .clock-focus-panel")) return;
      showFocusChrome();
    });
    clockScreen?.addEventListener("focusin", () => {
      if (clockScreen.classList.contains("is-focus")) showFocusChrome();
    });
    clockEls.stopwatchToggle?.addEventListener("click", toggleStopwatch);
    clockEls.stopwatchReset?.addEventListener("click", resetStopwatch);
    clockEls.countdownToggle?.addEventListener("click", toggleCountdown);
    clockEls.countdownReset?.addEventListener("click", () => resetCountdown());
    clockEls.countdownPresets.forEach((button) => {
      button.addEventListener("click", () => resetCountdown(Number(button.dataset.countdown) * 1000));
    });
    document.addEventListener("fullscreenchange", syncClockFullscreenButton);

    paletteInput.addEventListener("input", (event) => {
      renderPalette(event.target.value);
    });

    paletteInput.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        movePaletteSelection(1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        movePaletteSelection(-1);
      } else if (event.key === "Home") {
        event.preventDefault();
        paletteActive = 0;
        updatePaletteSelection();
      } else if (event.key === "End") {
        event.preventDefault();
        paletteActive = Math.max(paletteCommands.length - 1, 0);
        updatePaletteSelection();
      } else if (event.key === "Enter") {
        event.preventDefault();
        runPaletteCommand(paletteActive);
      } else if (event.key === "Escape") {
        event.preventDefault();
        closePalette();
      }
    });

    paletteResults.addEventListener("click", (event) => {
      const item = event.target.closest(".palette-item");
      if (!item) return;
      runPaletteCommand(Number(item.dataset.index));
    });

    paletteDialog.addEventListener("click", (event) => {
      if (event.target === paletteDialog) closePalette();
    });
    aboutDialog.addEventListener("click", (event) => {
      if (event.target === aboutDialog) closeAbout();
    });
    authorDialog.addEventListener("click", (event) => {
      if (event.target === authorDialog) closeAuthor();
    });
    clockDialog.addEventListener("click", (event) => {
      if (event.target === clockDialog) closeClock();
    });

    paletteDialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closePalette();
    });
    aboutDialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeAbout();
    });
    authorDialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeAuthor();
    });
    clockDialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      if (focusPanelIsOpen()) {
        closeFocusPanel();
        return;
      }
      if (clockScreen?.classList.contains("is-focus")) {
        setClockFocus(false);
        return;
      }
      closeClock();
    });
    document.addEventListener("keydown", (event) => {
      if (!clockDialog.open || event.key.toLowerCase() !== "f" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (focusPanelIsOpen()) return;
      event.preventDefault();
      setClockFocus(!clockScreen?.classList.contains("is-focus"));
    });

    paletteDialog.addEventListener("close", () => {
      if (!aboutDialog.open && !authorDialog.open && !clockDialog.open) document.body.classList.remove("modal-open");
    });
    aboutDialog.addEventListener("close", () => {
      if (!paletteDialog.open && !authorDialog.open && !clockDialog.open) document.body.classList.remove("modal-open");
    });
    authorDialog.addEventListener("close", () => {
      if (!paletteDialog.open && !aboutDialog.open && !clockDialog.open) document.body.classList.remove("modal-open");
    });
    clockDialog.addEventListener("close", () => {
      if (!paletteDialog.open && !aboutDialog.open && !authorDialog.open) document.body.classList.remove("modal-open");
      syncClockFullscreenButton();
    });
  }

  function initHomeInteractions() {
    $$(".filter-pill", $("#filterRow")).forEach((button) => {
      button.addEventListener("click", () => {
        setFilter(button.dataset.filter, { animate: true });
      });
    });

    $("#toolGridToggle")?.addEventListener("click", () => {
      toolGridExpanded = !toolGridExpanded;
      applyFilter({ animate: true });
      if (!toolGridExpanded) {
        window.requestAnimationFrame(() => {
          $("#toolGridToggle")?.scrollIntoView({
            behavior: reducedMotion ? "auto" : "smooth",
            block: "center",
          });
        });
      }
    });

    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("keydown", handleGlobalKeydown);

    let scrollFrame = 0;
    const setScrolledState = () => {
      const scrolled = window.scrollY > 10;
      if (topbar && topbar.classList.contains("is-scrolled") !== scrolled) {
        topbar.classList.toggle("is-scrolled", scrolled);
      }
    };

    window.addEventListener(
      "scroll",
      () => {
        if (scrollFrame) return;
        scrollFrame = window.requestAnimationFrame(() => {
          setScrolledState();
          updateScrollProgress();
          scrollFrame = 0;
        });
      },
      { passive: true }
    );
    setScrolledState();
    updateScrollProgress();

    // The privacy banner used to fade in on scroll. It is static now so
    // scrolling never has to wait for a section-level animation.
  }

  function syncShortcutLabels() {
    $$("[data-shortcut]").forEach((node) => {
      node.textContent = shortcutLabel;
    });
    $$("[data-mod]").forEach((node) => {
      node.textContent = modLabel;
    });
  }

