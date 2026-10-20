/* ==========================================================================
   Unit converter
   ChengYu · Lumen Toolkit
   ========================================================================== */
"use strict";

  /* ----------------------------------------------------------------------
     Unit converter
     ---------------------------------------------------------------------- */
  function initUnitTool() {
    const tabs = $("#unitCategories");
    const fromInput = $("#unitFromValue");
    const toValue = $("#unitToValue");
    const fromSelect = $("#unitFromSelect");
    const toSelect = $("#unitToSelect");
    const formula = $("#unitFormula");
    const common = $("#unitCommon");
    const precision = $("#unitPrecision");
    if (!tabs || !fromInput || !fromSelect || !toSelect) return null;

    const length = [
      ["nm", "纳米", "nm", 1e-9],
      ["um", "微米", "µm", 1e-6],
      ["mm", "毫米", "mm", 0.001],
      ["cm", "厘米", "cm", 0.01],
      ["m", "米", "m", 1],
      ["km", "千米", "km", 1000],
      ["in", "英寸", "in", 0.0254],
      ["ft", "英尺", "ft", 0.3048],
      ["yd", "码", "yd", 0.9144],
      ["mi", "英里", "mi", 1609.344],
      ["nmi", "海里", "nmi", 1852],
      ["furlong", "弗隆", "fur", 201.168],
      ["fathom", "英寻", "ftm", 1.8288],
      ["rod", "杆", "rd", 5.0292],
      ["chain", "链", "ch", 20.1168],
      ["mil", "密耳", "mil", 0.0000254],
      ["li", "里", "里", 500],
      ["zhang", "丈", "丈", 10 / 3],
      ["chi", "尺", "尺", 1 / 3],
      ["cun", "寸", "寸", 1 / 30],
      ["au", "天文单位", "AU", 149597870700],
      ["ly", "光年", "ly", 9.4607304725808e15],
    ].map(([id, name, symbol, factor]) => ({ id, name, symbol, factor }));

    const mass = [
      ["ug", "微克", "µg", 0.000001],
      ["mg", "毫克", "mg", 0.001],
      ["g", "克", "g", 1],
      ["kg", "千克", "kg", 1000],
      ["t", "吨", "t", 1000000],
      ["oz", "盎司", "oz", 28.349523125],
      ["lb", "磅", "lb", 453.59237],
      ["st", "英石", "st", 6350.29318],
      ["ton", "短吨", "ton", 907184.74],
      ["lton", "长吨", "long ton", 1016046.9088],
      ["ct", "克拉", "ct", 0.2],
      ["gr", "格令", "gr", 0.06479891],
      ["liang", "两", "两", 50],
      ["jin", "斤", "斤", 500],
      ["qian", "钱", "钱", 5],
      ["dan", "担", "担", 50000],
    ].map(([id, name, symbol, factor]) => ({ id, name, symbol, factor }));

    const temperature = [
      {
        id: "c",
        name: "摄氏度",
        symbol: "°C",
        toBase: (value) => value,
        fromBase: (value) => value,
      },
      {
        id: "f",
        name: "华氏度",
        symbol: "°F",
        toBase: (value) => ((value - 32) * 5) / 9,
        fromBase: (value) => (value * 9) / 5 + 32,
      },
      {
        id: "k",
        name: "开尔文",
        symbol: "K",
        toBase: (value) => value - 273.15,
        fromBase: (value) => value + 273.15,
      },
      {
        id: "r",
        name: "兰氏度",
        symbol: "°R",
        toBase: (value) => ((value - 491.67) * 5) / 9,
        fromBase: (value) => (value * 9) / 5 + 491.67,
      },
      {
        id: "re",
        name: "列氏度",
        symbol: "°Ré",
        toBase: (value) => value * 1.25,
        fromBase: (value) => value * 0.8,
      },
    ];

    const data = [
      ["bit", "比特", "bit", 0.125],
      ["B", "字节", "B", 1],
      ["KB", "千字节", "KB", 1024],
      ["MB", "兆字节", "MB", 1024 ** 2],
      ["GB", "吉字节", "GB", 1024 ** 3],
      ["TB", "太字节", "TB", 1024 ** 4],
      ["PB", "拍字节", "PB", 1024 ** 5],
      ["KiB", "KiB（1024 B）", "KiB", 1024],
      ["MiB", "MiB（1024 KiB）", "MiB", 1024 ** 2],
      ["GiB", "GiB（1024 MiB）", "GiB", 1024 ** 3],
      ["TiB", "TiB（1024 GiB）", "TiB", 1024 ** 4],
      ["Kbit", "千比特", "Kbit", 125],
      ["Mbit", "兆比特", "Mbit", 125000],
      ["Gbit", "吉比特", "Gbit", 125000000],
    ].map(([id, name, symbol, factor]) => ({ id, name, symbol, factor }));

    const area = [
      ["mm2", "平方毫米", "mm²", 0.000001],
      ["cm2", "平方厘米", "cm²", 0.0001],
      ["m2", "平方米", "m²", 1],
      ["km2", "平方千米", "km²", 1000000],
      ["ha", "公顷", "ha", 10000],
      ["mu", "亩", "亩", 666.6666667],
      ["fen", "分", "分", 66.6666667],
      ["li", "厘", "厘", 6.6666667],
      ["in2", "平方英寸", "in²", 0.00064516],
      ["ft2", "平方英尺", "ft²", 0.09290304],
      ["yd2", "平方码", "yd²", 0.83612736],
      ["acre", "英亩", "acre", 4046.8564224],
      ["mi2", "平方英里", "mi²", 2589988.110336],
    ].map(([id, name, symbol, factor]) => ({ id, name, symbol, factor }));

    const volume = [
      ["ml", "毫升", "mL", 0.001],
      ["l", "升", "L", 1],
      ["cm3", "立方厘米", "cm³", 0.001],
      ["m3", "立方米", "m³", 1000],
      ["in3", "立方英寸", "in³", 0.016387064],
      ["ft3", "立方英尺", "ft³", 28.316846592],
      ["yd3", "立方码", "yd³", 764.554857984],
      ["tsp", "茶匙", "tsp", 0.00492892159375],
      ["tbsp", "汤匙", "tbsp", 0.01478676478125],
      ["cup", "杯", "cup", 0.2365882365],
      ["floz", "液量盎司", "fl oz", 0.0295735295625],
      ["pint", "品脱", "pt", 0.473176473],
      ["quart", "夸脱", "qt", 0.946352946],
      ["gal", "美制加仑", "gal", 3.785411784],
      ["galuk", "英制加仑", "gal UK", 4.54609],
      ["barrel", "桶（石油）", "bbl", 158.987294928],
    ].map(([id, name, symbol, factor]) => ({ id, name, symbol, factor }));

    const speed = [
      ["mps", "米每秒", "m/s", 1],
      ["kmh", "千米每小时", "km/h", 1 / 3.6],
      ["mph", "英里每小时", "mph", 0.44704],
      ["knot", "节", "kn", 0.5144444444],
      ["ftps", "英尺每秒", "ft/s", 0.3048],
      ["mach", "马赫（海平面）", "Mach", 340.29],
      ["c", "光速", "c", 299792458],
    ].map(([id, name, symbol, factor]) => ({ id, name, symbol, factor }));

    const time = [
      ["ns", "纳秒", "ns", 1e-9],
      ["us", "微秒", "µs", 1e-6],
      ["ms", "毫秒", "ms", 0.001],
      ["s", "秒", "s", 1],
      ["min", "分钟", "min", 60],
      ["h", "小时", "h", 3600],
      ["day", "天", "d", 86400],
      ["week", "周", "wk", 604800],
      ["fortnight", "双周", "fortnight", 1209600],
      ["month", "月（平均）", "mo", 2629746],
      ["year", "年（平均）", "yr", 31556952],
      ["decade", "十年", "decade", 315569520],
      ["century", "世纪", "century", 3155695200],
    ].map(([id, name, symbol, factor]) => ({ id, name, symbol, factor }));

    const pressure = [
      ["pa", "帕斯卡", "Pa", 1],
      ["hpa", "百帕", "hPa", 100],
      ["kpa", "千帕", "kPa", 1000],
      ["mpa", "兆帕", "MPa", 1e6],
      ["bar", "巴", "bar", 1e5],
      ["atm", "标准大气压", "atm", 101325],
      ["psi", "磅力每平方英寸", "psi", 6894.757293168],
      ["mmhg", "毫米汞柱", "mmHg", 133.322387415],
      ["inhg", "英寸汞柱", "inHg", 3386.389],
      ["kgfcm2", "千克力每平方厘米", "kgf/cm²", 98066.5],
    ].map(([id, name, symbol, factor]) => ({ id, name, symbol, factor }));

    const energy = [
      ["j", "焦耳", "J", 1],
      ["kj", "千焦", "kJ", 1000],
      ["mj", "兆焦", "MJ", 1e6],
      ["cal", "卡路里", "cal", 4.184],
      ["kcal", "千卡 / 大卡", "kcal", 4184],
      ["wh", "瓦时", "Wh", 3600],
      ["kwh", "千瓦时", "kWh", 3.6e6],
      ["ev", "电子伏特", "eV", 1.602176634e-19],
      ["btu", "英热单位", "BTU", 1055.05585262],
      ["ftlb", "英尺磅", "ft·lb", 1.3558179483314],
    ].map(([id, name, symbol, factor]) => ({ id, name, symbol, factor }));

    const power = [
      ["w", "瓦特", "W", 1],
      ["kw", "千瓦", "kW", 1000],
      ["mw", "兆瓦", "MW", 1e6],
      ["gw", "吉瓦", "GW", 1e9],
      ["hp", "英制马力", "hp", 745.6998715823],
      ["ps", "公制马力", "PS", 735.49875],
      ["btuh", "英热单位每小时", "BTU/h", 0.2930710701722],
      ["cals", "卡路里每秒", "cal/s", 4.184],
    ].map(([id, name, symbol, factor]) => ({ id, name, symbol, factor }));

    const angle = [
      ["rad", "弧度", "rad", 1],
      ["deg", "度", "°", Math.PI / 180],
      ["grad", "百分度", "grad", Math.PI / 200],
      ["arcmin", "角分", "′", Math.PI / 10800],
      ["arcsec", "角秒", "″", Math.PI / 648000],
      ["turn", "圈", "turn", Math.PI * 2],
    ].map(([id, name, symbol, factor]) => ({ id, name, symbol, factor }));

    const frequency = [
      ["hz", "赫兹", "Hz", 1],
      ["khz", "千赫兹", "kHz", 1000],
      ["mhz", "兆赫兹", "MHz", 1e6],
      ["ghz", "吉赫兹", "GHz", 1e9],
      ["rpm", "每分钟转数", "rpm", 1 / 60],
    ].map(([id, name, symbol, factor]) => ({ id, name, symbol, factor }));

    const dataRate = [
      ["bps", "比特每秒", "bps", 1],
      ["kbps", "千比特每秒", "Kbps", 1000],
      ["mbps", "兆比特每秒", "Mbps", 1e6],
      ["gbps", "吉比特每秒", "Gbps", 1e9],
      ["kibs", "KiB 每秒", "KiB/s", 8192],
      ["mibs", "MiB 每秒", "MiB/s", 8388608],
      ["gibs", "GiB 每秒", "GiB/s", 8589934592],
    ].map(([id, name, symbol, factor]) => ({ id, name, symbol, factor }));

    const torque = [
      ["nm", "牛顿米", "N·m", 1],
      ["kgfm", "千克力米", "kgf·m", 9.80665],
      ["lbfft", "磅力英尺", "lbf·ft", 1.3558179483314],
      ["lbfin", "磅力英寸", "lbf·in", 0.1129848290276],
    ].map(([id, name, symbol, factor]) => ({ id, name, symbol, factor }));

    const fuel = [
      { id: "kml", name: "千米每升", symbol: "km/L", factor: 1 },
      {
        id: "l100",
        name: "升每百千米",
        symbol: "L/100km",
        toBase: (value) => (value === 0 ? Infinity : 100 / value),
        fromBase: (value) => (value === 0 ? Infinity : 100 / value),
      },
      {
        id: "mpgus",
        name: "英里每加仑（美）",
        symbol: "mpg US",
        toBase: (value) => value * 0.4251437074976,
        fromBase: (value) => value / 0.4251437074976,
      },
      {
        id: "mpguk",
        name: "英里每加仑（英）",
        symbol: "mpg UK",
        toBase: (value) => value * 0.3540061899,
        fromBase: (value) => value / 0.3540061899,
      },
    ];

    /*
      16 类单位都用同一张表描述：
      - 普通单位：{ id, name, symbol, factor }，factor 是相对基准单位的倍率；
      - 温度 / 油耗：{ toBase, fromBase }，用函数处理仿射或倒数关系。
      categories 只负责分组和默认单位，换算算法在 convertValue() 中统一。
    */
    const categories = {
      length: { label: "长度", units: length, defaults: ["m", "ft"] },
      mass: { label: "重量", units: mass, defaults: ["kg", "lb"] },
      temperature: { label: "温度", units: temperature, defaults: ["c", "f"] },
      data: { label: "数据", units: data, defaults: ["MB", "GB"] },
      area: { label: "面积", units: area, defaults: ["m2", "mu"] },
      volume: { label: "体积", units: volume, defaults: ["l", "ml"] },
      speed: { label: "速度", units: speed, defaults: ["kmh", "mph"] },
      time: { label: "时间", units: time, defaults: ["h", "min"] },
      pressure: { label: "压强", units: pressure, defaults: ["kpa", "bar"] },
      energy: { label: "能量", units: energy, defaults: ["kcal", "kj"] },
      power: { label: "功率", units: power, defaults: ["kw", "hp"] },
      angle: { label: "角度", units: angle, defaults: ["deg", "rad"] },
      frequency: { label: "频率", units: frequency, defaults: ["mhz", "ghz"] },
      datarate: { label: "数据速率", units: dataRate, defaults: ["mbps", "mibs"] },
      torque: { label: "扭矩", units: torque, defaults: ["nm", "lbfft"] },
      fuel: { label: "油耗", units: fuel, defaults: ["l100", "mpgus"] },
    };

    let activeCategory = "length";

    function unitById(category, id) {
      return categories[category].units.find((unit) => unit.id === id);
    }

    /*
      所有换算都先转到“基准单位”，再从基准转到目标单位。
      这样新增普通单位只需要写 factor，不需要给每对单位写换算公式。
    */
    function convertValue(value, category, fromUnit, toUnit) {
      const base = fromUnit.toBase ? fromUnit.toBase(value) : value * fromUnit.factor;
      return toUnit.fromBase ? toUnit.fromBase(base) : base / toUnit.factor;
    }

    /*
      结果格式化分三种情况：
      - 非有限值 → 破折号；
      - 极大 / 极小 → 科学计数法；
      - 普通范围 → 按用户选择的小数位和中文千分位显示。
    */
    function formatValue(value) {
      if (!Number.isFinite(value)) return "—";
      const normalized = Number(value.toPrecision(10));
      const absolute = Math.abs(normalized);
      if (absolute > 0 && (absolute >= 1e12 || absolute < 1e-7)) {
        return normalized.toExponential(5).replace(/\.?0+e/, "e");
      }
      return new Intl.NumberFormat("zh-CN", {
        maximumFractionDigits: precision?.value === "auto" || !precision ? 8 : Number(precision.value),
        useGrouping: true,
      }).format(normalized);
    }

    function renderTabs() {
      tabs.innerHTML = Object.entries(categories)
        .map(
          ([id, category]) =>
            `<button class="category-tab${id === activeCategory ? " is-active" : ""}" type="button" role="tab" aria-selected="${id === activeCategory}" data-unit-category="${id}">${category.label}</button>`
        )
        .join("");
    }

    function fillSelect(select, units, selectedId) {
      select.innerHTML = units
        .map(
          (unit) =>
            `<option value="${unit.id}"${unit.id === selectedId ? " selected" : ""}>${unit.symbol} · ${unit.name}</option>`
        )
        .join("");
    }

    function currentUnits() {
      return {
        from: unitById(activeCategory, fromSelect.value),
        to: unitById(activeCategory, toSelect.value),
      };
    }

    /*
      updateResult 是换算器的中心入口：
      读取当前 from/to 单位 → 校验输入 → 换算 → 写结果 / 公式 / 4 个参考卡。
      空值或非法值只显示提示，不抛异常，输入框可以继续编辑。
    */
    function updateResult() {
      const units = currentUnits();
      if (!units.from || !units.to) return;
      const raw = fromInput.value;
      if (raw.trim() === "") {
        toValue.value = "—";
        if (formula) formula.textContent = "输入一个数值，就能看到换算结果。";
        if (common) common.innerHTML = "";
        return;
      }
      const value = Number(raw);
      if (!Number.isFinite(value)) {
        toValue.value = "—";
        if (formula) formula.textContent = "请输入有效的数值。";
        if (common) common.innerHTML = "";
        return;
      }
      const result = convertValue(value, activeCategory, units.from, units.to);
      toValue.value = formatValue(result);
      if (formula) {
        const single = convertValue(1, activeCategory, units.from, units.to);
        formula.textContent = `1 ${units.from.symbol} = ${formatValue(single)} ${units.to.symbol}`;
      }
      if (common) {
        const references = categories[activeCategory].units
          .filter((unit) => unit.id !== units.from.id && unit.id !== units.to.id)
          .slice(0, 4);
        common.innerHTML = references
          .map((unit) => {
            const converted = convertValue(1, activeCategory, units.from, unit);
            return `<button class="unit-reference" type="button" data-unit-target="${unit.id}" aria-label="改为换算成 ${unit.name}"><span class="unit-reference-value">${formatValue(converted)}</span><span class="unit-reference-unit">${unit.symbol} · ${unit.name}</span></button>`;
          })
          .join("");
      }
    }

    function selectCategory(categoryId) {
      if (!categories[categoryId]) return;
      activeCategory = categoryId;
      const category = categories[activeCategory];
      const [defaultFrom, defaultTo] = category.defaults;
      fillSelect(fromSelect, category.units, defaultFrom);
      fillSelect(toSelect, category.units, defaultTo);
      renderTabs();
      fromInput.value = "1";
      updateResult();
    }

    tabs.addEventListener("click", (event) => {
      const button = event.target.closest("[data-unit-category]");
      if (!button) return;
      selectCategory(button.dataset.unitCategory);
    });

    fromInput.addEventListener("input", updateResult);
    fromSelect.addEventListener("change", updateResult);
    toSelect.addEventListener("change", updateResult);
    common.addEventListener("click", (event) => {
      const button = event.target.closest("[data-unit-target]");
      if (!button) return;
      toSelect.value = button.dataset.unitTarget;
      updateResult();
    });

    $("#unitSwap")?.addEventListener("click", () => {
      const previousFrom = fromSelect.value;
      const previousTo = toSelect.value;
      const previousResult = toValue.value.replace(/,/g, "").replace(/[^\d.eE+\-]/g, "");
      const shouldCarry = previousResult && previousResult !== "—";
      fromSelect.value = previousTo;
      toSelect.value = previousFrom;
      if (shouldCarry) {
        const numeric = Number(previousResult);
        fromInput.value = Number.isFinite(numeric)
          ? String(Number(numeric.toPrecision(10)))
          : "1";
      }
      updateResult();
    });

    precision?.addEventListener("change", updateResult);

    $("#unitCopy")?.addEventListener("click", () => {
      const value = toValue.value;
      if (!value || value === "—") {
        toast("还没有可复制的结果", { type: "info" });
        return;
      }
      copyText(value);
    });

    selectCategory(activeCategory);
    return null;
  }

