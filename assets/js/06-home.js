/* ==========================================================================
   Home rendering, filters, recent tools and favorites
   ChengYu · Lumen Toolkit
   ========================================================================== */
"use strict";

  /* ----------------------------------------------------------------------
     Home: cards, filters, recents, favorites
     ---------------------------------------------------------------------- */
  /*
    首页只做四类渲染，不承载工具业务逻辑：
    1. 工具卡装饰（代码 / 图片 / Markdown 的静态缩略视觉）；
    2. 工具网格与“展开更多”的数量控制；
    3. 收藏 / 最近使用 / 分类筛选；
    4. 顶部与底部导航的计数同步。

    工具页本身由 07-routing.js 负责，这里不直接初始化任何工具。
  */
  function codeDeco() {
    return `
      <div class="card-deco code-deco" aria-hidden="true">
        <div class="code-deco-bar"><i></i><i></i><i></i><span>local.json</span></div>
        <div class="code-deco-body">
          <div><b>"name"</b>: <em>"程宇"</em>,</div>
          <div><b>"local"</b>: <u>true</u>,</div>
          <div><b>"uploads"</b>: <u>0</u>,</div>
          <div><b>"motto"</b>: <em>"一气呵成"</em></div>
        </div>
      </div>`;
  }

  function photoDeco() {
    return `
      <div class="card-deco photo-deco" aria-hidden="true">
        <div class="photo-frame"></div>
        <div class="photo-frame"></div>
        <span class="photo-size">WebP · −68%</span>
      </div>`;
  }

  function markdownDeco() {
    return `
      <div class="card-deco md-deco" aria-hidden="true">
        <div class="md-page">
          <span class="md-page-dot"></span>
          <span class="md-page-line title"></span>
          <span class="md-page-line"></span>
          <span class="md-page-line short"></span>
          <span class="md-page-quote"></span>
          <span class="md-page-code"></span>
        </div>
        <span class="md-page-badge">M↓</span>
      </div>`;
  }

  function renderToolGrid() {
    if (!toolGrid) return;
    toolGrid.innerHTML = TOOLS.map((tool, index) => {
      const category = CATEGORY_META[tool.category];
      const isFavorite = favorites.has(tool.id);
      return `
        <article class="tool-card tint-${tool.tint}" data-tool="${tool.id}" data-category="${tool.category}" style="--i:${index}"${!toolGridExpanded && index >= INITIAL_TOOL_LIMIT ? " hidden" : ""}>
          <div class="card-head">
            <span class="tool-icon tint-${tool.tint}" aria-hidden="true">${icon(tool.icon)}</span>
            <button class="fav-btn${isFavorite ? " is-faved" : ""}" type="button" data-fav="${tool.id}" aria-pressed="${isFavorite}" aria-label="${isFavorite ? "取消收藏" : "收藏"} ${tool.name}">
              ${icon("star")}
            </button>
          </div>
          <div class="card-copy">
            <span class="card-kicker">${category.label} · ${category.en}${tool.isNew ? '<span class="card-new">NEW</span>' : ""}</span>
            <h3>${tool.name}</h3>
            <p>${tool.desc}</p>
          </div>
          <div class="card-foot">
            <span class="open-label">打开工具</span>
            <span class="card-arrow">${icon("arrow-up-right")}</span>
          </div>
          <a class="card-hit" href="#/tool/${tool.id}" aria-label="打开 ${tool.name}"></a>
        </article>`;
    }).join("");
  }

  function visibleToolCount() {
    if (activeFilter === "favorites") return favorites.size;
    if (activeFilter === "all") return TOOLS.length;
    return TOOLS.filter((tool) => tool.category === activeFilter).length;
  }

  function syncNavigation() {
    const active = currentToolId
      ? "home"
      : activeFilter === "favorites"
        ? "favorites"
        : "home";
    $$("[data-nav]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.nav === active);
      if (button.dataset.nav === "favorites") {
        button.setAttribute("aria-current", active === "favorites" ? "page" : "false");
      }
    });
  }

  function updateFavoriteUI() {
    const count = favorites.size;
    $$("[data-fav]").forEach((button) => {
      const active = favorites.has(button.dataset.fav);
      button.classList.toggle("is-faved", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
      if (button.classList.contains("favorite-toggle")) {
        button.setAttribute("aria-label", active ? "取消收藏此工具" : "收藏此工具");
        const label = button.querySelector("span");
        if (label) label.textContent = active ? "已收藏" : "收藏";
      } else {
        const tool = TOOL_MAP.get(button.dataset.fav);
        button.setAttribute(
          "aria-label",
          `${active ? "取消收藏" : "收藏"} ${tool ? tool.name : "工具"}`
        );
      }
    });

    const badge = $("#navFavCount");
    if (badge) {
      badge.hidden = count === 0;
      badge.textContent = String(count);
    }
    const dockBadge = $("#dockFavCount");
    if (dockBadge) dockBadge.hidden = count === 0;
  }

  function renderRecent() {
    if (!recentBar || !recentList) return;
    const items = recents.filter((id) => TOOL_MAP.has(id));
    if (!items.length) {
      recentBar.hidden = true;
      recentList.innerHTML = "";
      return;
    }
    recentBar.hidden = false;
    recentList.innerHTML = items.map((id) => {
      const tool = TOOL_MAP.get(id);
      return `<button class="recent-chip" type="button" data-recent="${tool.id}" aria-label="打开 ${tool.name}">
        <span class="tool-dot" style="background:${TINT_COLORS[tool.tint] || "var(--accent)"}"></span>
        ${tool.name}
      </button>`;
    }).join("");
  }

  function rememberTool(id) {
    const next = [id, ...recents.filter((item) => item !== id)].slice(0, 4);
    recents.splice(0, recents.length, ...next);
    safeStorageSet("lumen.recent", recents);
    renderRecent();
  }

  function applyFilter({ animate = true, scroll = false } = {}) {
    const cards = $$(".tool-card", toolGrid);
    const filterCopy = FILTER_COPY[activeFilter] || FILTER_COPY.all;
    let matched = 0;
    let shown = 0;

    cards.forEach((card, index) => {
      const tool = TOOL_MAP.get(card.dataset.tool);
      const matches =
        activeFilter === "all"
          ? true
          : activeFilter === "favorites"
            ? favorites.has(card.dataset.tool)
            : tool?.category === activeFilter;
      if (matches) matched += 1;
      const show = matches && (toolGridExpanded || shown < INITIAL_TOOL_LIMIT);
      card.hidden = !show;
      if (show) {
        shown += 1;
        if (animate && !reducedMotion) {
          card.animate(
            [
              { opacity: 0, transform: "translateY(10px) scale(0.992)" },
              { opacity: 1, transform: "translateY(0) scale(1)" },
            ],
            {
              duration: 480,
              delay: Math.min(index, 7) * 24,
              easing: "cubic-bezier(0.22, 1, 0.36, 1)",
            }
          );
        }
      }
    });

    $$(".filter-pill", $("#filterRow")).forEach((button) => {
      const active = button.dataset.filter === activeFilter;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });

    const title = $("#toolsTitle");
    const subtitle = $("#toolsSubtitle");
    const countPill = $("#toolCount");
    if (title) title.textContent = filterCopy.title;
    if (subtitle) subtitle.textContent = filterCopy.subtitle;
    if (countPill) countPill.textContent = String(matched);

    const isEmpty = matched === 0;
    if (toolGrid) {
      toolGrid.hidden = isEmpty;
      toolGrid.classList.toggle("is-single", shown === 1);
    }
    if (gridEmpty) gridEmpty.hidden = !isEmpty;

    const toggleWrap = $("#toolGridToggleWrap");
    const toggleButton = $("#toolGridToggle");
    const toggleLabel = $("#toolGridToggleLabel");
    const toggleMeta = $("#toolGridToggleMeta");
    const canToggle = matched > INITIAL_TOOL_LIMIT;
    if (toggleWrap) toggleWrap.hidden = !canToggle;
    if (canToggle && toggleButton) {
      toggleButton.classList.toggle("is-expanded", toolGridExpanded);
      toggleButton.setAttribute("aria-expanded", String(toolGridExpanded));
      if (toggleLabel) {
        toggleLabel.textContent = toolGridExpanded ? "收起工具" : "展开更多工具";
      }
      if (toggleMeta) {
        toggleMeta.textContent = toolGridExpanded
          ? `${matched} 个已全部展开`
          : `显示 ${shown} / ${matched}`;
      }
    }

    syncNavigation();
    updateFavoriteUI();
    refreshScrollMetrics();

    if (scroll && !homeView.hidden) {
      window.requestAnimationFrame(() => {
        $("#tools")?.scrollIntoView({
          behavior: reducedMotion ? "auto" : "smooth",
          block: "start",
        });
      });
    }
  }

  function setFilter(filter, options = {}) {
    if (!["all", "dev", "design", "web", "text", "daily", "favorites"].includes(filter)) {
      filter = "all";
    }
    activeFilter = filter;
    applyFilter(options);
    if (options.scroll) {
      window.requestAnimationFrame(() => {
        $("#tools")?.scrollIntoView({
          behavior: options.smooth === false || reducedMotion ? "auto" : "smooth",
          block: "start",
        });
      });
    }
  }

  function toggleFavorite(id) {
    if (!TOOL_MAP.has(id)) return;
    const tool = TOOL_MAP.get(id);
    const adding = !favorites.has(id);
    if (adding) favorites.add(id);
    else favorites.delete(id);
    safeStorageSet("lumen.favorites", Array.from(favorites));
    updateFavoriteUI();
    toast(adding ? `已收藏「${tool.name}」` : `已取消收藏「${tool.name}」`, {
      type: adding ? "success" : "info",
    });

    const targetButtons = $$(`[data-fav="${id}"]`);
    if (!reducedMotion) {
      targetButtons.forEach((button) => {
        button.animate(
          [
            { transform: "scale(1)" },
            { transform: "scale(1.26)" },
            { transform: "scale(0.94)" },
            { transform: "scale(1)" },
          ],
          { duration: 380, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
        );
      });
    }

    if (!currentToolId && activeFilter === "favorites") {
      applyFilter({ animate: true, scroll: false });
    }
  }

  function bindCardPointer() {
    if (!canHover) return;
    $$(".tool-card", toolGrid).forEach((card) => {
      let frame = 0;
      let pointerX = 0;
      let pointerY = 0;

      card.addEventListener(
        "pointermove",
        (event) => {
          if (event.pointerType && event.pointerType !== "mouse") return;
          pointerX = event.clientX;
          pointerY = event.clientY;
          if (frame) return;
          frame = window.requestAnimationFrame(() => {
            const rect = card.getBoundingClientRect();
            card.style.setProperty("--mx", `${pointerX - rect.left}px`);
            card.style.setProperty("--my", `${pointerY - rect.top}px`);
            frame = 0;
          });
        },
        { passive: true }
      );
    });
  }

