/* ==========================================================================
   UUID generator
   ChengYu · Lumen Toolkit
   ========================================================================== */
"use strict";

  /* ----------------------------------------------------------------------
     UUID generator
     ---------------------------------------------------------------------- */
  function initUuidTool() {
    const formatGroup = $("#uuidFormat");
    const countSelect = $("#uuidCount");
    const uppercase = $("#uuidUpper");
    const withoutHyphens = $("#uuidHyphens");
    const generateButton = $("#uuidGenerate");
    const list = $("#uuidList");
    const copyAll = $("#uuidCopyAll");
    if (!formatGroup || !list) return null;

    let format = "uuid";
    let currentIds = [];
    const alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

    function randomUuid() {
      if (typeof window.crypto?.randomUUID === "function") return window.crypto.randomUUID();
      const bytes = new Uint8Array(16);
      window.crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes)
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }

    function randomUuidV7() {
      const bytes = new Uint8Array(16);
      window.crypto.getRandomValues(bytes);
      const timestamp = BigInt(Date.now());
      for (let index = 0; index < 6; index += 1) {
        bytes[index] = Number((timestamp >> BigInt((5 - index) * 8)) & 0xffn);
      }
      bytes[6] = (bytes[6] & 0x0f) | 0x70;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes)
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }

    function randomShortId(length = 20) {
      const bytes = new Uint8Array(length * 2);
      const limit = Math.floor(256 / alphabet.length) * alphabet.length;
      let result = "";
      while (result.length < length) {
        window.crypto.getRandomValues(bytes);
        for (const byte of bytes) {
          if (byte >= limit) continue;
          result += alphabet[byte % alphabet.length];
          if (result.length === length) break;
        }
      }
      return result;
    }

    function formatId(value) {
      let result = value;
      if ((format === "uuid" || format === "uuidv7") && withoutHyphens.checked) {
        result = result.replace(/-/g, "");
      }
      return uppercase.checked ? result.toUpperCase() : result;
    }

    function makeRow(value, index) {
      const row = document.createElement("button");
      row.className = "uuid-row";
      row.type = "button";
      row.setAttribute("aria-label", `复制 ID ${value}`);
      const code = document.createElement("code");
      code.textContent = value;
      const copyIcon = document.createElement("span");
      copyIcon.className = "uuid-copy";
      copyIcon.innerHTML = icon("copy");
      row.append(code, copyIcon);
      row.addEventListener("click", () => copyText(value, "ID 已复制"));
      row.style.setProperty("--row-index", String(index));
      return row;
    }

    function generate() {
      const count = Math.min(Number(countSelect.value) || 1, 20);
      currentIds = Array.from({ length: count }, () => {
        const raw =
          format === "short"
            ? randomShortId(20)
            : format === "uuidv7"
              ? randomUuidV7()
              : randomUuid();
        return formatId(raw);
      });
      list.innerHTML = "";
      const fragment = document.createDocumentFragment();
      currentIds.forEach((id, index) => fragment.appendChild(makeRow(id, index)));
      list.appendChild(fragment);
      copyAll.disabled = currentIds.length === 0;
      animateStagger(list, ".uuid-row", { limit: 20, distance: 5, duration: 280 });
    }

    function syncFormatUi() {
      $$("button", formatGroup).forEach((button) => {
        const active = button.dataset.uuidFormat === format;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", active ? "true" : "false");
      });
      withoutHyphens.disabled = format === "short";
      const label = withoutHyphens.closest(".switch-row");
      if (label) label.classList.toggle("is-disabled", format === "short");
    }

    formatGroup.addEventListener("click", (event) => {
      const button = event.target.closest("[data-uuid-format]");
      if (!button) return;
      format = button.dataset.uuidFormat;
      syncFormatUi();
      generate();
    });
    countSelect.addEventListener("change", generate);
    uppercase.addEventListener("change", generate);
    withoutHyphens.addEventListener("change", generate);
    generateButton.addEventListener("click", () => {
      generate();
      if (!reducedMotion) {
        generateButton.animate(
          [{ transform: "scale(1)" }, { transform: "scale(0.97)" }, { transform: "scale(1)" }],
          { duration: 200, easing: "ease-out" }
        );
      }
    });
    copyAll.addEventListener("click", () => {
      if (!currentIds.length) return;
      copyText(currentIds.join("\n"), `已复制 ${currentIds.length} 个 ID`);
    });

    syncFormatUi();
    generate();
    return null;
  }

