/* ==========================================================================
   Tool catalogue, site directory data and navigation metadata
   ChengYu · Lumen Toolkit
   ========================================================================== */
"use strict";

  /* ----------------------------------------------------------------------
     Tool catalogue
     ---------------------------------------------------------------------- */
  /*
    工具目录的唯一数据源：
    - id 与 index.html 的 `tpl-<id>`、tool-router.js 的 init 分支保持一致。
    - category 只使用 dev / design / web / text / daily 五类。
    - tint 是图标与卡片的低饱和装饰色，不是主按钮颜色。
    新增工具时先改这里，再补模板、脚本、路由和文档。
  */
  const CATEGORY_META = {
    dev: { label: "开发", en: "DEV" },
    design: { label: "设计", en: "DESIGN" },
    web: { label: "网址", en: "WEB" },
    text: { label: "文字", en: "TEXT" },
    daily: { label: "日常", en: "DAILY" },
  };

  const TINT_COLORS = {
    blue: "#3679ee",
    violet: "#7458e9",
    pink: "#ef6292",
    green: "#20a376",
    orange: "#f28b28",
    teal: "#1699a9",
    cyan: "#2691d8",
    indigo: "#5252ce",
    rose: "#e55461",
    sky: "#258ed8",
    lime: "#4e9d43",
    plum: "#9451c9",
    sand: "#a98042",
  };

  const TOOLS = [
    {
      id: "sites",
      name: "站点导航",
      desc: "23 个真实网站，按设计、灵感、开发、效率与素材分类整理。",
      category: "web",
      icon: "compass",
      tint: "plum",
      isNew: true,
      keywords: "真实网站 网址 导航 设计 灵感 开发 效率 素材 分类 书签 外部链接",
    },
    {
      id: "json",
      name: "JSON 工作台",
      desc: "格式化、压缩、键排序与校验 JSON，错误定位一目了然。",
      category: "dev",
      icon: "braces",
      tint: "blue",
      featured: true,
      deco: "code",
      keywords: "json 格式化 压缩 校验 排序 代码 语法 developer",
    },
    {
      id: "qr",
      name: "二维码工坊",
      desc: "把链接、中文或任意 Unicode 文字变成高清二维码，导出 PNG / SVG。",
      category: "daily",
      icon: "qr",
      tint: "violet",
      keywords: "二维码 qr 中文 unicode 链接 生成 下载 扫码 svg",
    },
    {
      id: "color",
      name: "颜色实验室",
      desc: "在 HEX、RGB、HSL 之间自由转换，还能检查 WCAG 对比度。",
      category: "design",
      icon: "palette",
      tint: "pink",
      keywords: "颜色 取色 hex rgb hsl 色板 配色 调色 对比度 wcag",
    },
    {
      id: "password",
      name: "密码生成器",
      desc: "定制长度与字符集，生成足够强的随机密码。",
      category: "dev",
      icon: "key",
      tint: "green",
      keywords: "密码 password 随机 安全 强度 生成",
    },
    {
      id: "unit",
      name: "单位换算",
      desc: "16 类单位即时换算，附带科学计算器、记忆与历史记录。",
      category: "daily",
      icon: "ruler",
      tint: "orange",
      keywords: "单位 换算 长度 重量 温度 数据 面积 体积 速度 时间 压强 能量 功率 角度 频率 扭矩 油耗 计算器 科学计算器 sin cos log 阶乘 百分比 历史 记忆",
    },
    {
      id: "timestamp",
      name: "时间戳转换",
      desc: "Unix 时间戳与本地日期双向转换，秒与毫秒自动识别。",
      category: "dev",
      icon: "clock",
      tint: "teal",
      keywords: "时间戳 unix 日期 时间 秒 毫秒 转换 timestamp",
    },
    {
      id: "image",
      name: "图片压缩",
      desc: "在浏览器内调整尺寸与画质，压缩后直接下载。",
      category: "design",
      icon: "image",
      tint: "cyan",
      featured: true,
      deco: "photo",
      keywords: "图片 压缩 尺寸 画质 webp jpeg png 转换 下载",
    },
    {
      id: "text",
      name: "文本分析",
      desc: "像文档一样写作、排版与分析，支持 Word / TXT / HTML 导出。",
      category: "text",
      icon: "type",
      tint: "indigo",
      keywords: "文本 字数 统计 词语 行数 段落 句子 阅读时间 大小写 撤销 word docx 文档 排版 富文本 查找 替换 导出 写作",
    },
    {
      id: "encode",
      name: "编码转换",
      desc: "Base64、URL 与 UTF-8 Hex 编解码，Unicode 安全，实时转换。",
      category: "dev",
      icon: "link",
      tint: "rose",
      keywords: "编码 base64 url hex 解码 转码 unicode",
    },
    {
      id: "random",
      name: "随机抽签",
      desc: "五种抽奖动画，加密级随机，支持不重复抽取。",
      category: "daily",
      icon: "sparkles",
      tint: "violet",
      keywords: "随机 抽签 抽奖 动画 老虎机 翻牌 礼花 名单 公平",
    },
    {
      id: "url",
      name: "链接解剖台",
      desc: "拆解网址结构、编辑查询参数，顺手清理跟踪链接。",
      category: "web",
      icon: "globe",
      tint: "sky",
      isNew: true,
      keywords: "网址 链接 url 解析 参数 查询 utm 跟踪 清理 端口 域名",
    },
    {
      id: "extract",
      name: "链接提取器",
      desc: "从一段文字或 HTML 中提取所有链接，去重、复制或下载。",
      category: "web",
      icon: "scan",
      tint: "lime",
      isNew: true,
      keywords: "网址 链接 提取 url 文本 html 批量 去重 域名 下载",
    },
    {
      id: "regex",
      name: "正则测试器",
      desc: "即时验证正则表达式，高亮命中结果并查看捕获组。",
      category: "dev",
      icon: "code",
      tint: "teal",
      isNew: true,
      keywords: "正则 regex 表达式 匹配 捕获组 测试 开发",
    },
    {
      id: "hash",
      name: "哈希摘要",
      desc: "用 Web Crypto 生成 SHA 摘要，本地计算，不上传文本。",
      category: "dev",
      icon: "hash",
      tint: "indigo",
      isNew: true,
      keywords: "哈希 hash sha1 sha256 sha512 摘要 校验 加密",
    },
    {
      id: "uuid",
      name: "UUID 生成器",
      desc: "批量生成 UUID v4 或短 ID，适合主键、标识与测试数据。",
      category: "dev",
      icon: "id",
      tint: "orange",
      isNew: true,
      keywords: "uuid guid 短id 随机 标识 主键 生成 批量",
    },
    {
      id: "datecalc",
      name: "日期计算器",
      desc: "计算两个日期之间相隔多久，或推算指定日期加减。",
      category: "daily",
      icon: "calendar",
      tint: "green",
      isNew: true,
      keywords: "日期 计算 间隔 天数 推算 加 减 周 月 年",
    },
    {
      id: "markdown",
      name: "Markdown 预览",
      desc: "边写边渲染标题、列表、代码与链接，可复制渲染后的 HTML。",
      category: "text",
      icon: "file-text",
      tint: "sand",
      featured: true,
      deco: "markdown",
      isNew: true,
      keywords: "markdown md 文档 预览 排版 编辑器 笔记 写作",
    },
    {
      id: "csv",
      name: "CSV / JSON",
      desc: "在 CSV 与 JSON 之间双向转换，自动处理表头、分隔符和引号。",
      category: "dev",
      icon: "table",
      tint: "green",
      isNew: true,
      keywords: "csv json 表格 转换 数据 表头 分隔符 excel",
    },
    {
      id: "diff",
      name: "文本对比",
      desc: "逐行比较两段文字，高亮新增、删除和未变化的内容。",
      category: "text",
      icon: "diff",
      tint: "rose",
      isNew: true,
      keywords: "文本 对比 diff 差异 比较 合并 补丁 代码",
    },
    {
      id: "jwt",
      name: "JWT 解码",
      desc: "本地拆解 JWT 头部、载荷和过期时间，不验证签名、不上传令牌。",
      category: "dev",
      icon: "token",
      tint: "orange",
      isNew: true,
      keywords: "jwt token 解码 头部 载荷 过期 时间 登录 鉴权",
    },
    {
      id: "imagepalette",
      name: "图片色板",
      desc: "拖入图片，提取主色与一组可直接复制的配色，图片不离开设备。",
      category: "design",
      icon: "swatch",
      tint: "violet",
      isNew: true,
      keywords: "图片 色板 主色 配色 取色 color thief palette 提取",
    },
    {
      id: "cron",
      name: "Cron 表达式",
      desc: "解析五段 Cron，生成可读描述与接下来 5 次运行时间。",
      category: "dev",
      icon: "clock",
      tint: "teal",
      isNew: true,
      keywords: "cron 定时 表达式 计划任务 下次 运行 开发 调度",
    },
    {
      id: "webstudio",
      name: "网页工坊",
      desc: "实时 HTML / CSS / JS 预览、CSS 渐变与 Meta 标签生成。",
      category: "dev",
      icon: "code",
      tint: "sky",
      isNew: true,
      keywords: "html css js playground 前端 预览 渐变 meta og 网页",
    },
    {
      id: "media",
      name: "媒体工坊",
      desc: "本地录音、录屏、摄像头与文本朗读，支持暂停和多设备选择。",
      category: "daily",
      icon: "mic",
      tint: "rose",
      isNew: true,
      keywords: "录音 录屏 麦克风 屏幕 media tts 朗读 语音 本地",
    },
    {
      id: "data",
      name: "数据工坊",
      desc: "XML 格式化、Gzip 压缩解压与多进制转换。",
      category: "dev",
      icon: "database",
      tint: "indigo",
      isNew: true,
      keywords: "xml gzip 压缩 解压 进制 二进制 十六进制 数据",
    },
    {
      id: "filekit",
      name: "文件工坊",
      desc: "拖入任意文件，计算 SHA 摘要、Base64 编码或还原下载，文件不离开浏览器。",
      category: "dev",
      icon: "file-text",
      tint: "sand",
      isNew: true,
      keywords: "文件 file 哈希 sha 校验 base64 编码 解码 还原 大小 类型 本地 下载",
    },
    {
      id: "favicon",
      name: "Favicon 工坊",
      desc: "一张图片生成多种尺寸的站点图标，直接下载 PNG。",
      category: "design",
      icon: "image",
      tint: "green",
      isNew: true,
      keywords: "favicon 图标 icon png 16 32 180 192 512 网站 生成",
    },
    {
      id: "life",
      name: "生活计算器",
      desc: "贷款月供、BMI、小费与时区换算，一站算清楚。",
      category: "daily",
      icon: "calculator",
      tint: "orange",
      isNew: true,
      keywords: "贷款 房贷 月供 bmi 小费 百分比 时区 换算 计算器",
    },
    {
      id: "crop",
      name: "图片裁剪",
      desc: "旋转、缩放、按比例裁切图片，导出 PNG 或 JPEG。",
      category: "design",
      icon: "crop",
      tint: "cyan",
      isNew: true,
      keywords: "图片 裁剪 crop 旋转 缩放 比例 png jpeg 头像",
    },
  ];

  /*
    友情链接与站点导航分开维护：
    - 友情链接是首页友情区的小卡片，只展示名称、描述和标记；
    - RAW_SITE_LINKS 是站点导航的原始数据，使用分类 + 关键词；
    - 两者都只保存 URL，不在页面加载时请求目标网站图标或内容。
  */
  const FRIEND_LINKS = [
    {
      name: "W3C",
      desc: "开放 Web 标准与规范",
      url: "https://www.w3.org/",
      tag: "标准",
      mark: "W3",
      tint: "indigo",
    },
    {
      name: "CSS-Tricks",
      desc: "前端技巧、布局与灵感",
      url: "https://css-tricks.com/",
      tag: "前端",
      mark: "C",
      tint: "orange",
    },
    {
      name: "WebAIM",
      desc: "无障碍设计与实践资源",
      url: "https://webaim.org/",
      tag: "无障碍",
      mark: "W",
      tint: "green",
    },
    {
      name: "qrcode-generator",
      desc: "程宇二维码引擎的出处",
      url: "https://github.com/kazuhikoarase/qrcode-generator",
      tag: "开源",
      mark: "Q",
      tint: "violet",
    },
    {
      name: "Smashing Magazine",
      desc: "设计、开发与用户体验文章",
      url: "https://www.smashingmagazine.com/",
      tag: "杂志",
      mark: "S",
      tint: "rose",
    },
    {
      name: "Chrome for Developers",
      desc: "Web 平台与浏览器开发资源",
      url: "https://developer.chrome.com/",
      tag: "平台",
      mark: "C",
      tint: "sky",
    },
  ];

  const SITE_CATEGORIES = [
    { id: "all", label: "全部", desc: "所有真实站点" },
    { id: "favorites", label: "收藏", desc: "你保存的站点", virtual: true },
    { id: "design", label: "设计", desc: "界面、产品与设计系统" },
    { id: "inspiration", label: "灵感", desc: "作品、视觉与创意参考" },
    { id: "dev", label: "开发", desc: "文档、兼容性与代码社区" },
    { id: "productivity", label: "效率", desc: "笔记、白板与文件工具" },
    { id: "visual", label: "素材", desc: "图片、摄影与字体资源" },
  ];

  // 站点导航原始数据。新增站点直接追加对象；下面的规范化阶段会校验
  // 协议、去重、补全分类、生成搜索文本和站点 key。
  // 非法条目只跳过自己，不影响整个目录。
  const RAW_SITE_LINKS = [
    {
      name: "Apple HIG",
      url: "https://developer.apple.com/design/human-interface-guidelines/",
      desc: "Apple 官方人机界面指南与设计资源",
      category: "design",
      mark: "A",
      tint: "blue",
      keywords: "apple hig 设计 指南 interface",
    },
    {
      name: "Awwwards",
      url: "https://www.awwwards.com/",
      desc: "全球优秀网页设计灵感与评选",
      category: "inspiration",
      mark: "A",
      tint: "pink",
      keywords: "网页 设计 灵感 获奖 网站",
    },
    {
      name: "Are.na",
      url: "https://www.are.na/",
      desc: "收藏、连接与整理视觉灵感",
      category: "inspiration",
      mark: "A",
      tint: "plum",
      keywords: "灵感 收藏 研究 视觉 内容 整理",
    },
    {
      name: "Dribbble",
      url: "https://dribbble.com/",
      desc: "设计师作品、灵感与视觉趋势",
      category: "inspiration",
      mark: "D",
      tint: "rose",
      keywords: "设计 作品 灵感 视觉 ui",
    },
    {
      name: "Figma Community",
      url: "https://www.figma.com/community",
      desc: "可直接复用的设计文件与插件",
      category: "design",
      mark: "F",
      tint: "violet",
      keywords: "figma 设计 组件 插件 ui",
    },
    {
      name: "Coolors",
      url: "https://coolors.co/",
      desc: "快速生成与探索配色方案",
      category: "design",
      mark: "C",
      tint: "sand",
      keywords: "配色 色板 颜色 设计 调色 工具",
    },
    {
      name: "Unsplash",
      url: "https://unsplash.com/",
      desc: "高质量免费摄影素材",
      category: "visual",
      mark: "U",
      tint: "indigo",
      keywords: "图片 摄影 素材 免费 unsplash",
    },
    {
      name: "Pexels",
      url: "https://www.pexels.com/",
      desc: "免费摄影与视频素材库",
      category: "visual",
      mark: "P",
      tint: "green",
      keywords: "图片 摄影 视频 素材 免费",
    },
    {
      name: "Fonts In Use",
      url: "https://fontsinuse.com/",
      desc: "真实项目中的字体使用档案",
      category: "visual",
      mark: "F",
      tint: "rose",
      keywords: "字体 排版 typography 案例 设计",
    },
    {
      name: "GitHub",
      url: "https://github.com/",
      desc: "代码托管与开源项目聚集地",
      category: "dev",
      mark: "G",
      tint: "indigo",
      keywords: "代码 开源 git 项目 仓库",
    },
    {
      name: "Visual Studio Code",
      url: "https://code.visualstudio.com/",
      desc: "全能的代码编辑器",
      category: "dev",
      mark: "V",
      tint: "cyan",
      keywords: "web 前端 文档 html css javascript",
    },
    {
      name: "Can I use",
      url: "https://caniuse.com/",
      desc: "浏览器特性支持情况查询",
      category: "dev",
      mark: "C",
      tint: "teal",
      keywords: "浏览器 兼容性 特性 css javascript",
    },
    {
      name: "web.dev",
      url: "https://web.dev/",
      desc: "现代 Web 体验与性能指南",
      category: "dev",
      mark: "W",
      tint: "sky",
      keywords: "web 性能 最佳实践 前端 教程",
    },
    {
      name: "Stack Overflow",
      url: "https://stackoverflow.com/",
      desc: "开发者问答与排错社区",
      category: "dev",
      mark: "S",
      tint: "orange",
      keywords: "问答 开发 排错 代码 社区",
    },
    {
      name: "Notion",
      url: "https://www.notion.so/",
      desc: "文档、知识与项目协作空间",
      category: "productivity",
      mark: "N",
      tint: "green",
      keywords: "笔记 文档 项目 协作 效率",
    },
    {
      name: "Excalidraw",
      url: "https://excalidraw.com/",
      desc: "手绘风白板与快速示意图",
      category: "productivity",
      mark: "E",
      tint: "violet",
      keywords: "白板 画图 流程图 手绘 协作",
    },
    {
      name: "Photopea",
      url: "https://www.photopea.com/",
      desc: "浏览器中的专业图片编辑器",
      category: "productivity",
      mark: "P",
      tint: "teal",
      keywords: "图片 编辑 psd 设计 工具",
    },
    {
      name: "Squoosh",
      url: "https://squoosh.app/",
      desc: "浏览器内的开源图片压缩实验",
      category: "productivity",
      mark: "S",
      tint: "sky",
      keywords: "图片 压缩 webp 画质 工具",
    },
    {
      name: "TinyPNG",
      url: "https://tinypng.com/",
      desc: "智能压缩 PNG 与 JPEG 图片",
      category: "productivity",
      mark: "T",
      tint: "lime",
      keywords: "图片 压缩 png jpeg 工具",
    },
    {
      name: "Product Hunt",
      url: "https://www.producthunt.com/",
      desc: "每天发现新的产品与创意",
      category: "inspiration",
      mark: "P",
      tint: "orange",
      keywords: "产品 发现 创业 新工具",
    },
    {
      name: "Hacker News",
      url: "https://news.ycombinator.com/",
      desc: "技术与创业社区的热门讨论",
      category: "dev",
      mark: "H",
      tint: "teal",
      keywords: "技术 新闻 创业 社区 hn",
    },
    {
      name: "少数派",
      url: "https://sspai.com/",
      desc: "数字生活、效率与产品内容",
      category: "productivity",
      mark: "少",
      tint: "plum",
      keywords: "数字生活 效率 应用 产品 中文",
    },
    {
      name: "It's Nice That",
      url: "https://www.itsnicethat.com/",
      desc: "设计、创意与文化观察",
      category: "inspiration",
      mark: "IN",
      tint: "lime",
      keywords: "设计 创意 文化 艺术 灵感",
    },
  ];

  const SITE_CATEGORY_IDS = new Set(
    SITE_CATEGORIES
      .filter((category) => category.id !== "all" && category.id !== "favorites")
      .map((category) => category.id)
  );

  /*
    站点规范化只做一次（IIFE 缓存结果）：
    1. 只允许 http / https；
    2. 相同 URL 去重；
    3. 未知分类回退到「灵感」；
    4. 生成稳定的 key、mark、tint、keywords；
    5. 预生成 searchText，搜索时不用每次重新拼接。
  */
  const SITE_LINKS = (() => {
    const seen = new Set();
    const sites = [];
    RAW_SITE_LINKS.forEach((site) => {
      try {
        const parsed = new URL(site.url);
        if (!/^https?:$/.test(parsed.protocol)) return;
        const url = parsed.href;
        if (seen.has(url)) return;
        seen.add(url);
        const host = parsed.hostname.replace(/^www\./i, "");
        const category = SITE_CATEGORY_IDS.has(site.category) ? site.category : "inspiration";
        const categoryName =
          SITE_CATEGORIES.find((item) => item.id === category)?.label || "灵感";
        const normalizedSite = {
          ...site,
          url,
          category,
          key: url,
          mark: String(site.mark || host.slice(0, 1).toUpperCase() || "·").slice(0, 2),
          tint: site.tint || "indigo",
          keywords: site.keywords || site.desc || "",
        };
        normalizedSite.searchText = normalizePaletteText(
          `${normalizedSite.name} ${normalizedSite.desc} ${normalizedSite.url} ${normalizedSite.keywords} ${categoryName} ${host}`
        );
        sites.push(normalizedSite);
      } catch (error) {
        /* Skip malformed entries so one bad site cannot break the directory. */
      }
    });
    return sites;
  })();

  const SITE_FAVORITES_KEY = "lumen.siteFavorites";

  function loadSiteFavorites() {
    try {
      const stored = JSON.parse(localStorage.getItem(SITE_FAVORITES_KEY) || "[]");
      if (!Array.isArray(stored)) return new Set();
      const valid = new Set(SITE_LINKS.map((site) => site.key));
      return new Set(stored.filter((key) => typeof key === "string" && valid.has(key)));
    } catch (error) {
      return new Set();
    }
  }

  let siteFavorites = loadSiteFavorites();

  function saveSiteFavorites() {
    try {
      localStorage.setItem(SITE_FAVORITES_KEY, JSON.stringify([...siteFavorites]));
      return true;
    } catch (error) {
      return false;
    }
  }

  const TOOL_MAP = new Map(TOOLS.map((tool) => [tool.id, tool]));
  const FILTER_COPY = {
    all: { title: "全部工具", subtitle: "所有处理都发生在你的浏览器里。" },
    dev: { title: "开发工具", subtitle: "让编码、调试和转换更顺手一点。" },
    design: { title: "设计工具", subtitle: "取色、压缩，给灵感留出更多时间。" },
    web: { title: "网址工具", subtitle: "解析、提取，并把真实网站整理到一起。" },
    text: { title: "文字工具", subtitle: "把一段文字看清楚，再把它变得更好。" },
    daily: { title: "日常工具", subtitle: "解决小问题，也照顾一点好心情。" },
    favorites: { title: "我的收藏", subtitle: "喜欢的小工具，都在这里。" },
  };

