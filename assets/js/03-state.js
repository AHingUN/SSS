/* ==========================================================================
   Persisted state, preferences and shared UI state
   ChengYu · Lumen Toolkit
   ========================================================================== */
"use strict";

  /* ----------------------------------------------------------------------
     Saved state
     ---------------------------------------------------------------------- */
  /*
    这一层只保存“跨页面共享、需要持久化”的少量状态：
    - 收藏 / 最近使用：工具首页与搜索共用；
    - 主题：由 05-ui.js 写入，启动前内联脚本读取；
    - 时钟与专注模式：09-overlays.js 读取 / 写入；
    - 计时器、弹窗打开状态等纯运行时状态不写入 localStorage。

    首次运行或存储不可用时，下面的默认值保证页面仍可正常使用。
  */
  const favorites = new Set(
    safeStorageGet("lumen.favorites", []).filter((id) => TOOL_MAP.has(id))
  );
  const storedRecent = safeStorageGet("lumen.recent", []);
  const recents = Array.isArray(storedRecent)
    ? storedRecent.filter((id) => TOOL_MAP.has(id)).slice(0, 4)
    : [];

  let activeFilter = "all";
  let toolGridExpanded = false;
  const INITIAL_TOOL_LIMIT = 6;
  let currentToolId = null;
  let currentCleanup = null;
  let homeScroll = 0;
  let pendingHomeAction = null;
  let paletteCommands = [];
  let paletteActive = 0;
  let paletteClosing = false;
  let paletteCommanding = false;
  let aboutClosing = false;
  let authorClosing = false;
  let clockClosing = false;
  let clockTimer = 0;
  let clockTimerLoop = 0;
  let focusChromeTimer = 0;
  let focusPanelClosing = false;
  let focusTransitioning = false;
  const stopwatch = { running: false, startedAt: 0, elapsed: 0 };
  const countdown = { running: false, endAt: 0, remaining: 300000, total: 300000 };
  const storedClockSettings = safeStorageGet("lumen.clock", {});
  const clockSettings = {
    hours24: storedClockSettings?.hours24 !== false,
    seconds: storedClockSettings?.seconds !== false,
  };
  const FOCUS_WEIGHTS = { thin: 220, light: 300, regular: 590, medium: 650, bold: 730, black: 820 };
  const FOCUS_STYLES = ["minimal", "mono", "serif", "outline"];
  const FOCUS_ALIGNS = ["left", "center", "right"];
  const FOCUS_ATMOSPHERES = ["auto", "dawn", "day", "dusk", "night", "clear"];
  const storedFocusPrefs = safeStorageGet("lumen.clockFocus", {});
  const focusPrefs = {
    size: Math.min(180, Math.max(55, Number(storedFocusPrefs?.size) || 100)),
    weight: Object.prototype.hasOwnProperty.call(FOCUS_WEIGHTS, storedFocusPrefs?.weight)
      ? storedFocusPrefs.weight
      : "regular",
    style: FOCUS_STYLES.includes(storedFocusPrefs?.style) ? storedFocusPrefs.style : "minimal",
    tracking: Number.isFinite(Number(storedFocusPrefs?.tracking))
      ? Math.min(0.18, Math.max(-0.12, Number(storedFocusPrefs.tracking)))
      : -0.06,
    align: FOCUS_ALIGNS.includes(storedFocusPrefs?.align) ? storedFocusPrefs.align : "center",
    offset: Math.min(18, Math.max(-18, Number(storedFocusPrefs?.offset) || 0)),
    atmosphere: FOCUS_ATMOSPHERES.includes(storedFocusPrefs?.atmosphere)
      ? storedFocusPrefs.atmosphere
      : "auto",
    glow: Boolean(storedFocusPrefs?.glow),
  };
  const localTimeZone = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "本地时区";
    } catch (error) {
      return "本地时区";
    }
  })();
  const paletteFieldCache = new WeakMap();
  let paletteToolCommandsCache = null;
  let paletteSiteCommandsCache = null;
  let paletteFriendCommandsCache = null;

  const homeView = $("#homeView");
  const toolRoot = $("#toolRoot");
  const toolGrid = $("#toolGrid");
  const gridEmpty = $("#gridEmpty");
  const recentBar = $("#recentBar");
  const recentList = $("#recentList");
  const topbar = $("#topbar");
  const toastRegion = $("#toastRegion");
  const paletteDialog = $("#paletteDialog");
  const paletteSurface = $(".palette-surface", paletteDialog);
  const paletteInput = $("#paletteInput");
  const paletteResults = $("#paletteResults");
  const aboutDialog = $("#aboutDialog");
  const aboutSurface = $(".about-surface", aboutDialog);
  const authorDialog = $("#authorDialog");
  const authorScreen = $(".author-screen", authorDialog);
  const clockDialog = $("#clockDialog");
  const clockScreen = $("#clockScreen", clockDialog);
  const clockEls = {
    close: $("#clockClose"),
    screen: clockScreen,
    time: $("#clockBigTime"),
    seconds: $("#clockBigSeconds"),
    period: $("#clockPeriod"),
    focusRule: $("#clockFocusRule"),
    date: $("#clockDate"),
    zone: $("#clockZone"),
    dayProgress: $("#clockDayProgressText"),
    dayMetric: $("#clockDayMetric"),
    weekMetric: $("#clockWeekMetric"),
    yearMetric: $("#clockYearMetric"),
    dayBar: $("#clockDayBar"),
    weekBar: $("#clockWeekBar"),
    yearBar: $("#clockYearBar"),
    dayRing: $("#clockDayRing"),
    hourHand: $("#clockHourHand"),
    minuteHand: $("#clockMinuteHand"),
    secondHand: $("#clockSecondHand"),
    dialCaption: $("#clockDialCaption"),
    format: $("#clockFormatToggle"),
    secondsToggle: $("#clockSecondsToggle"),
    fullscreen: $("#clockFullscreen"),
    copy: $("#clockCopy"),
    focus: $("#clockFocus"),
    focusExit: $("#clockFocusExit"),
    focusCustomize: $("#clockFocusCustomize"),
    focusPanel: $("#clockFocusPanel"),
    focusSize: $("#clockFocusSize"),
    focusSizeValue: $("#clockFocusSizeValue"),
    focusPreview: $("#clockFocusPreview"),
    focusTracking: $("#clockFocusTracking"),
    focusTrackingValue: $("#clockFocusTrackingValue"),
    focusOffset: $("#clockFocusOffset"),
    focusOffsetValue: $("#clockFocusOffsetValue"),
    focusDone: $("#clockFocusDone"),
    focusReset: $("#clockFocusReset"),
    focusFormatButtons: $$("[data-focus-format]", clockDialog),
    focusStyleButtons: $$("[data-focus-style]", clockDialog),
    focusWeightButtons: $$("[data-focus-weight]", clockDialog),
    focusAlignButtons: $$("[data-focus-align]", clockDialog),
    focusAtmosphereButtons: $$("[data-focus-atmosphere]", clockDialog),
    focusGlowButtons: $$("[data-focus-glow]", clockDialog),
    stopwatchDisplay: $("#stopwatchDisplay"),
    stopwatchToggle: $("#stopwatchToggle"),
    stopwatchReset: $("#stopwatchReset"),
    countdownDisplay: $("#countdownDisplay"),
    countdownToggle: $("#countdownToggle"),
    countdownReset: $("#countdownReset"),
    countdownCard: $("#countdownCard"),
    countdownPresets: $$("[data-countdown]", clockDialog),
  };

