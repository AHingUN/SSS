/* ==========================================================================
   Unit converter enhancements + advanced scientific calculator
   ChengYu · Lumen Toolkit
   ========================================================================== */
"use strict";

  /*
    单位工具的第二次初始化：unit.js 负责换算数据，这里负责：
    - 换算 / 计算器模式切换；
    - 桌面分类胶囊与手机原生下拉的同步；
    - 科学计算器的表达式解析、实时结果、记忆和历史。

    计算器和换算器共享同一张页面，但没有共享业务数据：
    换算值不会自动写进计算器，计算器结果也不会反向修改单位。
  */
  function initUnitAdvanced() {
    const panel = $(".unit-panel");
    if (!panel) return null;

    /* --------------------------------------------------------------------
       Unit converter extras
       -------------------------------------------------------------------- */

    const tabs = $("#unitCategories");
    const categorySelect = $("#unitCategorySelect");
    const copyInline = $("#unitCopyInline");
    const toValue = $("#unitToValue");
    const modeSwitch = $("#unitModeSwitch");
    const convertView = $("#unitConvertView");
    const calcView = $("#unitCalcView");
    const modeNote = $("#unitModeNote");

    function copyUnitValue() {
      const value = toValue?.value;
      if (!value || value === "—") {
        toast("还没有可复制的结果", { type: "info" });
        return;
      }
      copyText(value, "换算结果已复制");
    }

    copyInline?.addEventListener("click", copyUnitValue);

    function syncCategorySelect() {
      if (!tabs || !categorySelect) return;
      const buttons = $$("[data-unit-category]", tabs);
      if (!buttons.length) return;
      const active = buttons.find((button) => button.classList.contains("is-active"));
      const selected = active?.dataset.unitCategory || categorySelect.value;
      categorySelect.innerHTML = buttons
        .map((button) => `<option value="${button.dataset.unitCategory}">${button.textContent.trim()}</option>`)
        .join("");
      if (selected) categorySelect.value = selected;
    }

    tabs?.addEventListener("click", () => {
      window.setTimeout(syncCategorySelect, 0);
    });

    categorySelect?.addEventListener("change", () => {
      const target = $$("[data-unit-category]", tabs).find(
        (button) => button.dataset.unitCategory === categorySelect.value
      );
      if (target) target.click();
      window.setTimeout(syncCategorySelect, 0);
    });

    syncCategorySelect();

    function setMode(mode, { persist = true } = {}) {
      const calc = mode === "calc";
      if (modeSwitch) {
        $$("[data-unit-mode]", modeSwitch).forEach((button) => {
          const active = button.dataset.unitMode === mode;
          button.classList.toggle("is-active", active);
          button.setAttribute("aria-selected", active ? "true" : "false");
        });
      }
      if (convertView) convertView.hidden = calc;
      if (calcView) calcView.hidden = !calc;
      if (modeNote) {
        modeNote.textContent = calc ? "科学函数 · 历史 · 记忆" : "16 类单位 · 本地即时换算";
      }
      if (calc) updateCalcLive();
      if (persist) {
        try {
          localStorage.setItem("lumen.unitMode", mode);
        } catch (error) {
          /* Storage can be unavailable under strict file:// policies. */
        }
      }
    }

    modeSwitch?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-unit-mode]");
      if (!button) return;
      setMode(button.dataset.unitMode);
    });

    let initialMode = "convert";
    try {
      initialMode = localStorage.getItem("lumen.unitMode") === "calc" ? "calc" : "convert";
    } catch (error) {
      initialMode = "convert";
    }

    /* --------------------------------------------------------------------
       Advanced calculator
       -------------------------------------------------------------------- */

    const input = $("#calcInput");
    const result = $("#calcResult");
    const preview = $("#calcPreview");
    const angleToggle = $("#calcAngleToggle");
    const angleLabel = $("#calcAngleLabel");
    const memoryBadge = $("#calcMemoryBadge");
    const historyList = $("#calcHistoryList");
    const historyClear = $("#calcHistoryClear");
    const copyResult = $("#calcCopyResult");
    if (!input || !result) return null;

    function readStorage(key, fallback) {
      try {
        const value = localStorage.getItem(key);
        return value == null ? fallback : value;
      } catch (error) {
        return fallback;
      }
    }

    function writeStorage(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch (error) {
        /* Storage can be unavailable under strict file:// policies. */
      }
    }

    const savedAngle = readStorage("lumen.calcAngle", "deg");
    const savedHistory = readStorage("lumen.calcHistory", "[]");
    const savedMemory = Number(readStorage("lumen.calcMemory", "0"));

    /*
      计算器运行时状态：
      - angle: DEG / RAD，影响三角函数和反三角函数；
      - memory: MC/MR/M+/M-/MS 使用的记忆值；
      - ans: 上一次按等号的结果，供 Ans / ans 使用；
      - history: 最多 20 条 { expression, result }，持久化到 localStorage。
    */
    const state = {
      angle: savedAngle === "rad" ? "rad" : "deg",
      memory: Number.isFinite(savedMemory) ? savedMemory : 0,
      ans: 0,
      history: [],
    };

    try {
      const parsed = JSON.parse(savedHistory);
      state.history = Array.isArray(parsed)
        ? parsed
            .filter((item) => item && typeof item.expression === "string")
            .slice(0, 20)
        : [];
    } catch (error) {
      state.history = [];
    }

    function saveCalculatorState() {
      writeStorage("lumen.calcAngle", state.angle);
      writeStorage("lumen.calcMemory", String(state.memory));
    }

    function saveHistory() {
      writeStorage("lumen.calcHistory", JSON.stringify(state.history.slice(0, 20)));
    }

    function formatCalcNumber(value) {
      if (!Number.isFinite(value)) return "—";
      if (Object.is(value, -0) || Math.abs(value) < 1e-14) return "0";
      const absolute = Math.abs(value);
      if (absolute >= 1e15 || absolute < 1e-9) {
        return value
          .toExponential(8)
          .replace(/\.?0+e/, "e")
          .replace("e+", "e");
      }
      const rounded = Number(value.toPrecision(12));
      return new Intl.NumberFormat("zh-CN", {
        maximumFractionDigits: 12,
        useGrouping: true,
      }).format(rounded);
    }

    function normalizeExpression(value) {
      return String(value)
        .replace(/×/g, "*")
        .replace(/÷/g, "/")
        .replace(/[−–]/g, "-")
        .replace(/[πΠ]/g, "pi")
        .replace(/（/g, "(")
        .replace(/）/g, ")")
        .replace(/，/g, ",")
        .trim();
    }

    function tokenize(source) {
      const tokens = [];
      let index = 0;
      const numberPattern = /^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i;
      while (index < source.length) {
        const char = source[index];
        if (/\s/.test(char)) {
          index += 1;
          continue;
        }
        if (/[0-9.]/.test(char)) {
          const match = source.slice(index).match(numberPattern);
          if (!match) throw new Error("数字格式不正确");
          tokens.push({ type: "number", value: Number(match[0]) });
          index += match[0].length;
          continue;
        }
        if (/[a-zA-Z]/.test(char)) {
          let end = index;
          while (end < source.length && /[a-zA-Z]/.test(source[end])) end += 1;
          tokens.push({ type: "ident", value: source.slice(index, end).toLocaleLowerCase() });
          index = end;
          continue;
        }
        if ("+-*/^()!%".includes(char)) {
          tokens.push({ type: "op", value: char });
          index += 1;
          continue;
        }
        throw new Error(`无法识别“${char}”`);
      }
      return tokens;
    }

    function factorial(value) {
      if (!Number.isInteger(value) || value < 0 || value > 170) {
        throw new Error("阶乘仅支持 0–170 的整数");
      }
      let output = 1;
      for (let index = 2; index <= value; index += 1) output *= index;
      return output;
    }

    function applyFunction(name, argument) {
      const degrees = state.angle === "deg";
      const toRadians = (value) => (degrees ? (value * Math.PI) / 180 : value);
      const fromRadians = (value) => (degrees ? (value * 180) / Math.PI : value);
      switch (name) {
        case "sin": return Math.sin(toRadians(argument));
        case "cos": return Math.cos(toRadians(argument));
        case "tan": return Math.tan(toRadians(argument));
        case "asin": return fromRadians(Math.asin(argument));
        case "acos": return fromRadians(Math.acos(argument));
        case "atan": return fromRadians(Math.atan(argument));
        case "ln":
          if (argument <= 0) throw new Error("ln 只接受正数");
          return Math.log(argument);
        case "log":
          if (argument <= 0) throw new Error("log 只接受正数");
          return Math.log10(argument);
        case "log2":
          if (argument <= 0) throw new Error("log2 只接受正数");
          return Math.log2(argument);
        case "sqrt":
          if (argument < 0) throw new Error("负数不能开平方");
          return Math.sqrt(argument);
        case "cbrt": return Math.cbrt(argument);
        case "abs": return Math.abs(argument);
        case "round": return Math.round(argument);
        case "floor": return Math.floor(argument);
        case "ceil": return Math.ceil(argument);
        case "exp": return Math.exp(argument);
        default: throw new Error(`未知函数“${name}”`);
      }
    }

    /*
      递归下降表达式解析器（不使用 eval）
      -----------------------------------
      语法优先级从低到高：
        expression := term (('+' | '-') term)*
        term       := unary (('*' | '/' | 隐式乘法) unary)*
        unary      := ('+' | '-') unary | power
        power      := postfix ('^' unary)?
        postfix    := primary ('!' | '%')*
        primary    := number | ident | '(' expression ')'

      额外规则：
      - 括号省略乘号：2(3+4)、2sin(30)；
      - '%' 既可作为百分号，也在加减时按左值计算百分比；
      - '!' 只接受 0–170 的整数；
      - 出错时返回 { ok:false, error }，不把异常抛给页面。
    */
    function evaluate(raw) {
      const source = normalizeExpression(raw);
      if (!source) return { ok: false, empty: true, error: "" };

      let tokens;
      try {
        tokens = tokenize(source);
      } catch (error) {
        return { ok: false, error: error.message };
      }
      if (!tokens.length) return { ok: false, empty: true, error: "" };

      let position = 0;
      const peek = () => tokens[position] || { type: "eof", value: "" };
      const consume = () => tokens[position++];
      const isOperator = (value) => {
        const token = peek();
        return token.type === "op" && token.value === value;
      };
      const startsPrimary = (token) =>
        token.type === "number" || token.type === "ident" || (token.type === "op" && token.value === "(");

      function parseExpression() {
        let left = parseTerm();
        while (isOperator("+") || isOperator("-")) {
          const operator = consume().value;
          const right = parseTerm();
          let value = right.value;
          // 200 + 10% 按“200 的 10%”计算，而不是 200 + 0.1。
          if (right.percent) value = left.value * value;
          left = {
            value: operator === "+" ? left.value + value : left.value - value,
            percent: false,
          };
        }
        return left;
      }

      function parseTerm() {
        let value = parseUnary();
        let percent = value.percent;
        while (true) {
          if (isOperator("*") || isOperator("/")) {
            const operator = consume().value;
            const right = parseUnary();
            value = {
              value: operator === "*" ? value.value * right.value : value.value / right.value,
              percent: false,
            };
            percent = false;
            continue;
          }
          if (startsPrimary(peek())) {
            // 隐式乘法：2pi、2(3+4)、2sin(30)。
            const right = parseUnary();
            value = { value: value.value * right.value, percent: false };
            percent = false;
            continue;
          }
          break;
        }
        return { value: value.value, percent };
      }

      function parseUnary() {
        if (isOperator("+")) {
          consume();
          const value = parseUnary();
          return { value: value.value, percent: value.percent };
        }
        if (isOperator("-")) {
          consume();
          const value = parseUnary();
          return { value: -value.value, percent: value.percent };
        }
        return parsePower();
      }

      function parsePower() {
        const base = parsePostfix();
        if (isOperator("^")) {
          consume();
          const exponent = parseUnary();
          return { value: Math.pow(base.value, exponent.value), percent: false };
        }
        return base;
      }

      function parsePostfix() {
        let value = parsePrimary();
        while (isOperator("!") || isOperator("%")) {
          const operator = consume().value;
          if (operator === "!") {
            value = { value: factorial(value.value), percent: false };
          } else {
            value = { value: value.value / 100, percent: true };
          }
        }
        return value;
      }

      function parsePrimary() {
        const token = consume();
        if (token.type === "number") {
          return { value: token.value, percent: false };
        }
        if (token.type === "ident") {
          const name = token.value;
          if (isOperator("(")) {
            consume();
            const argument = parseExpression();
            if (!isOperator(")")) throw new Error("括号没有闭合");
            consume();
            return { value: applyFunction(name, argument.value), percent: false };
          }
          if (name === "pi") return { value: Math.PI, percent: false };
          if (name === "e") return { value: Math.E, percent: false };
          if (name === "ans") return { value: state.ans, percent: false };
          if (name === "mem" || name === "memory") return { value: state.memory, percent: false };
          throw new Error(`未知函数或常量“${name}”`);
        }
        if (token.type === "op" && token.value === "(") {
          const value = parseExpression();
          if (!isOperator(")")) throw new Error("括号没有闭合");
          consume();
          return { value: value.value, percent: value.percent };
        }
        throw new Error("表达式不完整");
      }

      try {
        const value = parseExpression();
        if (position < tokens.length) throw new Error("表达式末尾有多余内容");
        if (!Number.isFinite(value.value)) throw new Error("结果超出可计算范围");
        return { ok: true, value: value.value };
      } catch (error) {
        return { ok: false, error: error.message || "表达式有误" };
      }
    }

    let liveEvaluation = { ok: false, empty: true, error: "" };

    function updateCalcLive({ equals = false } = {}) {
      const raw = input.value;
      liveEvaluation = evaluate(raw);
      result.classList.toggle("is-error", !liveEvaluation.ok && !liveEvaluation.empty);
      if (liveEvaluation.empty) {
        result.textContent = "0";
        preview.textContent = "输入表达式开始计算";
        return;
      }
      if (!liveEvaluation.ok) {
        result.textContent = "—";
        preview.textContent = liveEvaluation.error || "表达式有误";
        return;
      }
      const formatted = formatCalcNumber(liveEvaluation.value);
      result.textContent = formatted;
      preview.textContent = equals ? `= ${formatted}` : "Enter 计算并记录历史";
    }

    function insertCalculatorText(text) {
      const length = input.value.length;
      const start = document.activeElement === input ? input.selectionStart ?? length : length;
      const end = document.activeElement === input ? input.selectionEnd ?? start : length;
      input.value = input.value.slice(0, start) + text + input.value.slice(end);
      const caret = start + text.length;
      input.focus({ preventScroll: true });
      input.setSelectionRange(caret, caret);
      updateCalcLive();
    }

    function backspaceCalculator() {
      const length = input.value.length;
      const start = document.activeElement === input ? input.selectionStart ?? length : length;
      const end = document.activeElement === input ? input.selectionEnd ?? start : length;
      if (start !== end) {
        input.value = input.value.slice(0, start) + input.value.slice(end);
      } else if (start > 0) {
        input.value = input.value.slice(0, start - 1) + input.value.slice(start);
      }
      const caret = Math.max(0, start - (start === end ? 1 : 0));
      input.focus({ preventScroll: true });
      input.setSelectionRange(caret, caret);
      updateCalcLive();
    }

    function negateCalculator() {
      const value = input.value;
      const match = value.match(/(\d+(?:\.\d+)?)(?!.*\d)/);
      if (!match || match.index == null) {
        if (!value) {
          insertCalculatorText("-");
        } else {
          input.value = `-(${value})`;
          input.focus({ preventScroll: true });
          input.setSelectionRange(input.value.length, input.value.length);
          updateCalcLive();
        }
        return;
      }
      const start = match.index;
      const end = start + match[0].length;
      const before = value.slice(0, start);
      if (before.endsWith("-") && (start < 2 || !/[\d)]/.test(value[start - 2]))) {
        input.value = value.slice(0, start - 1) + value.slice(start);
      } else {
        input.value = value.slice(0, start) + `(-${match[1]})` + value.slice(end);
      }
      input.focus({ preventScroll: true });
      input.setSelectionRange(input.value.length, input.value.length);
      updateCalcLive();
    }

    function currentResultValue() {
      return liveEvaluation.ok ? liveEvaluation.value : null;
    }

    function renderMemory() {
      if (memoryBadge) {
        memoryBadge.hidden = state.memory === 0;
        memoryBadge.title = `记忆值：${formatCalcNumber(state.memory)}`;
      }
    }

    function renderAngle() {
      const label = state.angle === "deg" ? "DEG" : "RAD";
      if (angleToggle) angleToggle.textContent = label;
      if (angleLabel) angleLabel.textContent = state.angle === "deg" ? "角度 DEG" : "弧度 RAD";
    }

    function renderHistory() {
      if (!historyList) return;
      if (!state.history.length) {
        historyList.innerHTML = '<p class="calc-history-empty">还没有计算记录</p>';
        return;
      }
      historyList.innerHTML = state.history
        .map(
          (item, index) =>
            `<button class="calc-history-item" type="button" data-calc-history="${index}" title="载入这条表达式"><span class="calc-history-expression">${escapeHTML(item.expression)}</span><span class="calc-history-result">= ${escapeHTML(item.result)}</span></button>`
        )
        .join("");
    }

    function addHistory(expression, value) {
      const item = {
        expression: expression.trim(),
        result: formatCalcNumber(value),
        at: Date.now(),
      };
      const previous = state.history[0];
      if (previous && previous.expression === item.expression && previous.result === item.result) return;
      state.history = [item, ...state.history].slice(0, 20);
      saveHistory();
      renderHistory();
    }

    function commitEquals() {
      updateCalcLive();
      if (!liveEvaluation.ok) {
        if (!liveEvaluation.empty) toast(liveEvaluation.error || "表达式有误", { type: "info" });
        return;
      }
      const value = liveEvaluation.value;
      state.ans = value;
      addHistory(input.value, value);
      const formatted = formatCalcNumber(value);
      result.textContent = formatted;
      preview.textContent = `= ${formatted}`;
    }

    function memoryAction(action) {
      const value = currentResultValue();
      if (action === "clear") {
        state.memory = 0;
      } else if (action === "recall") {
        insertCalculatorText(String(Number(state.memory.toPrecision(12))));
        return;
      } else if (action === "add" || action === "subtract" || action === "store") {
        if (value == null) {
          toast("请先输入一个有效表达式", { type: "info" });
          return;
        }
        if (action === "add") state.memory += value;
        else if (action === "subtract") state.memory -= value;
        else state.memory = value;
      }
      saveCalculatorState();
      renderMemory();
    }

    function applyAngleMode() {
      state.angle = state.angle === "deg" ? "rad" : "deg";
      renderAngle();
      saveCalculatorState();
      updateCalcLive();
    }

    input.addEventListener("input", () => updateCalcLive());
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commitEquals();
      } else if (event.key === "Escape") {
        event.preventDefault();
        input.value = "";
        updateCalcLive();
      }
    });

    angleToggle?.addEventListener("click", applyAngleMode);

    calcView?.addEventListener("click", (event) => {
      const insertButton = event.target.closest("[data-calc-insert]");
      if (insertButton) {
        insertCalculatorText(insertButton.dataset.calcInsert);
        return;
      }
      const actionButton = event.target.closest("[data-calc-action]");
      if (actionButton) {
        const action = actionButton.dataset.calcAction;
        if (action === "clear") {
          input.value = "";
          updateCalcLive();
          input.focus({ preventScroll: true });
        } else if (action === "backspace") {
          backspaceCalculator();
        } else if (action === "negate") {
          negateCalculator();
        } else if (action === "equals") {
          commitEquals();
        }
        return;
      }
      const memoryButton = event.target.closest("[data-calc-memory]");
      if (memoryButton) {
        memoryAction(memoryButton.dataset.calcMemory);
        return;
      }
      const historyButton = event.target.closest("[data-calc-history]");
      if (historyButton && historyList) {
        const item = state.history[Number(historyButton.dataset.calcHistory)];
        if (item) {
          input.value = item.expression;
          updateCalcLive();
          input.focus({ preventScroll: true });
        }
      }
    });

    historyClear?.addEventListener("click", () => {
      if (!state.history.length) return;
      state.history = [];
      saveHistory();
      renderHistory();
      toast("计算历史已清空");
    });

    copyResult?.addEventListener("click", () => {
      if (!liveEvaluation.ok) {
        toast("还没有可复制的结果", { type: "info" });
        return;
      }
      copyText(formatCalcNumber(liveEvaluation.value).replace(/,/g, ""), "计算结果已复制");
    });

    renderAngle();
    renderMemory();
    renderHistory();
    updateCalcLive();
    setMode(initialMode, { persist: false });

    return null;
  }
