/* ==========================================================================
   File workshop: local SHA hashes, Base64 encoding and file restore
   ChengYu · Lumen Toolkit
   ========================================================================== */
"use strict";

  /* ----------------------------------------------------------------------
     File workshop
     ---------------------------------------------------------------------- */
  /*
    文件处理分成三条链，互不自动串联：

    1. 文件 → 读取 ArrayBuffer → Web Crypto 计算四种 SHA；
    2. 文件 → FileReader DataURL → 提取 Base64 文本；
    3. 用户粘贴的 Base64 / Data URL → Uint8Array → Blob → 下载还原文件。

    文件大小上限 25MB；所有读取、摘要和 Base64 转换都在本机内存中完成，
    不会把文件内容发到任何地方。
  */
  function initFileKitTool() {
    const drop = $("#filekitDrop");
    const input = $("#filekitInput");
    const choose = $("#filekitChoose");
    const fileCard = $("#filekitFile");
    const fileName = $("#filekitName");
    const fileMeta = $("#filekitMeta");
    const change = $("#filekitChange");
    const remove = $("#filekitRemove");
    const preview = $("#filekitPreview");
    const previewImage = $("#filekitImage");
    const status = $("#filekitStatus");
    const modeGroup = $("#filekitModes");
    const hashPane = $("#filekitHashPane");
    const encodePane = $("#filekitEncodePane");
    const decodePane = $("#filekitDecodePane");
    const hashList = $("#filekitHashes");
    const copyAll = $("#filekitCopyAll");
    const hashHint = $("#filekitHashHint");
    const expectedHash = $("#filekitExpected");
    const compareButton = $("#filekitCompare");
    const compareState = $("#filekitCompareState");
    const base64Output = $("#filekitBase64");
    const encodeSize = $("#filekitEncodeSize");
    const copyBase64 = $("#filekitCopyBase64");
    const downloadBase64 = $("#filekitDownloadBase64");
    const decodeInput = $("#filekitDecodeInput");
    const decodeButton = $("#filekitDecode");
    const decodeSave = $("#filekitDecodeSave");
    const decodeInfo = $("#filekitDecodeInfo");
    const decodeError = $("#filekitDecodeError");
    if (!drop || !input || !hashList) return null;

    const MAX_FILE = 25 * 1024 * 1024;
    const algorithms = [
      { id: "SHA-1", bits: 160 },
      { id: "SHA-256", bits: 256 },
      { id: "SHA-384", bits: 384 },
      { id: "SHA-512", bits: 512 },
    ];
    const extensions = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp",
      "image/gif": "gif",
      "image/svg+xml": "svg",
      "application/pdf": "pdf",
      "application/json": "json",
      "application/zip": "zip",
      "text/plain": "txt",
      "text/csv": "csv",
      "text/html": "html",
      "audio/mpeg": "mp3",
      "audio/wav": "wav",
      "video/mp4": "mp4",
    };

    let currentFile = null;
    let mode = "hash";
    let hashToken = 0;
    let hashValues = null;
    let base64Value = "";
    let base64Token = 0;
    let decoded = null;
    let previewUrl = "";
    const hashRows = [];

    function setStatus(text, state = "idle") {
      if (!status) return;
      status.textContent = text;
      status.dataset.state = state;
    }

    function safeName(name, fallback = "file") {
      return String(name || fallback).replace(/[\\/:*?"<>|]+/g, "_").slice(0, 160) || fallback;
    }

    function fileDate(value) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "";
      return new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(date);
    }

    function clearPreview() {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = "";
      if (previewImage) previewImage.removeAttribute("src");
      if (preview) preview.hidden = true;
    }

    function showPreview(file) {
      if (!preview || !previewImage) return;
      if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) return;
      previewUrl = URL.createObjectURL(file);
      previewImage.src = previewUrl;
      preview.hidden = false;
      previewImage.onload = () => {
        URL.revokeObjectURL(previewUrl);
        previewUrl = "";
      };
    }

    function resetHashes() {
      hashValues = null;
      if (compareState) {
        compareState.textContent = "支持任意一种 SHA 摘要";
        compareState.className = "filekit-compare-state";
      }
      hashRows.forEach(({ code, copy }) => {
        code.textContent = "—";
        code.classList.remove("has-value");
        copy.disabled = true;
      });
      if (copyAll) copyAll.disabled = true;
    }

    function resetBase64() {
      base64Value = "";
      if (base64Output) base64Output.value = "";
      if (encodeSize) encodeSize.textContent = "0 B";
      if (copyBase64) copyBase64.disabled = true;
      if (downloadBase64) downloadBase64.disabled = true;
    }

    function compareHashes() {
      if (!compareState) return;
      const expected = (expectedHash?.value || "").replace(/\s+/g, "").toLowerCase();
      if (!expected) {
        compareState.textContent = "支持任意一种 SHA 摘要";
        compareState.className = "filekit-compare-state";
        return;
      }
      if (!hashValues) {
        compareState.textContent = "先选择文件并等待摘要完成";
        compareState.className = "filekit-compare-state";
        return;
      }
      const matched = algorithms.find((algorithm) => hashValues[algorithm.id] === expected);
      compareState.textContent = matched
        ? `校验一致 · ${matched.id}`
        : "没有匹配的摘要，请检查文件或摘要内容";
      compareState.className = `filekit-compare-state ${matched ? "is-match" : "is-miss"}`;
    }

    function clearDecoded() {
      decoded = null;
      if (decodeSave) decodeSave.disabled = true;
      if (decodeInfo) decodeInfo.textContent = "";
      if (decodeError) decodeError.hidden = true;
    }

    function buildHashRows() {
      algorithms.forEach((algorithm) => {
        const row = document.createElement("div");
        row.className = "filekit-hash-row";
        const label = document.createElement("span");
        label.className = "filekit-hash-label";
        label.textContent = algorithm.id;
        const code = document.createElement("code");
        code.className = "filekit-hash-value";
        code.textContent = "—";
        const copy = document.createElement("button");
        copy.className = "filekit-hash-copy";
        copy.type = "button";
        copy.disabled = true;
        copy.setAttribute("aria-label", `复制 ${algorithm.id} 摘要`);
        copy.innerHTML = icon("copy");
        copy.addEventListener("click", () => {
          if (!hashValues?.[algorithm.id]) return;
          copyText(hashValues[algorithm.id], `${algorithm.id} 摘要已复制`);
        });
        row.append(label, code, copy);
        hashList.appendChild(row);
        hashRows.push({ algorithm, code, copy });
      });
    }

    function syncMode() {
      $$("button", modeGroup).forEach((button) => {
        const active = button.dataset.filekitMode === mode;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", active ? "true" : "false");
      });
      if (hashPane) hashPane.hidden = mode !== "hash";
      if (encodePane) encodePane.hidden = mode !== "encode";
      if (decodePane) decodePane.hidden = mode !== "decode";
      if (mode === "hash" && currentFile && !hashValues) computeHashes();
      if (mode === "encode" && currentFile && !base64Value) encodeFile();
    }

    /*
      选中文件后只做一次读取：
      - 图片：生成 ObjectURL 预览；
      - SHA：重新读取 ArrayBuffer 交给 crypto.subtle；
      - Base64：用 readAsDataURL 再截取逗号后的部分。
      三条链各自维护状态，切换文件时统一 reset。
    */
    function selectFile(file) {
      if (!file) return;
      if (file.size > MAX_FILE) {
        toast("文件超过 25 MB，请换一个更小的文件", { type: "info" });
        setStatus("文件过大", "error");
        input.value = "";
        return;
      }
      currentFile = file;
      hashToken += 1;
      base64Token += 1;
      hashValues = null;
      base64Value = "";
      resetHashes();
      resetBase64();
      clearPreview();
      if (fileName) fileName.textContent = file.name;
      if (fileMeta) {
        const date = fileDate(file.lastModified);
        fileMeta.textContent = [
          formatBytes(file.size),
          file.type || "未知类型",
          date,
        ].filter(Boolean).join(" · ");
      }
      if (drop) drop.hidden = true;
      if (fileCard) fileCard.hidden = false;
      showPreview(file);
      setStatus("已选择", "valid");
      if (mode === "hash") computeHashes();
      if (mode === "encode") encodeFile();
    }

    function resetFile() {
      currentFile = null;
      hashToken += 1;
      base64Token += 1;
      hashValues = null;
      base64Value = "";
      resetHashes();
      resetBase64();
      if (expectedHash) expectedHash.value = "";
      clearPreview();
      if (fileCard) fileCard.hidden = true;
      if (drop) drop.hidden = false;
      if (fileName) fileName.textContent = "—";
      if (fileMeta) fileMeta.textContent = "—";
      setStatus("等待文件", "idle");
      input.value = "";
    }

    function openPicker() {
      input.value = "";
      input.click();
    }

    async function computeHashes() {
      if (!currentFile) return;
      if (!window.crypto?.subtle) {
        setStatus("当前环境不支持 Web Crypto", "error");
        return;
      }
      const token = ++hashToken;
      const file = currentFile;
      setStatus("计算摘要…", "busy");
      if (hashHint) hashHint.textContent = "正在读取文件…";
      try {
        const buffer = await file.arrayBuffer();
        const values = await Promise.all(
          algorithms.map(async (algorithm) => {
            const digest = await window.crypto.subtle.digest(algorithm.id, buffer);
            const hex = Array.from(new Uint8Array(digest))
              .map((byte) => byte.toString(16).padStart(2, "0"))
              .join("");
            return [algorithm.id, hex];
          })
        );
        if (token !== hashToken || file !== currentFile) return;
        hashValues = Object.fromEntries(values);
        hashRows.forEach(({ algorithm, code, copy }) => {
          const value = hashValues[algorithm.id];
          code.textContent = value || "—";
          code.classList.toggle("has-value", Boolean(value));
          copy.disabled = !value;
        });
        if (copyAll) copyAll.disabled = !algorithms.every((algorithm) => hashValues[algorithm.id]);
        if (hashHint) hashHint.textContent = "SHA-1 仅用于兼容性校验，安全场景请使用 SHA-256 或更强摘要。";
        setStatus("摘要就绪", "valid");
        compareHashes();
      } catch (error) {
        if (token !== hashToken) return;
        setStatus("计算失败", "error");
        if (hashHint) hashHint.textContent = "读取文件失败，请重新选择。";
      }
    }

    function readAsDataURL(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(reader.error || new Error("read-failed"));
        reader.readAsDataURL(file);
      });
    }

    async function encodeFile() {
      if (!currentFile) return;
      const token = ++base64Token;
      const file = currentFile;
      setStatus("编码中…", "busy");
      try {
        const dataUrl = await readAsDataURL(file);
        if (token !== base64Token || file !== currentFile) return;
        base64Value = dataUrl.slice(dataUrl.indexOf(",") + 1);
        if (base64Output) base64Output.value = base64Value;
        if (encodeSize) {
          encodeSize.textContent = `${formatBytes(new Blob([base64Value]).size)} Base64`;
        }
        if (copyBase64) copyBase64.disabled = !base64Value;
        if (downloadBase64) downloadBase64.disabled = !base64Value;
        setStatus("Base64 就绪", "valid");
      } catch (error) {
        if (token !== base64Token) return;
        setStatus("编码失败", "error");
        toast("读取文件失败，请重试", { type: "error" });
      }
    }

    /*
      Data URL → Base64 文本。既接受 data:image/...;base64,xxx，
      也接受裸 Base64；解码前去掉空白，避免粘贴换行破坏字节长度。
    */
    function parseBase64(raw) {
      const trimmed = String(raw || "").trim();
      if (!trimmed) throw new Error("empty");
      let mime = "application/octet-stream";
      let payload = trimmed;
      const dataMatch = trimmed.match(/^data:([^;,]+)?(?:;[^,]*)?;base64,([\s\S]*)$/i);
      if (dataMatch) {
        mime = dataMatch[1] || mime;
        payload = dataMatch[2];
      }
      payload = payload.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
      if (!payload) throw new Error("empty");
      payload += "=".repeat((4 - (payload.length % 4)) % 4);
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(payload)) throw new Error("invalid");
      const binary = atob(payload);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      if (!bytes.length) throw new Error("empty");
      return { bytes, mime };
    }

    function decodeBase64() {
      if (decodeError) decodeError.hidden = true;
      if (decodeInfo) decodeInfo.textContent = "";
      if (decodeSave) decodeSave.disabled = true;
      decoded = null;
      const raw = decodeInput?.value || "";
      if (!raw.trim()) {
        if (decodeError) {
          decodeError.textContent = "先粘贴 Base64 或 Data URL。";
          decodeError.hidden = false;
        }
        return;
      }
      try {
        const { bytes, mime } = parseBase64(raw);
        const extension = extensions[mime] || "bin";
        const blob = new Blob([bytes], { type: mime });
        const name = `lumen-decoded.${extension}`;
        decoded = { blob, name, mime, bytes };
        if (decodeInfo) {
          decodeInfo.textContent = `${name} · ${formatBytes(bytes.length)} · ${mime}`;
        }
        if (decodeSave) decodeSave.disabled = false;
        setStatus("可下载", "valid");
      } catch (error) {
        if (decodeError) {
          decodeError.textContent =
            error.message === "empty"
              ? "Base64 内容为空。"
              : "Base64 格式不完整，请检查内容是否被截断。";
          decodeError.hidden = false;
        }
        setStatus("解析失败", "error");
      }
    }

    buildHashRows();
    if (decodeInput) decodeInput.maxLength = 40000000;
    if (base64Output) base64Output.maxLength = 40000000;

    choose?.addEventListener("click", (event) => {
      event.stopPropagation();
      openPicker();
    });
    change?.addEventListener("click", openPicker);
    remove?.addEventListener("click", resetFile);
    input.addEventListener("change", () => {
      selectFile(input.files?.[0]);
    });

    drop.addEventListener("click", (event) => {
      if (event.target.closest("#filekitChoose")) return;
      openPicker();
    });
    drop.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openPicker();
      }
    });
    ["dragenter", "dragover"].forEach((type) => {
      drop.addEventListener(type, (event) => {
        event.preventDefault();
        drop.classList.add("is-dragging");
      });
    });
    ["dragleave", "drop"].forEach((type) => {
      drop.addEventListener(type, (event) => {
        event.preventDefault();
        if (type === "dragleave" && event.relatedTarget && drop.contains(event.relatedTarget)) return;
        drop.classList.remove("is-dragging");
      });
    });
    drop.addEventListener("drop", (event) => {
      const file = event.dataTransfer?.files?.[0];
      if (file) selectFile(file);
    });

    modeGroup.addEventListener("click", (event) => {
      const button = event.target.closest("[data-filekit-mode]");
      if (!button) return;
      mode = button.dataset.filekitMode;
      syncMode();
    });

    copyAll?.addEventListener("click", () => {
      if (!hashValues) return;
      const text = algorithms
        .map((algorithm) => `${algorithm.id}: ${hashValues[algorithm.id]}`)
        .join("\n");
      copyText(text, "所有文件摘要已复制");
    });
    compareButton?.addEventListener("click", compareHashes);
    expectedHash?.addEventListener("input", compareHashes);
    copyBase64?.addEventListener("click", () => {
      if (!base64Value) return toast("还没有 Base64 结果", { type: "info" });
      copyText(base64Value, "Base64 已复制");
    });
    downloadBase64?.addEventListener("click", () => {
      if (!base64Value || !currentFile) return;
      downloadText(base64Value, `${safeName(currentFile.name)}.base64.txt`);
      toast("Base64 文本已下载");
    });
    decodeButton?.addEventListener("click", decodeBase64);
    decodeSave?.addEventListener("click", () => {
      if (!decoded) return;
      downloadBlob(decoded.blob, decoded.name);
      toast("还原文件已下载");
    });
    decodeInput?.addEventListener("input", () => {
      clearDecoded();
      setStatus("等待解析", "idle");
    });
    decodeInput?.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        decodeBase64();
      }
    });

    syncMode();
    return () => {
      clearPreview();
      hashToken += 1;
      base64Token += 1;
    };
  }
