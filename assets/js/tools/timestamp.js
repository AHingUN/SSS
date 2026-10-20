/* ==========================================================================
   Timestamp converter
   ChengYu · Lumen Toolkit
   ========================================================================== */
"use strict";

  /* ----------------------------------------------------------------------
     Timestamp tool
     ---------------------------------------------------------------------- */
  function initTimestampTool() {
    const tsInput = $("#tsInput");
    const tsDetected = $("#tsDetected");
    const tsLocal = $("#tsLocal");
    const tsUtc = $("#tsUtc");
    const tsIso = $("#tsIso");
    const tsRelative = $("#tsRelative");
    const dtInput = $("#dtInput");
    const dtSeconds = $("#dtSeconds");
    const dtMs = $("#dtMs");
    if (!tsInput || !dtInput) return null;

    tsInput.maxLength = 40;

    function toDateTimeLocal(date) {
      const offset = date.getTimezoneOffset() * 60000;
      return new Date(date.getTime() - offset).toISOString().slice(0, 19);
    }

    function localDate(date) {
      return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())} ${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())} ${WEEKDAYS[date.getDay()]}`;
    }

    function relativeTime(date) {
      const difference = date.getTime() - Date.now();
      const absolute = Math.abs(difference);
      if (absolute < 10_000) return "刚刚";
      if (absolute < 60_000) {
        const value = Math.floor(absolute / 1000);
        return difference > 0 ? `${value} 秒后` : `${value} 秒前`;
      }
      if (absolute < 3_600_000) {
        const value = Math.floor(absolute / 60_000);
        return difference > 0 ? `${value} 分钟后` : `${value} 分钟前`;
      }
      if (absolute < 86_400_000) {
        const value = Math.floor(absolute / 3_600_000);
        return difference > 0 ? `${value} 小时后` : `${value} 小时前`;
      }
      if (absolute < 2_592_000_000) {
        const value = Math.floor(absolute / 86_400_000);
        return difference > 0 ? `${value} 天后` : `${value} 天前`;
      }
      if (absolute < 31_536_000_000) {
        const value = Math.floor(absolute / 2_592_000_000);
        return difference > 0 ? `${value} 个月后` : `${value} 个月前`;
      }
      const value = Math.floor(absolute / 31_536_000_000);
      return difference > 0 ? `${value} 年后` : `${value} 年前`;
    }

    function clearTimestampResults() {
      if (tsLocal) tsLocal.textContent = "—";
      if (tsUtc) tsUtc.textContent = "—";
      if (tsIso) tsIso.textContent = "—";
      if (tsRelative) tsRelative.textContent = "—";
    }

    function readTimestamp() {
      if (!tsInput) return;
      const raw = tsInput.value.trim().replace(/[,\s_]/g, "");
      if (!raw) {
        clearTimestampResults();
        if (tsDetected) {
          tsDetected.textContent = "自动识别秒 / 毫秒";
          tsDetected.style.color = "";
        }
        return;
      }
      if (!/^-?\d+(\.\d+)?$/.test(raw)) {
        clearTimestampResults();
        if (tsDetected) {
          tsDetected.textContent = "请输入数字时间戳";
          tsDetected.style.color = "var(--danger)";
        }
        return;
      }
      const numeric = Number(raw);
      if (!Number.isFinite(numeric)) {
        clearTimestampResults();
        return;
      }
      const milliseconds = Math.abs(numeric) >= 1e11 ? numeric : numeric * 1000;
      const date = new Date(milliseconds);
      if (Number.isNaN(date.getTime()) || Math.abs(milliseconds) > 8.64e15) {
        clearTimestampResults();
        if (tsDetected) {
          tsDetected.textContent = "这个时间戳超出了可处理范围";
          tsDetected.style.color = "var(--danger)";
        }
        return;
      }
      if (tsDetected) {
        tsDetected.textContent = `已识别为${Math.abs(numeric) >= 1e11 ? "毫秒" : "秒"}级时间戳`;
        tsDetected.style.color = "";
      }
      if (tsLocal) tsLocal.textContent = localDate(date);
      if (tsUtc) {
        tsUtc.textContent = date.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
      }
      if (tsIso) tsIso.textContent = date.toISOString();
      if (tsRelative) tsRelative.textContent = relativeTime(date);
    }

    function readDateTime() {
      if (!dtInput) return;
      const date = new Date(dtInput.value);
      if (!dtInput.value || Number.isNaN(date.getTime())) {
        if (dtSeconds) dtSeconds.textContent = "—";
        if (dtMs) dtMs.textContent = "—";
        return;
      }
      if (dtSeconds) dtSeconds.textContent = String(Math.floor(date.getTime() / 1000));
      if (dtMs) dtMs.textContent = String(date.getTime());
    }

    function fillNow() {
      const now = new Date();
      if (tsInput) tsInput.value = String(Math.floor(now.getTime() / 1000));
      if (dtInput) dtInput.value = toDateTimeLocal(now);
      readTimestamp();
      readDateTime();
    }

    tsInput.addEventListener("input", readTimestamp);
    dtInput.addEventListener("input", readDateTime);
    $("#tsNow")?.addEventListener("click", () => {
      const now = new Date();
      tsInput.value = String(Math.floor(now.getTime() / 1000));
      readTimestamp();
    });
    $("#dtNow")?.addEventListener("click", () => {
      dtInput.value = toDateTimeLocal(new Date());
      readDateTime();
    });

    $("#copyNowSeconds")?.addEventListener("click", () => {
      copyText(String(Math.floor(Date.now() / 1000)));
    });
    $("#copyNowMs")?.addEventListener("click", () => {
      copyText(String(Date.now()));
    });
    $$("[data-copy-of]").forEach((button) => {
      button.addEventListener("click", () => {
        const target = document.getElementById(button.dataset.copyOf);
        const value = target?.textContent?.trim() || "";
        if (!value || value === "—") {
          toast("还没有可复制的时间结果", { type: "info" });
          return;
        }
        copyText(value);
      });
    });

    fillNow();
    return null;
  }

