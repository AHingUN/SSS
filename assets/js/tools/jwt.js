/* ==========================================================================
   JWT local decoder
   ChengYu · Lumen Toolkit
   ========================================================================== */
"use strict";

  /* ----------------------------------------------------------------------
     JWT decoder
     ---------------------------------------------------------------------- */
  function initJwtTool() {
    const input = $("#jwtInput");
    const headerOutput = $("#jwtHeader");
    const payloadOutput = $("#jwtPayload");
    if (!input || !headerOutput || !payloadOutput) return;
    const status = $("#jwtStatus");
    const meta = $("#jwtMeta");
    const sample =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJsdW1lbiIsIm5hbWUiOiJMdW1lbiBUb29sa2l0IiwiaWF0IjoxNzM1NjgwMDAwLCJleHAiOjIwNTEyMjI0MDB9.demo-signature";
    let headerText = "";
    let payloadText = "";
    const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    const decodePart = (part) => {
      const padded = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
      const binary = atob(padded);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    };

    const setStatus = (message, kind = "") => {
      if (!status) return;
      status.textContent = message;
      status.className = `jwt-status${kind ? ` is-${kind}` : ""}`;
    };

    const addMeta = (label, value, className = "") => {
      if (!meta) return;
      const chip = document.createElement("span");
      chip.className = `jwt-chip ${className}`.trim();
      const key = document.createElement("span");
      key.textContent = label;
      const strong = document.createElement("strong");
      strong.textContent = value;
      chip.append(key, strong);
      meta.appendChild(chip);
    };

    const decode = () => {
      const token = input.value.trim().replace(/^Bearer\s+/i, "");
      if (!token) {
        headerOutput.textContent = "";
        payloadOutput.textContent = "";
        headerText = "";
        payloadText = "";
        if (meta) meta.replaceChildren();
        setStatus("等待输入");
        return;
      }
      const parts = token.split(".");
      if (parts.length !== 3) {
        headerOutput.textContent = "";
        payloadOutput.textContent = "";
        if (meta) meta.replaceChildren();
        setStatus("JWT 需要由三段组成（header.payload.signature）", "error");
        return;
      }
      try {
        const header = JSON.parse(decodePart(parts[0]));
        const payload = JSON.parse(decodePart(parts[1]));
        headerText = JSON.stringify(header, null, 2);
        payloadText = JSON.stringify(payload, null, 2);
        headerOutput.textContent = headerText;
        payloadOutput.textContent = payloadText;
        if (meta) meta.replaceChildren();
        addMeta("alg", header.alg || "未知");
        addMeta("typ", header.typ || "JWT");
        addMeta("签名", parts[2] ? "已提供" : "缺失");
        if (Number.isFinite(payload.iat)) {
          addMeta("签发", dateFormatter.format(new Date(payload.iat * 1000)));
        }
        if (Number.isFinite(payload.exp)) {
          const expired = payload.exp * 1000 < Date.now();
          addMeta(expired ? "已过期" : "过期", dateFormatter.format(new Date(payload.exp * 1000)), expired ? "is-expired" : "");
          const remaining = payload.exp * 1000 - Date.now();
          const remainingText = expired
            ? "已过期"
            : remaining < 3600000
              ? `${Math.ceil(remaining / 60000)} 分钟后`
              : remaining < 86400000
                ? `${Math.ceil(remaining / 3600000)} 小时后`
                : `${Math.ceil(remaining / 86400000)} 天后`;
          addMeta("剩余", remainingText, expired ? "is-expired" : "");
        } else {
          addMeta("过期", "未声明");
        }
        setStatus("解码成功", "valid");
      } catch {
        headerOutput.textContent = "";
        payloadOutput.textContent = "";
        headerText = "";
        payloadText = "";
        if (meta) meta.replaceChildren();
        setStatus("无法解码：Base64URL 或 JSON 结构不正确", "error");
      }
    };

    $("#jwtDecode")?.addEventListener("click", decode);
    $("#jwtSample")?.addEventListener("click", () => {
      input.value = sample;
      decode();
    });
    $("#jwtClear")?.addEventListener("click", () => {
      input.value = "";
      decode();
      input.focus();
    });
    $("#jwtCopyHeader")?.addEventListener("click", () => {
      if (!headerText) return toast("还没有可复制的 Header", { type: "info" });
      copyText(headerText, "Header 已复制");
    });
    $("#jwtCopyPayload")?.addEventListener("click", () => {
      if (!payloadText) return toast("还没有可复制的 Payload", { type: "info" });
      copyText(payloadText, "Payload 已复制");
    });
    input.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        decode();
      }
    });
    input.value = sample;
    decode();
  }

