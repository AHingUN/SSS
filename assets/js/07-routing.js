/* ==========================================================================
   Hash routing, page transitions and tool navigation
   ChengYu · Lumen Toolkit
   ========================================================================== */
"use strict";

  /* ----------------------------------------------------------------------
     Routing and page transitions
     ---------------------------------------------------------------------- */
  /*
    一次工具打开 / 关闭的顺序（所有工具通用）：

      打开：
        parseRoute() → cleanupTool() → toolMarkup() 拷贝模板
        → initTool(id) → 记住 recent / 收藏 / 导航 → 进入动画

      关闭：
        animatePageOut() → cleanupTool() → 清空 #toolRoot
        → 恢复首页滚动位置 → 动画

    关键不变量：
    - 同时只存在一个工具页 DOM；
    - 每次进入工具页前先清掉上一个工具的 cleanup；
    - 模板中的 ID 会被拷进 #toolRoot，所以模板 ID 必须全局唯一；
    - 初始化失败时只提示，不让整个路由卡死。
  */
  function parseRoute() {
    const match = window.location.hash.match(/^#\/tool\/([a-z0-9-]+)$/);
    if (match && TOOL_MAP.has(match[1])) return { view: "tool", id: match[1] };
    return { view: "home" };
  }

  function routeScrollTop() {
    scrollInstant(0);
  }

  function relatedToolsFor(tool) {
    const pool = TOOLS.filter((item) => item.id !== tool.id);
    return [
      ...pool.filter((item) => item.category === tool.category),
      ...pool.filter((item) => item.category !== tool.category),
    ].slice(0, 3);
  }

  function toolMarkup(tool) {
    const category = CATEGORY_META[tool.category];
    const isFavorite = favorites.has(tool.id);
    const panel = $(`#tpl-${tool.id}`);
    const related = relatedToolsFor(tool);
    return `
      <section class="tool-view" aria-labelledby="toolTitle">
        <a class="back-link" href="#/" data-back>${icon("arrow-left")}全部工具</a>
        <header class="tool-head">
          <div class="tool-head-main">
            <span class="tool-icon large tint-${tool.tint}" aria-hidden="true">${icon(tool.icon)}</span>
            <div class="tool-head-copy">
              <div class="tool-kicker"><span>${category.label.toUpperCase()} · ${category.en}</span><span class="local-inline">LOCAL</span></div>
              <h1 id="toolTitle">${tool.name}</h1>
              <p>${tool.desc}</p>
            </div>
          </div>
          <div class="tool-head-actions">
            <button class="favorite-toggle${isFavorite ? " is-faved" : ""}" type="button" data-fav="${tool.id}" aria-pressed="${isFavorite}" aria-label="${isFavorite ? "取消收藏此工具" : "收藏此工具"}">
              ${icon("star")}<span>${isFavorite ? "已收藏" : "收藏"}</span>
            </button>
          </div>
        </header>
        <div class="tool-workspace">
          ${panel ? panel.innerHTML : ""}
        </div>
        <div class="tool-foot">
          <span>${icon("lock")}内容仅在本地处理，不会上传</span>
          <button type="button" data-open-search>${icon("command")}切换工具 <kbd>${shortcutLabel}</kbd></button>
        </div>
        <section class="tool-related" aria-labelledby="relatedTitle">
          <div class="tool-related-head">
            <div>
              <span class="section-kicker">KEEP EXPLORING</span>
              <h2 id="relatedTitle">继续探索</h2>
            </div>
            <a class="text-link" href="#/" data-back>全部工具${icon("arrow-up-right")}</a>
          </div>
          <div class="related-grid">
            ${related
              .map((item) => {
                const itemCategory = CATEGORY_META[item.category];
                return `<button class="related-card" type="button" data-related="${item.id}">
                  <span class="tool-icon tint-${item.tint}" aria-hidden="true">${icon(item.icon)}</span>
                  <span class="related-copy">
                    <span class="related-kicker">${itemCategory.label} · ${itemCategory.en}</span>
                    <strong>${item.name}</strong>
                    <small>${item.desc}</small>
                  </span>
                  <span class="related-arrow" aria-hidden="true">${icon("arrow-up-right")}</span>
                </button>`;
              })
              .join("")}
          </div>
        </section>
      </section>`;
  }

  /*
    cleanup 是工具生命周期的一部分：定时器、全局监听、观察器、草稿保存
    都应该在这里释放。即使某个 cleanup 抛错，也不能阻断导航。
  */
  function cleanupTool() {
    if (typeof currentCleanup === "function") {
      try {
        currentCleanup();
      } catch (error) {
        /* A cleanup should never block navigation. */
      }
    }
    currentCleanup = null;
  }

  /*
    先写 DOM，再初始化工具：init 函数只操作已经挂载的元素，不需要等待
    额外的 requestAnimationFrame 或路由事件。init 返回值统一存为
    currentCleanup，离开时由 cleanupTool() 执行。
  */
  function renderToolPage(id) {
    const tool = TOOL_MAP.get(id);
    if (!tool) return;
    cleanupTool();
    currentToolId = id;
    homeView.hidden = true;
    toolRoot.hidden = false;
    toolRoot.innerHTML = toolMarkup(tool);
    document.title = `${tool.name} · 程宇`;
    toolRoot.classList.add("is-open");
    routeScrollTop();
    rememberTool(id);
    updateFavoriteUI();
    syncNavigation();
    syncShortcutLabels();
    try {
      currentCleanup = initTool(id) || null;
    } catch (error) {
      console.error("Tool initialisation failed:", error);
      toast("这个工具暂时没有准备好", { type: "info" });
    }
    enhanceSegmentedControls(toolRoot);
    refreshScrollMetrics();
  }

  function showHomePage({ restoreScroll = true } = {}) {
    cleanupTool();
    currentToolId = null;
    toolRoot.hidden = true;
    toolRoot.innerHTML = "";
    toolRoot.classList.remove("is-open");
    homeView.hidden = false;
    document.title = "程宇 · 日常工具，一气呵成";
    renderRecent();
    updateFavoriteUI();
    applyFilter({ animate: false });
    syncNavigation();
    if (restoreScroll) scrollInstant(homeScroll);
    enhanceSegmentedControls(homeView);
    refreshScrollMetrics();
  }

  function visiblePageView() {
    if (!homeView.hidden) return homeView;
    if (!toolRoot.hidden) return toolRoot;
    return null;
  }

  function animatePageOut(view) {
    if (!view || reducedMotion) return Promise.resolve();
    const animation = view.animate(
      [
        { opacity: 1, transform: "translateY(0)" },
        { opacity: 0, transform: "translateY(-7px)" },
      ],
      { duration: 150, easing: "cubic-bezier(0.4, 0, 1, 1)", fill: "forwards" }
    );
    return animation.finished
      .catch(() => {})
      .then(() => {
        animation.cancel();
      });
  }

  function animatePageIn(view) {
    if (!view || reducedMotion) return;
    view.animate(
      [
        { opacity: 0 },
        { opacity: 1 },
      ],
      { duration: 280, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }
    );
  }

  /*
    图标飞行动画：
    - 克隆源图标并移除所有 id，防止 DOM id 重复；
    - 源矩形 → 目标矩形用 transform 过渡，不修改真实布局；
    - 结束后移除克隆、恢复目标透明度。
    只做一次短动画，不影响路由状态。
  */
  function routeTransition(
    update,
    { source = null, targetSelector = null, sourceRect: sourceRectOverride = null, sourceNode = null } = {}
  ) {
    const sourceRect = sourceRectOverride || source?.getBoundingClientRect();
    const sourceClone = sourceNode || source?.cloneNode(true);
    const canFly =
      sourceClone &&
      sourceRect &&
      sourceRect.width > 0 &&
      sourceRect.height > 0 &&
      targetSelector &&
      !reducedMotion;
    const outgoing = visiblePageView();

    return animatePageOut(outgoing).then(() => {
      update();
      const incoming = visiblePageView();
      animatePageIn(incoming);

      if (!canFly) return Promise.resolve();

      const target = $(targetSelector);
      if (!target) {
        sourceClone.remove?.();
        return Promise.resolve();
      }

      const targetRect = target.getBoundingClientRect();
      if (targetRect.width < 1 || targetRect.height < 1) {
        return Promise.resolve();
      }

      const clone = sourceClone;
      clone.removeAttribute("id");
      clone.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
      clone.setAttribute("aria-hidden", "true");
      clone.classList.add("icon-flight");
      Object.assign(clone.style, {
        top: `${sourceRect.top}px`,
        left: `${sourceRect.left}px`,
        width: `${sourceRect.width}px`,
        height: `${sourceRect.height}px`,
      });

      target.style.opacity = "0";
      document.body.appendChild(clone);

      const deltaX = targetRect.left - sourceRect.left;
      const deltaY = targetRect.top - sourceRect.top;
      const scaleX = targetRect.width / sourceRect.width;
      const scaleY = targetRect.height / sourceRect.height;
      const endTransform = `translate3d(${deltaX}px, ${deltaY}px, 0) scale(${scaleX}, ${scaleY})`;
      const duration = 320;

      const flight = clone.animate(
        [
          { transform: "translate3d(0, 0, 0) scale(1)" },
          { transform: endTransform },
        ],
        {
          duration,
          easing: "cubic-bezier(0.22, 0.72, 0.28, 1)",
          fill: "forwards",
        }
      );
      const cloneFade = clone.animate(
        [{ opacity: 1 }, { opacity: 0 }],
        {
          duration: 60,
          delay: duration - 60,
          easing: "ease-out",
          fill: "both",
        }
      );
      const reveal = target.animate(
        [{ opacity: 0 }, { opacity: 1 }],
        {
          duration: 80,
          delay: duration - 80,
          easing: "ease-out",
          fill: "both",
        }
      );

      return Promise.all([
        flight.finished.catch(() => {}),
        cloneFade.finished.catch(() => {}),
        reveal.finished.catch(() => {}),
      ]).then(() => {
        clone.remove();
        target.style.removeProperty("opacity");
        reveal.cancel();
      });
    });
  }

  function openTool(id, sourceIcon = null, sourceTransition = null) {
    if (!TOOL_MAP.has(id)) return;
    if (currentToolId === id) {
      closePalette({ instant: true });
      return;
    }

    const fromHome = currentToolId === null;
    if (fromHome) homeScroll = window.scrollY;

    if (fromHome) {
      window.history.pushState(
        { view: "tool", fromHome: true, homeScroll },
        "",
        `#/tool/${id}`
      );
    } else {
      window.history.replaceState(
        {
          view: "tool",
          fromHome: Boolean(window.history.state?.fromHome),
          homeScroll: window.history.state?.homeScroll ?? homeScroll,
        },
        "",
        `#/tool/${id}`
      );
    }

    const hasCustomSource = Boolean(sourceTransition?.sourceRect && sourceTransition?.sourceNode);
    const source = hasCustomSource
      ? null
      : sourceIcon || (fromHome ? null : $(".tool-head .tool-icon"));
    routeTransition(() => renderToolPage(id), {
      source,
      targetSelector: ".tool-head .tool-icon",
      ...(hasCustomSource
        ? {
            sourceRect: sourceTransition.sourceRect,
            sourceNode: sourceTransition.sourceNode,
          }
        : {}),
    });
  }

  function finishPendingHomeAction() {
    const action = pendingHomeAction;
    pendingHomeAction = null;
    if (typeof action === "function") {
      window.requestAnimationFrame(action);
    }
  }

  function closeTool() {
    if (!currentToolId) return;
    const closingId = currentToolId;
    const source = $(".tool-head .tool-icon");

    if (window.history.state?.fromHome) {
      window.history.back();
      return;
    }

    window.history.replaceState(
      { view: "home" },
      "",
      `${window.location.pathname}${window.location.search}`
    );

    routeTransition(() => showHomePage(), {
      source,
      targetSelector: `.tool-card[data-tool="${closingId}"] .tool-icon`,
    }).then(finishPendingHomeAction);
  }

  function goHomeWith(action) {
    if (currentToolId) {
      pendingHomeAction = action;
      closeTool();
      return;
    }
    if (typeof action === "function") action();
  }

  function goToHomeTop() {
    const action = () => {
      setFilter("all", { animate: false });
      scrollToTop();
    };
    goHomeWith(action);
  }

  function goToFavorites() {
    const action = () => setFilter("favorites", { animate: true, scroll: true });
    goHomeWith(action);
  }

  function handlePopState() {
    const route = parseRoute();
    if (route.view === "tool") {
      if (route.id === currentToolId) return;
      const source = currentToolId ? $(".tool-head .tool-icon") : null;
      routeTransition(() => renderToolPage(route.id), {
        source,
        targetSelector: ".tool-head .tool-icon",
      });
      return;
    }

    const closingId = currentToolId;
    const source = closingId ? $(".tool-head .tool-icon") : null;
    routeTransition(() => showHomePage(), {
      source,
      targetSelector: closingId
        ? `.tool-card[data-tool="${closingId}"] .tool-icon`
        : null,
    }).then(finishPendingHomeAction);
  }

