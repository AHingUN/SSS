/* ==========================================================================
   Life calculator: loan, BMI, tip and timezone conversion
   ChengYu · Lumen Toolkit
   ========================================================================== */
"use strict";

function initLifeTool() {
  const tabs = $$("#lifeTabs [data-studio-tab]");
  const panes = $$(".studio-pane", $("#lifeTabs")?.closest(".studio-panel"));
  if (!tabs.length || !panes.length) return;
  const activate = (id) => {
    tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.studioTab === id));
    panes.forEach((pane) => {
      const active = pane.dataset.studioPane === id;
      pane.hidden = !active;
      pane.classList.toggle("is-active", active);
    });
  };
  tabs.forEach((tab) => tab.addEventListener("click", () => activate(tab.dataset.studioTab)));

  const money = new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 2,
  });
  const numeric = (selector, fallback = 0) => {
    const value = Number($(selector)?.value);
    return Number.isFinite(value) ? value : fallback;
  };

  const loanAmount = $("#loanAmount");
  const loanRate = $("#loanRate");
  const loanYears = $("#loanYears");
  const calculateLoan = () => {
    const principal = Math.max(0, numeric("#loanAmount"));
    const annual = Math.max(0, numeric("#loanRate"));
    const years = Math.max(1, numeric("#loanYears", 30));
    const months = Math.round(years * 12);
    const monthlyRate = annual / 100 / 12;
    const monthly = monthlyRate === 0
      ? principal / months
      : principal * monthlyRate / (1 - (1 + monthlyRate) ** -months);
    const total = monthly * months;
    if ($("#loanMonthly")) $("#loanMonthly").textContent = money.format(monthly || 0);
    if ($("#loanDetails")) {
      $("#loanDetails").innerHTML = [
        `<span>贷款总额 <strong>${money.format(principal)}</strong></span>`,
        `<span>支付利息 <strong>${money.format(Math.max(0, total - principal))}</strong></span>`,
        `<span>还款总额 <strong>${money.format(total)}</strong></span>`,
        `<span>期数 <strong>${months} 期</strong></span>`,
      ].join("");
    }
  };
  [loanAmount, loanRate, loanYears].forEach((input) => input?.addEventListener("input", calculateLoan));
  $("#loanCalc")?.addEventListener("click", calculateLoan);

  const bmiHeight = $("#bmiHeight");
  const bmiWeight = $("#bmiWeight");
  const calculateBmi = () => {
    const height = Math.max(0, numeric("#bmiHeight")) / 100;
    const weight = Math.max(0, numeric("#bmiWeight"));
    const bmi = height ? weight / (height * height) : 0;
    let label = "等待计算";
    if (bmi) {
      if (bmi < 18.5) label = "偏瘦";
      else if (bmi < 24) label = "健康范围";
      else if (bmi < 28) label = "偏重";
      else label = "肥胖范围";
    }
    if ($("#bmiValue")) $("#bmiValue").textContent = bmi ? bmi.toFixed(1) : "—";
    if ($("#bmiLabel")) $("#bmiLabel").textContent = label;
    if ($("#bmiDetails")) {
      $("#bmiDetails").innerHTML = [
        `<span>健康范围 <strong>18.5 – 23.9</strong></span>`,
        `<span>理想体重 <strong>${height ? (18.5 * height * height).toFixed(1) + " – " + (23.9 * height * height).toFixed(1) + " kg" : "—"}</strong></span>`,
      ].join("");
    }
  };
  [bmiHeight, bmiWeight].forEach((input) => input?.addEventListener("input", calculateBmi));
  $("#bmiCalc")?.addEventListener("click", calculateBmi);

  const calculateTip = () => {
    const bill = Math.max(0, numeric("#tipBill"));
    const percent = Math.max(0, numeric("#tipPercent"));
    const people = Math.max(1, Math.round(numeric("#tipPeople", 1)));
    const tip = bill * percent / 100;
    const total = bill + tip;
    const per = total / people;
    if ($("#tipTotal")) $("#tipTotal").textContent = money.format(total);
    if ($("#tipDetails")) {
      $("#tipDetails").innerHTML = [
        `<span>小费 <strong>${money.format(tip)}</strong></span>`,
        `<span>每人 <strong>${money.format(per)}</strong></span>`,
        `<span>人数 <strong>${people} 人</strong></span>`,
      ].join("");
    }
  };
  [$("#tipBill"), $("#tipPercent"), $("#tipPeople")].forEach((input) => input?.addEventListener("input", calculateTip));
  $("#tipCalc")?.addEventListener("click", calculateTip);

  const zones = [
    "UTC",
    "Asia/Shanghai",
    "Asia/Tokyo",
    "Asia/Singapore",
    "Asia/Dubai",
    "Europe/London",
    "Europe/Paris",
    "America/New_York",
    "America/Los_Angeles",
    "Australia/Sydney",
  ];
  const zoneFrom = $("#zoneFrom");
  const zoneTo = $("#zoneTo");
  const zoneDateTime = $("#zoneDateTime");
  const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (zoneFrom && zoneTo) {
    zones.forEach((zone) => {
      const label = zone.replace(/_/g, " ");
      zoneFrom.add(new Option(label, zone));
      zoneTo.add(new Option(label, zone));
    });
    if (zones.includes(localZone)) zoneFrom.value = localZone;
    if (zones.includes("Europe/London")) zoneTo.value = "Europe/London";
  }
  const pad = (value) => String(value).padStart(2, "0");
  const dateInputValue = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  if (zoneDateTime && !zoneDateTime.value) zoneDateTime.value = dateInputValue(new Date());

  const zoneOffset = (zone, date) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(date);
    const values = {};
    parts.forEach((part) => { if (part.type !== "literal") values[part.type] = Number(part.value); });
    const asUtc = Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute, values.second);
    return asUtc - date.getTime();
  };

  const wallTimeToUtc = (value, zone) => {
    const [datePart, timePart] = value.split("T");
    const [year, month, day] = datePart.split("-").map(Number);
    const [hour, minute] = timePart.split(":").map(Number);
    const naive = Date.UTC(year, month - 1, day, hour, minute, 0);
    let utc = naive;
    for (let index = 0; index < 3; index += 1) {
      utc = naive - zoneOffset(zone, new Date(utc));
    }
    return new Date(utc);
  };

  const convertZone = () => {
    if (!zoneDateTime?.value || !zoneFrom?.value || !zoneTo?.value) return;
    try {
      const instant = wallTimeToUtc(zoneDateTime.value, zoneFrom.value);
      const target = new Intl.DateTimeFormat("zh-CN", {
        timeZone: zoneTo.value,
        dateStyle: "full",
        timeStyle: "short",
      }).format(instant);
      if ($("#zoneResult")) $("#zoneResult").textContent = target;
      if ($("#zoneSummary")) {
        $("#zoneSummary").textContent = `${zoneFrom.value.replace(/_/g, " ")} → ${zoneTo.value.replace(/_/g, " ")}`;
      }
    } catch (error) {
      if ($("#zoneResult")) $("#zoneResult").textContent = "无法换算";
      if ($("#zoneSummary")) $("#zoneSummary").textContent = "请检查日期与时区";
    }
  };
  $("#zoneConvert")?.addEventListener("click", convertZone);
  [zoneDateTime, zoneFrom, zoneTo].forEach((input) => input?.addEventListener("change", convertZone));

  const calculateCompound = () => {
    const principal = Math.max(0, numeric("#compoundPrincipal"));
    const annual = Math.max(0, numeric("#compoundRate"));
    const years = Math.max(1, Math.min(60, numeric("#compoundYears", 10)));
    const monthly = Math.max(0, numeric("#compoundMonthly"));
    const months = Math.round(years * 12);
    const rate = annual / 100 / 12;
    const growth = rate === 0 ? months : (Math.pow(1 + rate, months) - 1) / rate;
    const balance = principal * Math.pow(1 + rate, months) + monthly * growth;
    const contributed = principal + monthly * months;
    if ($("#compoundTotal")) $("#compoundTotal").textContent = money.format(balance);
    if ($("#compoundDetails")) {
      $("#compoundDetails").innerHTML = [
        `<span>累计投入 <strong>${money.format(contributed)}</strong></span>`,
        `<span>收益 <strong>${money.format(Math.max(0, balance - contributed))}</strong></span>`,
        `<span>月数 <strong>${months} 个月</strong></span>`,
      ].join("");
    }
  };
  ["#compoundPrincipal", "#compoundRate", "#compoundYears", "#compoundMonthly"].forEach((selector) => {
    $(selector)?.addEventListener("input", calculateCompound);
  });
  $("#compoundCalc")?.addEventListener("click", calculateCompound);

  calculateLoan();
  calculateBmi();
  calculateTip();
  convertZone();
  calculateCompound();
}
