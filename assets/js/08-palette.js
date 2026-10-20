/* ==========================================================================
   Command palette search and actions
   ChengYu · Lumen Toolkit
   ========================================================================== */
"use strict";

  /* ----------------------------------------------------------------------
     Command palette
     ---------------------------------------------------------------------- */
  function paletteActions() {
    const theme = root.dataset.theme === "dark" ? "dark" : "light";
    const actions = [
      {
        kind: "action",
        label: `切换到${theme === "dark" ? "浅色" : "深色"}外观`,
        meta: "外观 · 本地偏好",
        icon: theme === "dark" ? "sun" : "moon",
        tint: "",
        keywords: "主题 外观 深色 浅色 夜间 模式 theme",
        run: () => toggleTheme(),
      },
      {
        kind: "action",
        label: "查看我的收藏",
        meta: `${favorites.size} 个收藏 · 快捷导航`,
        icon: "star",
        tint: "",
        keywords: "收藏 喜欢 favorites",
        run: goToFavorites,
      },
      {
        kind: "action",
        label: "全屏时钟",
        meta: "本地时间 · 专注与计时",
        icon: "clock",
        tint: "orange",
        keywords: "时间 时钟 全屏 专注 秒表 倒计时 clock time 本地",
        run: openClock,
      },
      {
        kind: "action",
        label: "作者简介",
        meta: "关于作者 · 程宇",
        icon: "mark",
        tint: "plum",
        keywords: "作者 简介 制作 人 maker author about me",
        run: openAuthor,
      },
      {
        kind: "action",
        label: "关于程宇与隐私",
        meta: "本地优先 · 关于",
        icon: "info",
        tint: "",
        keywords: "关于 隐私 本地 数据 about privacy",
        run: openAbout,
      },
    ];

    if (currentToolId) {
      actions.unshift({
        kind: "action",
        label: "回到工具箱",
        meta: "首页 · 快捷导航",
        icon: "home",
        tint: "",
        keywords: "首页 工具 返回 home",
        run: goToHomeTop,
      });
    }
    return actions;
  }

  function paletteHostOf(url) {
    try {
      return new URL(url).hostname.replace(/^www\./i, "");
    } catch (error) {
      return "";
    }
  }

  function paletteEditDistance(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
    for (let index = 1; index <= a.length; index += 1) {
      const current = [index];
      for (let other = 1; other <= b.length; other += 1) {
        const cost = a[index - 1] === b[other - 1] ? 0 : 1;
        current[other] = Math.min(
          previous[other] + 1,
          current[other - 1] + 1,
          previous[other - 1] + cost
        );
      }
      previous = current;
    }
    return previous[b.length];
  }

  function paletteTokenScore(token, text, allowFuzzy = true) {
    if (!token || !text) return 0;
    if (text === token) return 124;
    if (text.startsWith(token)) return token.length >= 2 ? 100 : 62;
    if (text.includes(` ${token}`)) return 84;
    if (text.includes(token)) return 72;
    if (!allowFuzzy || token.length < 2) return 0;

    const compact = text.replace(/\s+/g, "");
    let queryIndex = 0;
    let lastIndex = -1;
    let gaps = 0;
    for (let index = 0; index < compact.length && queryIndex < token.length; index += 1) {
      if (compact[index] !== token[queryIndex]) continue;
      if (lastIndex >= 0) gaps += index - lastIndex - 1;
      lastIndex = index;
      queryIndex += 1;
    }
    if (queryIndex === token.length) {
      if (gaps > Math.max(2, Math.ceil(token.length * 1.5))) return 0;
      const lengthPenalty = Math.max(0, compact.length - token.length) * 0.18;
      return Math.max(18, 56 - Math.min(24, gaps * 2) - Math.min(12, lengthPenalty));
    }

    if (token.length < 3) return 0;
    let bestTypoScore = 0;
    const words = text.split(" ").filter((word) => word.length >= 3);
    for (const word of words) {
      const maxDistance = token.length >= 8 ? 2 : 1;
      if (Math.abs(word.length - token.length) > maxDistance) continue;
      const distance = paletteEditDistance(token, word);
      if (distance <= maxDistance) {
        bestTypoScore = Math.max(bestTypoScore, 68 - distance * 16);
      }
    }
    return bestTypoScore;
  }

  function paletteTypeText(kind) {
    if (kind === "tool") return "工具 toolkit tool";
    if (kind === "site") return "站点导航 网站 站点 website site link directory";
    if (kind === "friend") return "友情链接 友链 外部资源 friend link friends";
    return "快捷操作 命令 command action";
  }

  /*
    站点 / 友链 / 工具都先转成统一 command 结构，再由同一套评分和渲染
    逻辑处理。这样新增结果类型只需追加 command，不必复制搜索面板。
  */
  function paletteSiteCommand(site) {
    const category = SITE_CATEGORIES.find((item) => item.id === site.category);
    const categoryLabel = category?.label || "站点";
    return {
      kind: "site",
      label: site.name,
      meta: `站点导航 · ${categoryLabel} · ${site.desc}`,
      icon: "compass",
      mark: site.mark,
      tint: site.tint,
      url: site.url,
      aliases: `${site.name} ${site.mark}`,
      keywords: `${site.name} ${site.desc} ${site.keywords} ${categoryLabel} 站点 网站 导航 分类`,
    };
  }

  function paletteFriendCommand(friend) {
    return {
      kind: "friend",
      label: friend.name,
      meta: `友情链接 · ${friend.tag} · ${friend.desc}`,
      icon: "external",
      mark: friend.mark,
      tint: friend.tint,
      url: friend.url,
      aliases: `${friend.name} ${friend.mark} ${friend.tag}`,
      keywords: `${friend.name} ${friend.desc} ${friend.tag} 友情链接 友链 资源`,
    };
  }

  function paletteToolCommand(tool) {
    return {
      kind: "tool",
      id: tool.id,
      label: tool.name,
      meta: `${CATEGORY_META[tool.category].label} · ${tool.desc}`,
      icon: tool.icon,
      tint: tool.tint,
      aliases: `${tool.id} ${CATEGORY_META[tool.category].label} ${CATEGORY_META[tool.category].en}`,
      keywords: `${tool.name} ${tool.desc} ${tool.keywords}`,
    };
  }

  /*
    搜索评分是“可解释的轻量模糊匹配”，不是搜索引擎：
    - name 命中权重最高，其次 aliases / 域名 / 关键词；
    - 每个 token 单独评分后求和，避免长关键词稀释精确命中；
    - 先用 WeakMap 缓存每条命令的规范化字段，输入时只做评分；
    - 结果按类型分组并限量，保证面板打开速度稳定。
  */
  function scorePaletteCommand(command, query) {
    let fields = paletteFieldCache.get(command);
    if (!fields) {
      fields = {
        name: normalizePaletteText(command.label),
        aliases: normalizePaletteText(`${command.aliases || ""} ${command.id || ""}`),
        domain: normalizePaletteText(paletteHostOf(command.url)),
        keywords: normalizePaletteText(command.keywords),
        meta: normalizePaletteText(command.meta),
        type: normalizePaletteText(paletteTypeText(command.kind)),
      };
      paletteFieldCache.set(command, fields);
    }
    const tokens = query.split(" ").filter(Boolean);
    if (!tokens.length) return 0;

    let total = 0;
    for (const token of tokens) {
      const best = Math.max(
        paletteTokenScore(token, fields.name, true) * 1.7,
        paletteTokenScore(token, fields.aliases, true) * 1.4,
        paletteTokenScore(token, fields.domain, false) * 1.3,
        paletteTokenScore(token, fields.keywords, false) * 1.05,
        paletteTokenScore(token, fields.meta, false) * 0.8,
        paletteTokenScore(token, fields.type, false) * 0.55
      );
      if (!best) return 0;
      total += best;
    }
    total /= tokens.length;

    if (fields.name === query) total += 70;
    else if (fields.name.startsWith(query)) total += 30;
    if (fields.keywords.includes(query) || fields.meta.includes(query)) total += 6;
    return total;
  }

  function rankPaletteCommands(commands, query) {
    if (!query) return commands;
    return commands
      .map((command) => ({ command, score: scorePaletteCommand(command, query) }))
      .filter((entry) => entry.score > 0)
      .sort(
        (left, right) =>
          right.score - left.score ||
          left.command.label.localeCompare(right.command.label, "zh-CN")
      )
      .map((entry) => entry.command);
  }

  function buildPaletteGroup(label, commands, query, limit) {
    const ranked = rankPaletteCommands(commands, query);
    if (!ranked.length) return null;
    const items = query && limit ? ranked.slice(0, limit) : ranked;
    return {
      label,
      items,
      total: ranked.length,
      extra: ranked.length - items.length,
    };
  }

  function sitesAreUnlocked() {
    try {
      return sessionStorage.getItem("lumen.sitesUnlocked") === "1";
    } catch (error) {
      return false;
    }
  }

  function renderPalette(query = "") {
    const normalized = normalizePaletteText(query);
    const hasQuery = Boolean(normalized);    const toolCommands = hasQuery
      ? paletteToolCommandsCache ||
        (paletteToolCommandsCache = TOOLS.map(paletteToolCommand))
      : [];
    const siteCommands = hasQuery && sitesAreUnlocked()
      ? paletteSiteCommandsCache ||
        (paletteSiteCommandsCache = SITE_LINKS.map(paletteSiteCommand))
      : [];
    const friendCommands = hasQuery
      ? paletteFriendCommandsCache ||
        (paletteFriendCommandsCache = FRIEND_LINKS.map(paletteFriendCommand))
      : [];
    const groups = [
      hasQuery ? buildPaletteGroup("工具", toolCommands, normalized, 8) : null,
      hasQuery ? buildPaletteGroup("站点导航", siteCommands, normalized, 8) : null,
      hasQuery ? buildPaletteGroup("友情链接", friendCommands, normalized, 6) : null,
      buildPaletteGroup("快捷操作", paletteActions(), normalized, hasQuery ? 4 : null),
    ].filter(Boolean);

    paletteCommands = groups.flatMap((group) => group.items);

    if (!paletteCommands.length) {
      paletteResults.innerHTML = `
        <div class="palette-empty">
          ${icon("search")}
          <strong>没有找到「${escapeHTML(query.trim())}」</strong>
          <span>试试工具名、站点域名、用途，或「友情链接」「设计」。</span>
        </div>`;
      paletteActive = -1;
      paletteInput.removeAttribute("aria-activedescendant");
      return;
    }

    let index = 0;
    const shortcutHint = hasQuery
      ? ""
      : `<div class="palette-shortcut-hint"><span>输入关键词搜索 ${TOOLS.length} 款工具、站点与友情链接</span></div>`;
    paletteResults.innerHTML =
      shortcutHint +
      groups
        .map((group) => {
          const items = group.items
            .map((command) => {
              const current = index;
              index += 1;
              const tinted = command.tint ? ` tint-${command.tint} tinted` : "";
              const markClass = command.mark ? " has-mark" : "";
              const symbol = command.mark ? escapeHTML(command.mark) : icon(command.icon);
              const hint =
                command.kind === "tool" ? "↵" : command.kind === "action" ? "命令" : "↗";
              return `
              <button class="palette-item" type="button" role="option" aria-selected="false" id="palette-item-${current}" data-index="${current}" data-kind="${command.kind}">
                <span class="palette-item-icon${tinted}${markClass}">${symbol}</span>
                <span class="palette-item-copy">
                  <span class="palette-item-name">${escapeHTML(command.label)}</span>
                  <span class="palette-item-meta">${escapeHTML(command.meta)}</span>
                </span>
                <span class="palette-item-hint">${hint}</span>
              </button>`;
            })
            .join("");
          const more = group.extra
            ? `<div class="palette-group-more">还有 ${group.extra} 个匹配，继续输入以缩小范围</div>`
            : "";
          return `<div class="palette-group" role="group" aria-label="${escapeHTML(group.label)}"><div class="palette-group-label"><span>${escapeHTML(group.label)}</span><span class="palette-group-count">${group.items.length}${group.extra ? ` / ${group.total}` : ""}</span></div>${items}${more}</div>`;
        })
        .join("");

    paletteActive = 0;
    updatePaletteSelection();
  }

  function updatePaletteSelection() {
    const items = $$(".palette-item", paletteResults);
    items.forEach((item) => {
      const selected = Number(item.dataset.index) === paletteActive;
      item.classList.toggle("is-selected", selected);
      item.setAttribute("aria-selected", selected ? "true" : "false");
    });
    if (paletteActive >= 0) {
      const selected = $(`.palette-item[data-index="${paletteActive}"]`, paletteResults);
      if (selected) {
        paletteInput.setAttribute("aria-activedescendant", selected.id);
        selected.scrollIntoView({ block: "nearest" });
      }
    } else {
      paletteInput.removeAttribute("aria-activedescendant");
    }
  }

  function movePaletteSelection(direction) {
    const items = $$(".palette-item", paletteResults);
    if (!items.length) return;
    paletteActive = (paletteActive + direction + items.length) % items.length;
    updatePaletteSelection();
  }

  function openPalette() {
    if (aboutDialog.open) closeAbout({ instant: true });
    if (authorDialog.open) closeAuthor({ instant: true });
    if (clockDialog.open) closeClock({ instant: true });
    if (paletteDialog.open) {
      paletteInput.focus();
      return;
    }
    paletteClosing = false;
    paletteDialog.classList.remove("is-closing");
    paletteSurface.classList.remove("is-closing");
    paletteInput.value = "";
    renderPalette("");
    paletteDialog.showModal();
    document.body.classList.add("modal-open");
    window.requestAnimationFrame(() => paletteInput.focus());
  }

  function closePalette({ instant = false } = {}) {
    if (!paletteDialog.open || paletteClosing) return;
    if (instant || reducedMotion) {
      paletteDialog.close();
      paletteDialog.classList.remove("is-closing");
      paletteSurface.classList.remove("is-closing");
      paletteClosing = false;
      return;
    }
    paletteClosing = true;
    paletteDialog.classList.add("is-closing");
    paletteSurface.classList.add("is-closing");
    window.setTimeout(() => {
      if (paletteDialog.open) paletteDialog.close();
      paletteDialog.classList.remove("is-closing");
      paletteSurface.classList.remove("is-closing");
      paletteClosing = false;
    }, 150);
  }

  function openExternalLink(url) {
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function runPaletteCommand(index) {
    const command = paletteCommands[index];
    if (!command || paletteCommanding) return;
    paletteCommanding = true;

    const item = $(`#palette-item-${index}`, paletteResults);
    item?.classList.add("is-activating");

    if (command.kind === "site" || command.kind === "friend") {
      closePalette();
      openExternalLink(command.url);
      window.setTimeout(() => {
        paletteCommanding = false;
      }, 180);
      return;
    }

    if (command.kind === "tool") {
      const sourceNode = item?.querySelector(".palette-item-icon")?.cloneNode(true) || null;
      const sourceRect = item?.querySelector(".palette-item-icon")?.getBoundingClientRect() || null;
      closePalette({ instant: true });
      window.requestAnimationFrame(() => {
        if (command.id !== currentToolId) {
          openTool(
            command.id,
            null,
            sourceRect && sourceNode ? { sourceRect, sourceNode } : undefined
          );
        }
        paletteCommanding = false;
      });
      return;
    }

    closePalette();
    window.setTimeout(() => {
      command.run();
      paletteCommanding = false;
    }, reducedMotion ? 0 : 160);
  }

