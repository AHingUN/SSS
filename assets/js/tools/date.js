/* ==========================================================================
   Date calculator
   ChengYu · Lumen Toolkit
   ========================================================================== */
"use strict";

  /* ----------------------------------------------------------------------
     Date calculator
     ---------------------------------------------------------------------- */
  function initDateTool() {
    const startInput = $("#dateStart");
    const endInput = $("#dateEnd");
    const totalDays = $("#dateTotalDays");
    const breakdown = $("#dateBreakdown");
    const weekdays = $("#dateWeekdays");
    const businessToggle = $("#dateBusiness");
    const baseInput = $("#dateBase");
    const directionGroup = $("#dateDirection");
    const amountInput = $("#dateAmount");
    const unitSelect = $("#dateUnit");
    const computed = $("#dateComputed");
    const computedWeekday = $("#dateComputedWeekday");
    const copyButton = $("#dateCopy");
    if (!startInput || !endInput || !baseInput) return null;

    let direction = "add";
    const DAY_MS = 86400000;

    function pad(value) {
      return String(value).padStart(2, "0");
    }

    function inputDate(value) {
      if (!value) return null;
      const parts = value.split("-").map(Number);
      if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return null;
      const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
      return Number.isNaN(date.getTime()) ? null : date;
    }

    function dateInputValue(date) {
      return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
    }

    function todayUtc() {
      const now = new Date();
      return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    }

    function formatDate(date) {
      return `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月${date.getUTCDate()}日`;
    }

    function weekday(date) {
      return WEEKDAYS[date.getUTCDay()];
    }

    function addDays(date, amount) {
      return new Date(date.getTime() + amount * DAY_MS);
    }

    function addMonths(date, amount) {
      const targetMonthStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1));
      const lastDay = new Date(
        Date.UTC(targetMonthStart.getUTCFullYear(), targetMonthStart.getUTCMonth() + 1, 0)
      ).getUTCDate();
      targetMonthStart.setUTCDate(Math.min(date.getUTCDate(), lastDay));
      return targetMonthStart;
    }

    function addPeriod(date, amount, unit) {
      const signed = direction === "sub" ? -amount : amount;
      if (unit === "day") return addDays(date, signed);
      if (unit === "week") return addDays(date, signed * 7);
      if (unit === "month") return addMonths(date, signed);
      return addMonths(date, signed * 12);
    }

    function calendarGap(start, end) {
      let months =
        (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
        (end.getUTCMonth() - start.getUTCMonth());
      let anchor = addMonths(start, months);
      if (anchor > end) {
        months -= 1;
        anchor = addMonths(start, months);
      }
      const days = Math.round((end.getTime() - anchor.getTime()) / DAY_MS);
      return {
        years: Math.floor(Math.max(months, 0) / 12),
        months: Math.max(months, 0) % 12,
        days,
      };
    }

    function pulse(node) {
      if (!node || reducedMotion) return;
      node.getAnimations().forEach((animation) => {
        if (animation.id === "date-pulse") animation.cancel();
      });
      node.animate(
        [
          { opacity: 0.55, transform: "translateY(2px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
        { id: "date-pulse", duration: 190, easing: "ease-out" }
      );
    }

    function updateInterval() {
      const start = inputDate(startInput.value);
      const end = inputDate(endInput.value);
      if (!start || !end) {
        totalDays.textContent = "—";
        breakdown.textContent = "选择两个日期，查看相隔时间。";
        weekdays.textContent = "";
        return;
      }
      const reversed = end < start;
      const earlier = reversed ? end : start;
      const later = reversed ? start : end;
      const days = Math.round((later.getTime() - earlier.getTime()) / DAY_MS);
      const gap = calendarGap(earlier, later);
      totalDays.textContent = new Intl.NumberFormat("zh-CN").format(days);
      const pieces = [];
      if (gap.years) pieces.push(`${gap.years} 年`);
      if (gap.months) pieces.push(`${gap.months} 个月`);
      if (gap.days) pieces.push(`${gap.days} 天`);
      breakdown.textContent = pieces.length ? pieces.join(" ") : "同一天";
      let businessDays = 0;
      let cursor = addDays(earlier, 1);
      while (cursor.getTime() <= later.getTime()) {
        const day = cursor.getUTCDay();
        if (day !== 0 && day !== 6) businessDays += 1;
        cursor = addDays(cursor, 1);
      }
      weekdays.textContent = `${reversed ? "结束早于开始 · " : ""}${weekday(earlier)} → ${weekday(later)}${businessToggle?.checked ? ` · 工作日 ${businessDays} 天` : ""}`;
      pulse(totalDays);
    }

    function updateComputed() {
      const base = inputDate(baseInput.value);
      const amount = Math.max(0, Number(amountInput.value) || 0);
      if (!base) {
        computed.textContent = "—";
        computedWeekday.textContent = "";
        return;
      }
      const result = addPeriod(base, amount, unitSelect.value);
      computed.textContent = formatDate(result);
      computedWeekday.textContent = `${weekday(result)} · ${direction === "sub" ? "向前" : "向后"} ${amount} ${unitSelect.options[unitSelect.selectedIndex].text}`;
      pulse(computed);
    }

    function setDirection(next) {
      direction = next;
      $$("button", directionGroup).forEach((button) => {
        const active = button.dataset.dateDirection === direction;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", active ? "true" : "false");
      });
      updateComputed();
    }

    const today = todayUtc();
    startInput.value = dateInputValue(today);
    endInput.value = dateInputValue(addDays(today, 90));
    baseInput.value = dateInputValue(today);
    updateInterval();
    updateComputed();

    startInput.addEventListener("input", updateInterval);
    endInput.addEventListener("input", updateInterval);
    businessToggle?.addEventListener("change", updateInterval);
    baseInput.addEventListener("input", updateComputed);
    amountInput.addEventListener("input", updateComputed);
    unitSelect.addEventListener("change", updateComputed);
    directionGroup.addEventListener("click", (event) => {
      const button = event.target.closest("[data-date-direction]");
      if (!button) return;
      setDirection(button.dataset.dateDirection);
    });
    $$("[data-date-quick]", $(".date-quick")).forEach((button) => {
      button.addEventListener("click", () => {
        direction = "add";
        amountInput.value = button.dataset.dateQuick;
        unitSelect.value = "day";
        $$("button", directionGroup).forEach((item) => {
          const active = item.dataset.dateDirection === "add";
          item.classList.toggle("is-active", active);
          item.setAttribute("aria-pressed", active ? "true" : "false");
        });
        syncSegmentedThumb(directionGroup);
        updateComputed();
      });
    });

    copyButton?.addEventListener("click", () => {
      const parts = [];
      if (totalDays.textContent !== "—") {
        parts.push(`日期间隔：${startInput.value || "—"} → ${endInput.value || "—"}`);
        parts.push(`${totalDays.textContent} 天 · ${breakdown.textContent} · ${weekdays.textContent}`);
      }
      if (computed.textContent !== "—") {
        parts.push(`日期推算：${computed.textContent} ${computedWeekday.textContent}`);
      }
      if (!parts.length) {
        toast("还没有可复制的日期结果", { type: "info" });
        return;
      }
      copyText(parts.join("\n"), "日期结果已复制");
    });

    return null;
  }

