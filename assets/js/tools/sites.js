/* ==========================================================================
   Real-site directory
   ChengYu · Lumen Toolkit
   ========================================================================== */
"use strict";

  /* ----------------------------------------------------------------------
     Real-site directory
     ---------------------------------------------------------------------- */
  /* ----------------------------------------------------------------------
     Sites directory
     ---------------------------------------------------------------------- */
  /*
    站点导航数据来自全局 SITE_LINKS；本文件只负责四件事：
    1. 密码门（sessionStorage，关闭标签页即锁定）；
    2. 分类 / 搜索 / 收藏筛选；
    3. 分组增量渲染（每组 8 个，每次再加 12 个）；
    4. 收藏写入 localStorage，并监听跨标签页变化。

    密码是前端门禁，不是数据加密；站点 URL 仍然存在于本地 JS 数据中。
  */
  function initSitesTool() {
    const grid = $("#sitesGrid");
    const filters = $("#sitesFilters");
    const search = $("#sitesSearch");
    const count = $("#sitesCount");
    const empty = $("#sitesEmpty");
    const lockScreen = $("#sitesLock");
    const lockForm = $("#sitesLockForm");
    const passwordInput = $("#sitesPassword");
    const passwordToggle = $("#sitesPasswordToggle");
    const lockError = $("#sitesLockError");
    const lockButton = $("#sitesLockButton");
    const unlockButton = lockForm?.querySelector('button[type="submit"]');
    const unlockLabel = unlockButton?.querySelector(".sites-unlock-label");
    if (!grid || !filters) return null;

    const categories = SITE_CATEGORIES;
    const sites = SITE_LINKS;
    const realCategories = categories.filter(
      (category) => category.id !== "all" && category.id !== "favorites"
    );
    const favoritesCategory = categories.find((category) => category.id === "favorites");
    const categoryLabel = Object.fromEntries(categories.map((category) => [category.id, category.label]));
    const groupLimits = new Map();
    const GROUP_PAGE_SIZE = 8;
    const GROUP_MORE_STEP = 12;
    const scheduledRender = debounce(renderSites, 80);
    let activeCategory = "all";
    let currentVisible = [];
    const SITE_PASSWORD = "2026";
    const SITE_UNLOCK_KEY = "lumen.sitesUnlocked";
    const MAX_ATTEMPTS = 5;
    const LOCKOUT_MS = 30000;
    let failedAttempts = 0;
    let lockoutUntil = 0;
    let lockoutTimer = 0;
    let unlocking = false;

    function countFor(categoryId) {
      if (categoryId === "all") return sites.length;
      if (categoryId === "favorites") {
        return sites.reduce(
          (total, site) => total + (siteFavorites.has(site.key) ? 1 : 0),
          0
        );
      }
      return sites.reduce(
        (total, site) => total + (site.category === categoryId ? 1 : 0),
        0
      );
    }

    function renderFilterButtons() {
      filters.innerHTML = categories
        .map((category) => {
          const total = countFor(category.id);
          return `<button class="filter-pill${category.id === activeCategory ? " is-active" : ""}" type="button" data-site-category="${category.id}" aria-pressed="${category.id === activeCategory}" aria-label="按${category.label}筛选，${total} 个网站" aria-controls="sitesGrid">${category.label}<span class="site-filter-count">${total}</span></button>`;
        })
        .join("");
    }

    function siteTile(site) {
      const favorite = siteFavorites.has(site.key);
      return `
        <article class="site-tile" data-site-key="${escapeAttribute(site.key)}">
          <span class="site-mark tool-icon tint-${escapeAttribute(site.tint)}" aria-hidden="true">${escapeHTML(site.mark)}</span>
          <span class="site-copy">
            <span class="site-name">${escapeHTML(site.name)}<span class="site-category">${categoryLabel[site.category]}</span></span>
            <span class="site-desc">${escapeHTML(site.desc)}</span>
          </span>
          <span class="site-arrow" aria-hidden="true">${icon("arrow-up-right")}</span>
          <a class="site-hit" href="${escapeAttribute(site.url)}" target="_blank" rel="noopener noreferrer" aria-label="打开 ${escapeAttribute(site.name)}（新标签页）"></a>
          <button class="site-fav${favorite ? " is-faved" : ""}" type="button" data-site-favorite="${escapeAttribute(site.key)}" aria-pressed="${favorite}" aria-label="${favorite ? "取消收藏" : "收藏"} ${escapeAttribute(site.name)}">${icon("star")}</button>
        </article>`;
    }

    function updateEmptyState(query) {
      const heading = empty?.querySelector("h3");
      const copy = empty?.querySelector("p");
      if (!heading || !copy) return;
      if (query) {
        heading.textContent = "没有找到匹配的网站";
        copy.textContent = "换个关键词，或者回到「全部」看看。";
      } else if (activeCategory === "favorites") {
        heading.textContent = "还没有收藏站点";
        copy.textContent = "在站点卡片右侧点一下星标，之后就能在这里快速找到。";
      } else if (activeCategory !== "all") {
        heading.textContent = "这个分类暂时没有站点";
        copy.textContent = "换个分类，或者回到「全部」看看。";
      } else {
        heading.textContent = "站点列表暂时为空";
        copy.textContent = "稍后再来看看，或者添加新的站点。";
      }
    }

    /*
      锁定时必须清空 grid DOM，而不是只做 CSS 隐藏：
      全局搜索通过 DOM 读取站点结果，如果保留 DOM，就能绕过密码门。
      因此 renderSites() 在锁定时先 replaceChildren() 并清空 currentVisible。
    */
    function renderSites() {
      if (panel?.classList.contains("is-locked")) {
        grid.replaceChildren();
        currentVisible = [];
        return;
      }
      const query = normalizePaletteText(search.value);
      const visible = sites.filter((site) => {
        const inCategory =
          activeCategory === "all" ||
          (activeCategory === "favorites"
            ? siteFavorites.has(site.key)
            : site.category === activeCategory);
        if (!inCategory) return false;
        return !query || site.searchText.includes(query);
      });
      currentVisible = visible;

      const definitions =
        activeCategory === "all"
          ? realCategories
          : activeCategory === "favorites"
            ? [{ ...favoritesCategory, label: "我的收藏" }]
            : [categories.find((category) => category.id === activeCategory)].filter(Boolean);

      const groups = definitions
        .map((definition) => {
          const groupSites =
            activeCategory === "all"
              ? visible.filter((site) => site.category === definition.id)
              : visible;
          if (!groupSites.length) return null;
          const limit = groupLimits.get(definition.id) || GROUP_PAGE_SIZE;
          const items = groupSites.slice(0, limit);
          return {
            ...definition,
            sites: groupSites,
            items,
            extra: groupSites.length - items.length,
          };
        })
        .filter(Boolean);

      grid.innerHTML = groups
        .map(
          (group) => `
            <section class="site-group" data-site-group="${escapeAttribute(group.id)}" aria-labelledby="siteGroup-${escapeAttribute(group.id)}">
              <div class="site-group-head">
                <div class="site-group-title">
                  <span class="site-group-dot" aria-hidden="true"></span>
                  <h3 id="siteGroup-${escapeAttribute(group.id)}">${escapeHTML(group.label)}</h3>
                  <p>${escapeHTML(group.desc)}</p>
                </div>
                <span class="site-group-count">${group.sites.length} 个</span>
              </div>
              <div class="site-group-grid">${group.items.map(siteTile).join("")}</div>
              ${group.extra ? `<button class="site-group-more" type="button" data-site-more="${escapeAttribute(group.id)}">显示其余 ${group.extra} 个网站</button>` : ""}
            </section>`
        )
        .join("");

      const selected = categories.find((category) => category.id === activeCategory);
      if (query) {
        count.textContent = `${visible.length} 个结果 · ${groups.length} 个分类`;
      } else if (activeCategory === "all") {
        count.textContent = `${sites.length} 个真实网站 · ${realCategories.length} 个分类`;
      } else if (activeCategory === "favorites") {
        count.textContent = `${visible.length} 个收藏网站`;
      } else {
        count.textContent = `${selected.label} · ${visible.length} 个网站`;
      }

      grid.hidden = visible.length === 0;
      empty.hidden = visible.length > 0;
      updateEmptyState(query);
      animateStagger(grid, ".site-tile", { limit: 10, distance: 5, duration: 280 });
    }

    function toggleSiteFavorite(button) {
      const key = button.dataset.siteFavorite;
      const site = sites.find((item) => item.key === key);
      if (!site) return;
      const favorite = !siteFavorites.has(key);
      if (favorite) siteFavorites.add(key);
      else siteFavorites.delete(key);
      const saved = saveSiteFavorites();

      button.classList.toggle("is-faved", favorite);
      button.setAttribute("aria-pressed", String(favorite));
      button.setAttribute("aria-label", `${favorite ? "取消收藏" : "收藏"} ${site.name}`);
      renderFilterButtons();

      if (activeCategory === "favorites") {
        renderSites();
      }
      toast(
        saved ? `${favorite ? "已收藏" : "已取消收藏"} ${site.name}` : "本地记录未能保存",
        { type: saved ? "success" : "info" }
      );
    }

    filters.addEventListener("click", (event) => {
      const button = event.target.closest("[data-site-category]");
      if (!button) return;
      activeCategory = button.dataset.siteCategory;
      groupLimits.clear();
      renderFilterButtons();
      renderSites();
    });

    search.addEventListener("input", () => {
      groupLimits.clear();
      scheduledRender();
    });

    grid.addEventListener("click", (event) => {
      const moreButton = event.target.closest("[data-site-more]");
      if (moreButton) {
        const groupId = moreButton.dataset.siteMore;
        groupLimits.set(groupId, (groupLimits.get(groupId) || GROUP_PAGE_SIZE) + GROUP_MORE_STEP);
        renderSites();
        return;
      }
      const favoriteButton = event.target.closest("[data-site-favorite]");
      if (favoriteButton) {
        event.preventDefault();
        event.stopPropagation();
        toggleSiteFavorite(favoriteButton);
      }
    });

    function syncFavoritesFromStorage(event) {
      if (event.key !== SITE_FAVORITES_KEY) return;
      siteFavorites = loadSiteFavorites();
      renderFilterButtons();
      if (!panel?.classList.contains("is-locked")) renderSites();
    }

    const panel = grid.closest(".sites-panel");

    /*
      密码门的安全边界说明：
      - 只使用 sessionStorage，刷新标签页保持解锁，关闭标签页自动清除；
      - 5 次错误 → 30 秒倒计时，使用 setInterval 显示剩余秒数；
      - 失败只做前端提示，不锁定账号，也没有服务器参与。
    */
    function readUnlocked() {
      try {
        return sessionStorage.getItem(SITE_UNLOCK_KEY) === "1";
      } catch (error) {
        return false;
      }
    }

    function writeUnlocked(value) {
      try {
        if (value) sessionStorage.setItem(SITE_UNLOCK_KEY, "1");
        else sessionStorage.removeItem(SITE_UNLOCK_KEY);
      } catch (error) {
        // A blocked storage API simply makes the gate session-only.
      }
    }

    function showLockError(message) {
      if (!lockError) return;
      lockError.textContent = message;
      lockError.hidden = !message;
    }

    function setUnlockBusy(busy) {
      lockForm?.classList.toggle("is-busy", busy);
      if (unlockButton) unlockButton.disabled = busy || Date.now() < lockoutUntil;
      if (unlockLabel) unlockLabel.textContent = busy ? "正在校验…" : "解锁站点导航";
    }

    function clearLockout() {
      window.clearInterval(lockoutTimer);
      lockoutTimer = 0;
      lockoutUntil = 0;
      failedAttempts = 0;
      setUnlockBusy(false);
    }

    function startLockout() {
      lockoutUntil = Date.now() + LOCKOUT_MS;
      window.clearInterval(lockoutTimer);
      const tick = () => {
        const remaining = Math.max(0, lockoutUntil - Date.now());
        if (remaining <= 0) {
          clearLockout();
          showLockError("");
          return;
        }
        showLockError(`尝试次数过多，请 ${Math.ceil(remaining / 1000)} 秒后再试。`);
        if (unlockButton) unlockButton.disabled = true;
      };
      tick();
      lockoutTimer = window.setInterval(tick, 1000);
    }

    function shakeLockCard() {
      if (!lockScreen || reducedMotion) return;
      lockScreen.classList.add("is-error");
      window.setTimeout(() => lockScreen.classList.remove("is-error"), 460);
    }

    function setLocked(locked, { focus = false } = {}) {
      panel?.classList.toggle("is-locked", locked);
      if (lockScreen) {
        lockScreen.hidden = !locked;
        lockScreen.classList.remove("is-unlocking");
      }
      showLockError("");
      if (locked) {
        grid.replaceChildren();
        currentVisible = [];
        groupLimits.clear();
        if (passwordInput) passwordInput.value = "";
        if (passwordToggle) {
          passwordInput.type = "password";
          passwordToggle.textContent = "显示";
          passwordToggle.setAttribute("aria-label", "显示密码");
        }
        setUnlockBusy(false);
        if (focus) {
          window.requestAnimationFrame(() => passwordInput?.focus());
        }
      }
    }

    function unlockSites(event) {
      event.preventDefault();
      if (unlocking || Date.now() < lockoutUntil) return;
      const value = passwordInput?.value || "";
      if (!value) {
        showLockError("请输入访问密码。");
        passwordInput?.focus();
        return;
      }
      unlocking = true;
      setUnlockBusy(true);
      showLockError("");
      if (value !== SITE_PASSWORD) {
        failedAttempts += 1;
        unlocking = false;
        setUnlockBusy(false);
        if (failedAttempts >= MAX_ATTEMPTS) {
          startLockout();
        } else {
          showLockError(`密码不正确，还可尝试 ${MAX_ATTEMPTS - failedAttempts} 次。`);
        }
        shakeLockCard();
        passwordInput?.select();
        return;
      }
      clearLockout();
      unlocking = false;
      if (unlockButton) unlockButton.disabled = true;
      writeUnlocked(true);
      lockScreen?.classList.add("is-unlocking");
      window.setTimeout(() => {
        lockScreen?.classList.remove("is-unlocking");
        setLocked(false);
        renderFilterButtons();
        renderSites();
        panel?.classList.add("is-revealing");
        window.setTimeout(() => panel?.classList.remove("is-revealing"), 700);
        toast("站点导航已解锁", { type: "success" });
      }, 260);
    }

    lockForm?.addEventListener("submit", unlockSites);
    passwordToggle?.addEventListener("click", () => {
      if (!passwordInput || !passwordToggle) return;
      const show = passwordInput.type === "password";
      passwordInput.type = show ? "text" : "password";
      passwordToggle.textContent = show ? "隐藏" : "显示";
      passwordToggle.setAttribute("aria-label", show ? "隐藏密码" : "显示密码");
      passwordInput.focus();
    });
    passwordInput?.addEventListener("input", () => {
      if (Date.now() >= lockoutUntil) showLockError("");
    });
    lockButton?.addEventListener("click", () => {
      if (panel?.classList.contains("is-locking")) return;
      panel?.classList.add("is-locking");
      window.setTimeout(() => {
        writeUnlocked(false);
        panel?.classList.remove("is-revealing");
        setLocked(true, { focus: true });
        panel?.classList.remove("is-locking");
        toast("站点导航已锁定", { type: "info" });
      }, 220);
    });

    lockScreen?.addEventListener("pointermove", (event) => {
      if (!lockScreen || reducedMotion) return;
      const card = lockScreen.querySelector(".sites-lock-card");
      if (!card) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--sites-mx", `${((event.clientX - rect.left) / rect.width) * 100}%`);
      card.style.setProperty("--sites-my", `${((event.clientY - rect.top) / rect.height) * 100}%`);
    });

    window.addEventListener("storage", syncFavoritesFromStorage);
    const initiallyUnlocked = readUnlocked();
    setLocked(!initiallyUnlocked, { focus: !initiallyUnlocked });
    if (initiallyUnlocked) {
      renderFilterButtons();
      renderSites();
    }
    return () => {
      scheduledRender.cancel();
      window.clearInterval(lockoutTimer);
      window.removeEventListener("storage", syncFavoritesFromStorage);
    };
  }

