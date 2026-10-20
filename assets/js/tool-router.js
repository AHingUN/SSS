/* ==========================================================================
   Tool initializer router
   ChengYu · Lumen Toolkit
   ========================================================================== */
"use strict";

  /* ----------------------------------------------------------------------
     Tool initialiser router
     ---------------------------------------------------------------------- */
  /*
    工具生命周期约定（所有 initXxxTool 共用这一套，不再在每个工具里重复说明）：

    1. 07-routing.js 根据 Hash 找到工具 ID，克隆 index.html 里的 `tpl-<id>`。
    2. 本函数按 ID 调用对应的 init 函数；初始化函数只操作已经挂载的 DOM。
    3. init 可以返回 cleanup；离开工具页时由 cleanupTool() 执行。
    4. 初始化函数必须对模板缺失做防御，不要假设页面一定存在。
    5. 单位工具特殊：先初始化换算器，再初始化科学计算器，最后合并 cleanup。

    新增工具时：TOOLS 数据、tpl-<id> 模板、本路由和底部 <script> 必须同步。
  */
  function initTool(id) {
    switch (id) {
      case "json": return initJsonTool();
      case "qr": return initQrTool();
      case "color": return initColorTool();
      case "password": return initPasswordTool();
      case "unit": {
        const unitCleanup = initUnitTool();
        const advancedCleanup = typeof initUnitAdvanced === "function" ? initUnitAdvanced() : null;
        return () => {
          unitCleanup?.();
          advancedCleanup?.();
        };
      }
      case "timestamp": return initTimestampTool();
      case "image": return initImageTool();
      case "text": return initTextTool();
      case "encode": return initEncodeTool();
      case "random": return initRandomTool();
      case "url": return initUrlTool();
      case "extract": return initExtractTool();
      case "sites": return initSitesTool();
      case "regex": return initRegexTool();
      case "hash": return initHashTool();
      case "uuid": return initUuidTool();
      case "datecalc": return initDateTool();
      case "markdown": return initMarkdownTool();
      case "csv": return initCsvTool();
      case "diff": return initDiffTool();
      case "jwt": return initJwtTool();
      case "imagepalette": return initImagePaletteTool();
      case "cron": return initCronTool();
      case "webstudio": return initWebStudioTool();
      case "media": return initMediaTool();
      case "data": return initDataTool();
      case "filekit": return initFileKitTool();
      case "favicon": return initFaviconTool();
      case "life": return initLifeTool();
      case "crop": return initCropTool();
      default: return null;
    }
  }

