/* ==========================================================================
   Cron expression parser
   ChengYu · Lumen Toolkit
   ========================================================================== */
"use strict";

  /* ----------------------------------------------------------------------
     Cron parser (inspired by cRonstrue)
     ---------------------------------------------------------------------- */
  function initCronTool() {
    const input = $("#cronInput");
    const runButton = $("#cronRun");
    if (!input || !runButton) return;
    const description = $("#cronDescription");
    const fieldsNode = $("#cronFields");
    const nextNode = $("#cronNext");
    const nextCount = $("#cronNextCount");
    const copyButton = $("#cronCopy");
    const error = $("#cronError");
    const zoneNode = $("#cronZone");
    const monthNames = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
    const weekdayNames = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };
    const weekdayLabels = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    if (zoneNode) zoneNode.textContent = Intl.DateTimeFormat().resolvedOptions().timeZone || "本地时区";
    const timeFormatter = new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

    const parseValue = (token, min, max, names) => {
      const upper = token.toUpperCase();
      if (names && Object.prototype.hasOwnProperty.call(names, upper)) return names[upper];
      const value = Number(token);
      if (!Number.isInteger(value) || value < min || value > max) throw new Error(`“${token}”超出范围`);
      return value;
    };

    const parseField = (source, min, max, names) => {
      const text = source.trim();
      if (!text) throw new Error("字段不能为空");
      if (text === "*") return { values: new Set(Array.from({ length: max - min + 1 }, (_, index) => min + index)), restricted: false };
      const values = new Set();
      text.split(",").forEach((part) => {
        if (!part) throw new Error("字段里有空项");
        const [rangePart, stepPart] = part.split("/");
        const step = stepPart === undefined ? 1 : Number(stepPart);
        if (!Number.isInteger(step) || step < 1 || step > max - min + 1) throw new Error(`步长“${stepPart}”无效`);
        let start;
        let end;
        if (rangePart === "*") {
          start = min;
          end = max;
        } else if (rangePart.includes("-")) {
          const [left, right] = rangePart.split("-");
          start = parseValue(left, min, max, names);
          end = parseValue(right, min, max, names);
          if (start > end) throw new Error(`范围“${rangePart}”顺序不正确`);
        } else {
          start = parseValue(rangePart, min, max, names);
          end = start;
        }
        for (let value = start; value <= end; value += step) values.add(value);
      });
      if (!values.size) throw new Error("字段没有有效值");
      return { values, restricted: true };
    };

    const describe = (parts, fieldSets) => {
      const [minute, hour] = parts;
      const [minuteField, hourField, dayField, monthField, weekdayField] = fieldSets;
      const joinValues = (values) => [...values].sort((a, b) => a - b).join("、");
      const dayBits = [];
      if (monthField.restricted) dayBits.push(`${joinValues(monthField.values)} 月`);
      if (dayField.restricted) dayBits.push(`${joinValues(dayField.values)} 日`);
      if (weekdayField.restricted) {
        const days = [...weekdayField.values].sort((a, b) => a - b);
        if (days.length === 5 && days.every((value, index) => value === index + 1)) dayBits.push("工作日");
        else if (days.length === 2 && days[0] === 0 && days[1] === 6) dayBits.push("周末");
        else if (days.length === 7) dayBits.push("每天");
        else dayBits.push(days.map((value) => weekdayLabels[value % 7]).join("、"));
      }
      const prefix = dayBits.length ? `${dayBits.join(" ")}，` : "";
      const everyMinutes = /^\*\/\d+$/.test(minute) ? Number(minute.split("/")[1]) : null;
      const hourRange = /^(\d+)-(\d+)$/.test(hour);
      if (minute === "*" && hour === "*") return `${prefix}每分钟运行一次`;
      if (everyMinutes && hour === "*") return `${prefix}每 ${everyMinutes} 分钟运行一次`;
      if (/^\d+$/.test(minute) && hour === "*") return `${prefix}每小时的第 ${minute} 分钟运行`;
      if (/^\d+$/.test(minute) && /^\d+$/.test(hour)) {
        return `${prefix}每天 ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} 运行`;
      }
      if (everyMinutes && hourRange) {
        const [, start, end] = hour.match(/^(\d+)-(\d+)$/);
        return `${prefix}${start}–${end} 点之间每 ${everyMinutes} 分钟运行`;
      }
      const minuteText = minute === "*" ? "每分钟" : `第 ${joinValues(minuteField.values)} 分钟`;
      const hourText = hour === "*" ? "每小时" : hourRange ? `${hour.split("-")[0]}–${hour.split("-")[1]} 点` : `${joinValues(hourField.values)} 点`;
      return `${prefix}${hourText}${minuteText}运行`;
    };

    const parse = () => {
      if (error) error.hidden = true;
      if (!input.value.trim()) {
        if (description) description.textContent = "请输入五段 Cron 表达式。";
        if (fieldsNode) fieldsNode.replaceChildren();
        if (nextNode) nextNode.replaceChildren();
        return;
      }
      try {
        const parts = input.value.trim().split(/\s+/);
        if (parts.length !== 5) throw new Error("Cron 需要 5 段：分 时 日 月 周");
        const minuteField = parseField(parts[0], 0, 59);
        const hourField = parseField(parts[1], 0, 23);
        const dayField = parseField(parts[2], 1, 31);
        const monthField = parseField(parts[3], 1, 12, monthNames);
        const weekdayField = parseField(parts[4], 0, 7, weekdayNames);
        const weekdays = new Set([...weekdayField.values].map((value) => (value === 7 ? 0 : value)));
        const sets = [minuteField, hourField, dayField, monthField, { ...weekdayField, values: weekdays }];
        if (description) description.textContent = describe(parts, sets);
        if (fieldsNode) {
          fieldsNode.replaceChildren();
          ["分", "时", "日", "月", "周"].forEach((label, index) => {
            const chip = document.createElement("span");
            chip.className = "cron-chip";
            const key = document.createElement("span");
            key.textContent = label;
            const value = document.createElement("strong");
            value.textContent = parts[index];
            chip.append(key, value);
            fieldsNode.appendChild(chip);
          });
        }
        const now = new Date();
        now.setSeconds(0, 0);
        now.setMinutes(now.getMinutes() + 1);
        const next = [];
        for (let i = 0; i < 600000 && next.length < 10; i += 1) {
          const monthMatch = monthField.values.has(now.getMonth() + 1);
          const dayMatch = dayField.values.has(now.getDate());
          const weekdayMatch = weekdays.has(now.getDay());
          const dayMatches =
            dayField.restricted && weekdayField.restricted
              ? dayMatch || weekdayMatch
              : dayField.restricted
                ? dayMatch
                : weekdayField.restricted
                  ? weekdayMatch
                  : true;
          if (
            monthMatch &&
            dayMatches &&
            hourField.values.has(now.getHours()) &&
            minuteField.values.has(now.getMinutes())
          ) {
            next.push(new Date(now));
          }
          now.setMinutes(now.getMinutes() + 1);
        }
        if (nextNode) {
          nextNode.replaceChildren();
          next.forEach((date) => {
            const item = document.createElement("li");
            const time = document.createElement("strong");
            time.textContent = timeFormatter.format(date);
            const relative = document.createElement("span");
            const minutes = Math.round((date.getTime() - Date.now()) / 60000);
            relative.textContent = minutes < 60 ? `${minutes} 分钟后` : minutes < 1440 ? `${Math.round(minutes / 60)} 小时后` : `${Math.round(minutes / 1440)} 天后`;
            item.append(time, relative);
            nextNode.appendChild(item);
          });
          if (!next.length) {
            const item = document.createElement("li");
            item.className = "cron-empty";
            item.textContent = "未来一年内没有匹配时间，请检查日期与星期组合。";
            nextNode.appendChild(item);
          }
        }
        if (nextCount) nextCount.textContent = next.length ? `${next.length} 次 · 本地时区` : "没有匹配";
        if (copyButton) {
          copyButton.disabled = !next.length;
          copyButton.dataset.runs = next
            .map((date) =>
              new Intl.DateTimeFormat("zh-CN", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false,
              }).format(date)
            )
            .join("\n");
        }
      } catch (problem) {
        if (error) {
          error.textContent = problem.message || "表达式无法解析";
          error.hidden = false;
        }
        if (description) description.textContent = "表达式有误，请检查字段。";
        if (fieldsNode) fieldsNode.replaceChildren();
        if (nextNode) nextNode.replaceChildren();
        if (nextCount) nextCount.textContent = "";
      }
    };

    runButton.addEventListener("click", parse);
    copyButton?.addEventListener("click", () => {
      if (!copyButton.dataset.runs) return;
      copyText(copyButton.dataset.runs, "运行时间已复制");
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        parse();
      }
    });
    $$("[data-cron-example]").forEach((button) => {
      button.addEventListener("click", () => {
        input.value = button.dataset.cronExample;
        parse();
      });
    });
    parse();
  }

