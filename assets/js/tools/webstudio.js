/* ==========================================================================
   Web studio: sandboxed playground, CSS gradients and meta tags
   ChengYu · Lumen Toolkit
   ========================================================================== */
"use strict";

function initWebStudioTool() {
  const tabs = $$("#webstudioTabs [data-studio-tab]");
  const panes = $$(".studio-pane", $("#webstudioTabs").closest(".studio-panel"));
  const activate = (id) => {
    tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.studioTab === id));
    panes.forEach((pane) => {
      const active = pane.dataset.studioPane === id;
      pane.hidden = !active;
      pane.classList.toggle("is-active", active);
    });
  };
  tabs.forEach((tab) => tab.addEventListener("click", () => activate(tab.dataset.studioTab)));

  const html = $("#playgroundHtml");
  const css = $("#playgroundCss");
  const js = $("#playgroundJs");
  const frame = $("#playgroundFrame");
  const status = $("#playgroundStatus");
  if (!html || !css || !js || !frame) return;
  const sampleHtml = [
    "<main class=\"demo-card\">",
    "  <span class=\"eyebrow\">LOCAL PREVIEW</span>",
    "  <h1>你好，程宇。</h1>",
    "  <p>这是一个完全在浏览器里运行的 HTML / CSS / JS 沙盒。</p>",
    "  <button id=\"hello\">点我</button>",
    "  <p id=\"answer\" aria-live=\"polite\"></p>",
    "</main>",
  ].join("\n");
  const sampleCss = [
    ":root { color-scheme: light; }",
    "* { box-sizing: border-box; }",
    "body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 28px; background: #f3f0ea; color: #24222b; font: 15px/1.7 -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif; }",
    ".demo-card { width: min(100%, 430px); padding: 28px; border: 1px solid #e6e0d8; border-radius: 22px; background: #fffdf8; box-shadow: 0 24px 50px -36px rgba(45, 35, 75, .45); }",
    ".eyebrow { color: #8173c8; font: 10px/1 'SFMono-Regular', Consolas, monospace; letter-spacing: .1em; }",
    "h1 { margin: 10px 0 8px; font-size: 32px; letter-spacing: -.05em; }",
    "p { margin: 0 0 18px; color: #6e6978; }",
    "button { border: 0; border-radius: 10px; padding: 9px 14px; background: #5b52c9; color: white; cursor: pointer; font: inherit; }",
    "#answer { min-height: 1.7em; margin-top: 12px; margin-bottom: 0; color: #1b8a5b; }",
  ].join("\n");
  const sampleJs = [
    "const button = document.querySelector('#hello');",
    "const answer = document.querySelector('#answer');",
    "let count = 0;",
    "button.addEventListener('click', () => {",
    "  count += 1;",
    "  answer.textContent = `你好，这是第 ${count} 次点击。`;",
    "});",
  ].join("\n");

  const buildDocument = () => {
    const safeJs = js.value.replace(/<\/script/gi, "<\\/script");
    return `<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css.value}</style></head>
<body>${html.value}<script>${safeJs}<\/script></body>
</html>`;
  };

  const run = () => {
    frame.srcdoc = buildDocument();
    if (status) status.textContent = `已运行 · ${new Date().toLocaleTimeString("zh-CN")}`;
  };

  const reset = () => {
    html.value = sampleHtml;
    css.value = sampleCss;
    js.value = sampleJs;
    run();
  };

  $("#playgroundRun")?.addEventListener("click", run);
  $("#playgroundReset")?.addEventListener("click", reset);
  $("#playgroundDownload")?.addEventListener("click", () => {
    downloadText(buildDocument(), "lumen-playground.html", "text/html;charset=utf-8");
    toast("沙盒页面已下载");
  });
  $("#playgroundOpen")?.addEventListener("click", () => {
    const url = URL.createObjectURL(new Blob([buildDocument()], { type: "text/html;charset=utf-8" }));
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    toast("已在新窗口打开预览", { type: "info" });
  });
  reset();

  // CSS gradient generator.
  const preview = $("#gradientPreview");
  const output = $("#gradientOutput");
  const gradientA = $("#gradientA");
  const gradientB = $("#gradientB");
  const angle = $("#gradientAngle");
  const angleValue = $("#gradientAngleValue");
  const angleBlock = $("#gradientAngleBlock");
  const typeButtons = $$("[data-gradient-type]");
  let gradientType = "linear";
  const updateGradient = () => {
    const a = gradientA?.value || "#7e8cff";
    const b = gradientB?.value || "#ffd66b";
    const deg = Number(angle?.value || 135);
    if (angleValue) angleValue.textContent = `${deg}°`;
    if (angleBlock) angleBlock.hidden = gradientType === "radial";
    const value = gradientType === "linear"
      ? `linear-gradient(${deg}deg, ${a}, ${b})`
      : `radial-gradient(circle at 50% 50%, ${a}, ${b})`;
    if (preview) preview.style.background = value;
    if (output) output.textContent = `background: ${value};\nbackground-size: cover;`;
  };
  typeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      gradientType = button.dataset.gradientType;
      typeButtons.forEach((item) => item.classList.toggle("is-active", item === button));
      updateGradient();
    });
  });
  [gradientA, gradientB, angle].forEach((input) => input?.addEventListener("input", updateGradient));
  $("#gradientRandom")?.addEventListener("click", () => {
    const randomColor = () => `#${[0, 1, 2].map(() => Math.floor(Math.random() * 200 + 28).toString(16).padStart(2, "0")).join("")}`;
    if (gradientA) gradientA.value = randomColor();
    if (gradientB) gradientB.value = randomColor();
    if (angle) angle.value = String(Math.floor(Math.random() * 360));
    updateGradient();
  });
  $("#gradientCopy")?.addEventListener("click", () => {
    if (!output?.textContent) return;
    copyText(output.textContent, "渐变 CSS 已复制");
  });
  updateGradient();

  // Meta / Open Graph generator.
  const metaTitle = $("#metaTitle");
  const metaDesc = $("#metaDesc");
  const metaUrl = $("#metaUrl");
  const metaImage = $("#metaImage");
  const metaColor = $("#metaColor");
  const metaOutput = $("#metaOutput");
  const metaGenerate = () => {
    if (!metaOutput) return;
    const title = metaTitle?.value.trim() || "未命名页面";
    const description = metaDesc?.value.trim() || "";
    const url = metaUrl?.value.trim() || "";
    const image = metaImage?.value.trim() || "";
    const color = metaColor?.value || "#5b7cfa";
    metaOutput.textContent = [
      `<title>${escapeHTML(title)}</title>`,
      `<meta name="description" content="${escapeAttribute(description)}">`,
      url ? `<link rel="canonical" href="${escapeAttribute(url)}">` : "",
      `<meta property="og:type" content="website">`,
      `<meta property="og:title" content="${escapeAttribute(title)}">`,
      `<meta property="og:description" content="${escapeAttribute(description)}">`,
      url ? `<meta property="og:url" content="${escapeAttribute(url)}">` : "",
      image ? `<meta property="og:image" content="${escapeAttribute(image)}">` : "",
      `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}">`,
      `<meta name="twitter:title" content="${escapeAttribute(title)}">`,
      `<meta name="twitter:description" content="${escapeAttribute(description)}">`,
      image ? `<meta name="twitter:image" content="${escapeAttribute(image)}">` : "",
      `<meta name="theme-color" content="${escapeAttribute(color)}">`,
    ].filter(Boolean).join("\n");
  };
  $("#metaGenerate")?.addEventListener("click", metaGenerate);
  $("#metaCopy")?.addEventListener("click", () => {
    if (!metaOutput?.textContent) return;
    copyText(metaOutput.textContent, "Meta 标签已复制");
  });
  [metaTitle, metaDesc, metaUrl, metaImage, metaColor].forEach((field) => field?.addEventListener("input", metaGenerate));
  metaGenerate();
}
