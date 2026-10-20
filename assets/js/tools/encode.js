/* ==========================================================================
   Encoding converter
   ChengYu · Lumen Toolkit
   ========================================================================== */
"use strict";

  /* ----------------------------------------------------------------------
     Encoding tool
     ---------------------------------------------------------------------- */
  function initEncodeTool() {
    const input = $("#encodeInput");
    const output = $("#encodeOutput");
    const copied = $("#encodeCopy");
    const errorBox = $("#encodeError");
    const hint = $("#encodeHint");
    const statusDot = $("#encodeStatusDot");
    const modeGroup = $("#encodeMode");
    const directionGroup = $("#encodeDirection");
    if (!input || !output) return null;

    let mode = "base64";
    let direction = "encode";
    input.maxLength = 200000;

    function hexEncode(value) {
      return Array.from(new TextEncoder().encode(value), (byte) => byte.toString(16).padStart(2, "0")).join(" ");
    }

    function hexDecode(value) {
      const normalized = value.replace(/0x/gi, "").replace(/[\s,:-]+/g, "");
      if (!/^[0-9a-f]*$/i.test(normalized) || normalized.length % 2 !== 0) {
        throw new Error("invalid-hex");
      }
      const bytes = new Uint8Array(normalized.length / 2);
      for (let index = 0; index < normalized.length; index += 2) {
        bytes[index / 2] = parseInt(normalized.slice(index, index + 2), 16);
      }
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    }

    function base64Encode(value) {
      const bytes = new TextEncoder().encode(value);
      let binary = "";
      const chunk = 0x8000;
      for (let offset = 0; offset < bytes.length; offset += chunk) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
      }
      return btoa(binary);
    }

    function base64Decode(value) {
      let normalized = value.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
      while (normalized.length % 4 !== 0) normalized += "=";
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
        throw new Error("invalid-base64");
      }
      const binary = atob(normalized);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    }

    function htmlEncode(value) {
      const node = document.createElement("textarea");
      node.textContent = value;
      return node.innerHTML;
    }

    function base32Encode(value) {
      const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
      const bytes = new TextEncoder().encode(value);
      let bits = 0;
      let buffer = 0;
      let output = "";
      bytes.forEach((byte) => {
        buffer = (buffer << 8) | byte;
        bits += 8;
        while (bits >= 5) {
          output += alphabet[(buffer >>> (bits - 5)) & 31];
          bits -= 5;
        }
      });
      if (bits > 0) output += alphabet[(buffer << (5 - bits)) & 31];
      while (output.length % 8 !== 0) output += "=";
      return output;
    }

    function base32Decode(value) {
      const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
      const clean = value.toUpperCase().replace(/\s+/g, "").replace(/=+$/g, "");
      if (!/^[A-Z2-7]*$/.test(clean)) throw new Error("invalid-base32");
      let bits = 0;
      let buffer = 0;
      const bytes = [];
      for (const char of clean) {
        const index = alphabet.indexOf(char);
        if (index < 0) throw new Error("invalid-base32");
        buffer = (buffer << 5) | index;
        bits += 5;
        if (bits >= 8) {
          bytes.push((buffer >>> (bits - 8)) & 255);
          bits -= 8;
        }
      }
      return new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes));
    }

    function htmlDecode(value) {
      const node = document.createElement("textarea");
      node.innerHTML = value;
      return node.value;
    }

    function baseHint() {
      if (mode === "base64") return "Unicode 安全 · 实时转换";
      if (mode === "base32") return "RFC 4648 · 字母与数字";
      if (mode === "hex") return "UTF-8 Hex · 字节级转换";
      if (mode === "html") return "HTML 实体 · 安全转义";
      return "encodeURIComponent · 组件模式";
    }

    function syncControls() {
      $$("button", modeGroup).forEach((button) => {
        const active = button.dataset.mode === mode;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", active ? "true" : "false");
      });
      $$("button", directionGroup).forEach((button) => {
        const active = button.dataset.direction === direction;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", active ? "true" : "false");
      });
      if (hint) hint.textContent = baseHint();
    }

    function setError(message) {
      if (errorBox) {
        errorBox.textContent = message;
        errorBox.hidden = false;
      }
      if (hint) hint.textContent = "转换未完成，请检查输入";
      statusDot?.classList.add("is-error");
      $(".encode-hint")?.classList.add("is-error");
    }

    function clearError() {
      if (errorBox) errorBox.hidden = true;
      statusDot?.classList.remove("is-error");
      $(".encode-hint")?.classList.remove("is-error");
      if (hint) hint.textContent = baseHint();
    }

    function convert() {
      const value = input.value;
      clearError();
      if (!value) {
        output.value = "";
        return;
      }
      try {
        let result;
        if (mode === "base64") {
          result = direction === "encode" ? base64Encode(value) : base64Decode(value);
        } else if (mode === "base32") {
          result = direction === "encode" ? base32Encode(value) : base32Decode(value);
        } else if (mode === "hex") {
          result = direction === "encode" ? hexEncode(value) : hexDecode(value);
        } else if (mode === "html") {
          result = direction === "encode" ? htmlEncode(value) : htmlDecode(value);
        } else {
          result = direction === "encode" ? encodeURIComponent(value) : decodeURIComponent(value);
        }
        output.value = result;
      } catch (error) {
        output.value = "";
        setError(
          mode === "base64"
            ? "无法解码这段 Base64，请检查内容是否完整。"
            : mode === "base32"
              ? "无法解码这段 Base32，请检查内容是否完整。"
              : mode === "hex"
                ? "无法解码这段 Hex，请提供偶数位十六进制字节。"
                : "URL 编码格式不完整，无法解码。"
        );
      }
    }

    modeGroup.addEventListener("click", (event) => {
      const button = event.target.closest("[data-mode]");
      if (!button) return;
      scheduledConvert.cancel();
      mode = button.dataset.mode;
      syncControls();
      convert();
    });

    directionGroup.addEventListener("click", (event) => {
      const button = event.target.closest("[data-direction]");
      if (!button) return;
      scheduledConvert.cancel();
      direction = button.dataset.direction;
      syncControls();
      convert();
    });

    const scheduledConvert = debounce(convert, 70);
    input.addEventListener("input", scheduledConvert);
    copied?.addEventListener("click", () => {
      if (!output.value) {
        toast("还没有可复制的结果", { type: "info" });
        return;
      }
      copyText(output.value);
    });
    $("#encodeClear")?.addEventListener("click", () => {
      scheduledConvert.cancel();
      input.value = "";
      output.value = "";
      clearError();
      input.focus();
    });
    $("#encodeSwap")?.addEventListener("click", () => {
      const current = output.value;
      if (!current) {
        toast("还没有可以交换的结果", { type: "info" });
        return;
      }
      scheduledConvert.cancel();
      input.value = current;
      direction = direction === "encode" ? "decode" : "encode";
      syncControls();
      convert();
      input.focus();
      toast(`已切换为${direction === "encode" ? "编码" : "解码"}`);
    });

    input.value = "程宇工具箱 · 日常小事，一气呵成。";
    syncControls();
    convert();
    return () => scheduledConvert.cancel();
  }

