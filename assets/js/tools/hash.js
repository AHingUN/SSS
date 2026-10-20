/* ==========================================================================
   Hash generator
   ChengYu · Lumen Toolkit
   ========================================================================== */
"use strict";

  /* ----------------------------------------------------------------------
     Hash generator
     ---------------------------------------------------------------------- */
  /*
    SHA 与 HMAC 都通过 Web Crypto 本地计算：
    - 文本先 TextEncoder 成 UTF-8；
    - crypto.subtle.digest 异步返回 ArrayBuffer；
    - 结果转成小写 HEX，可按需转大写并复制。
    HMAC 使用 SHA-256 作为底层算法，密钥同样只在浏览器内存中。
  */
  function initHashTool() {
    const input = $("#hashInput");
    const byteCount = $("#hashByteCount");
    const status = $("#hashStatus");
    const statusText = $("#hashStatusText");
    const results = $("#hashResults");
    const copyAll = $("#hashCopyAll");
    const uppercase = $("#hashUppercase");
    const hmacKey = $("#hashHmacKey");
    const hmacValue = $("#hashHmacValue");
    const hmacCopy = $("#hashHmacCopy");
    if (!input || !results) return null;

    const algorithms = [
      { id: "SHA-1", bits: 160 },
      { id: "SHA-256", bits: 256 },
      { id: "SHA-384", bits: 384 },
      { id: "SHA-512", bits: 512 },
    ];
    const rows = [];
    const hashes = {};
    let hmacHex = "";
    let hashToken = 0;

    const sample = "程宇工具箱 · 日常小事，一气呵成。\nEverything stays local.";
    input.value = sample;
    input.maxLength = 200000;

    algorithms.forEach((algorithm) => {
      const row = document.createElement("div");
      row.className = "hash-row";
      const head = document.createElement("div");
      head.className = "hash-row-head";
      const label = document.createElement("span");
      label.className = "hash-label";
      label.textContent = algorithm.id;
      const bits = document.createElement("span");
      bits.className = "hash-bits";
      bits.textContent = `${algorithm.bits} bit`;
      head.append(label, bits);

      const code = document.createElement("code");
      code.className = "hash-value";
      code.textContent = "—";

      const copyButton = document.createElement("button");
      copyButton.className = "hash-copy";
      copyButton.type = "button";
      copyButton.setAttribute("aria-label", `复制 ${algorithm.id} 摘要`);
      copyButton.innerHTML = icon("copy");
      copyButton.disabled = true;

      row.append(head, code, copyButton);
      results.appendChild(row);
      rows.push({ algorithm, code, copyButton, row });
      copyButton.addEventListener("click", () => {
        if (!hashes[algorithm.id]) return;
        copyText(hashes[algorithm.id], `${algorithm.id} 摘要已复制`);
      });
    });

    function setStatus(message, state = "idle") {
      status.dataset.state = state;
      statusText.textContent = message;
    }

    function displayHashes() {
      const transform = (value) => (uppercase.checked ? value.toUpperCase() : value);
      rows.forEach(({ algorithm, code, copyButton }) => {
        const value = hashes[algorithm.id];
        code.textContent = value ? transform(value) : "—";
        copyButton.disabled = !value;
      });
      if (hmacValue) hmacValue.textContent = hmacHex ? transform(hmacHex) : "—";
      if (hmacCopy) hmacCopy.disabled = !hmacHex;
      copyAll.disabled = !algorithms.every((algorithm) => hashes[algorithm.id]);
    }

    function updateByteCount() {
      if (byteCount) byteCount.textContent = `${new TextEncoder().encode(input.value).length} 字节`;
    }

    function scheduleHash() {
      window.clearTimeout(hashTimer);
      updateByteCount();
      copyAll.disabled = true;
      if (!input.value) {
        hashToken += 1;
        algorithms.forEach((algorithm) => delete hashes[algorithm.id]);
        hmacHex = "";
        displayHashes();
        setStatus("等待输入", "idle");
        return;
      }
      setStatus("正在准备摘要…", "busy");
      hashTimer = window.setTimeout(computeHashes, 160);
    }

    let hashTimer = 0;

    async function computeHashes() {
      const token = ++hashToken;
      const text = input.value;
      updateByteCount();
      if (!window.crypto?.subtle) {
        setStatus("当前环境不支持 Web Crypto", "error");
        copyAll.disabled = true;
        return;
      }
      try {
        const bytes = new TextEncoder().encode(text);
        const values = await Promise.all(
          algorithms.map(async (algorithm) => {
            const digest = await window.crypto.subtle.digest(algorithm.id, bytes);
            const hex = Array.from(new Uint8Array(digest))
              .map((byte) => byte.toString(16).padStart(2, "0"))
              .join("");
            return [algorithm.id, hex];
          })
        );
        if (token !== hashToken) return;
        values.forEach(([id, value]) => {
          hashes[id] = value;
        });
        hmacHex = "";
        if (hmacKey?.value) {
          const key = await window.crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(hmacKey.value),
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign"]
          );
          const signature = await window.crypto.subtle.sign("HMAC", key, bytes);
          hmacHex = Array.from(new Uint8Array(signature))
            .map((byte) => byte.toString(16).padStart(2, "0"))
            .join("");
        }
        if (token !== hashToken) return;
        displayHashes();
        setStatus("摘要已更新", "valid");
        animateStagger(results, ".hash-row", { limit: 4, distance: 4, duration: 240 });
      } catch (error) {
        if (token !== hashToken) return;
        setStatus("摘要计算失败，请重试", "error");
        copyAll.disabled = true;
      }
    }

    input.addEventListener("input", scheduleHash);
    hmacKey?.addEventListener("input", scheduleHash);
    uppercase.addEventListener("change", displayHashes);
    hmacCopy?.addEventListener("click", () => {
      if (!hmacHex) return;
      copyText(uppercase.checked ? hmacHex.toUpperCase() : hmacHex, "HMAC 摘要已复制");
    });
    copyAll.addEventListener("click", () => {
      if (!algorithms.every((algorithm) => hashes[algorithm.id])) return;
      const value = (hash) => (uppercase.checked ? hash.toUpperCase() : hash);
      const text = algorithms
        .map((algorithm) => `${algorithm.id}: ${value(hashes[algorithm.id])}`)
        .join("\n") + (hmacHex ? `\nHMAC-SHA256: ${value(hmacHex)}` : "");
      copyText(text, "所有摘要已复制");
    });

    updateByteCount();
    computeHashes();
    return () => window.clearTimeout(hashTimer);
  }

