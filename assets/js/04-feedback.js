/* ==========================================================================
   Toasts, clipboard and download helpers
   ChengYu · Lumen Toolkit
   ========================================================================== */
"use strict";

  /* ----------------------------------------------------------------------
     Toasts, clipboard, downloads
     ---------------------------------------------------------------------- */
  /*
    全局反馈只有三件事：
    1. Toast：最多保留 3 条，旧的自动退场，避免连续操作刷屏。
    2. 复制：优先 navigator.clipboard；file:// / 权限受限时退回 textarea +
       execCommand("copy")，并恢复原来的焦点。
    3. 下载：Blob → ObjectURL → 临时 <a download>；延时 revoke，避免
       Safari / Chromium 在点击瞬间还没完成读取。
  */
  function toast(message, { type = "success", duration = 2200 } = {}) {
    if (!toastRegion) return;
    const node = document.createElement("div");
    node.className = "toast";
    node.innerHTML =
      type === "success"
        ? icon("check")
        : icon("info");
    const text = document.createElement("span");
    text.textContent = message;
    node.appendChild(text);
    toastRegion.appendChild(node);

    while (toastRegion.children.length > 3) {
      toastRegion.firstElementChild?.remove();
    }

    window.setTimeout(() => {
      node.classList.add("is-leaving");
      window.setTimeout(() => node.remove(), 240);
    }, duration);
  }

  /*
    复制回退链：Clipboard API 失败时不要直接报错。
    用一个屏幕外的 readonly textarea 承接文本，执行 execCommand 后移除，
    再把焦点还给原元素，避免键盘用户丢失位置。
  */
  async function copyText(text, message = "已复制到剪贴板") {
    if (!text) {
      toast("还没有可复制的内容", { type: "info" });
      return false;
    }
    let copied = false;
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch (error) {
        copied = false;
      }
    }
    if (!copied) {
      const activeElement = document.activeElement;
      const helper = document.createElement("textarea");
      helper.value = text;
      helper.setAttribute("readonly", "");
      helper.style.position = "fixed";
      helper.style.top = "0";
      helper.style.left = "-9999px";
      helper.style.opacity = "0";
      helper.style.pointerEvents = "none";
      document.body.appendChild(helper);
      helper.focus();
      helper.select();
      try {
        copied = document.execCommand("copy");
      } catch (error) {
        copied = false;
      }
      helper.remove();
      if (activeElement instanceof HTMLElement) activeElement.focus({ preventScroll: true });
    }
    if (copied) {
      toast(message);
      return true;
    }
    toast("复制失败，请手动选择文本", { type: "info" });
    return false;
  }

  /*
    统一下载入口。所有图片 / 文档 / TXT / DOCX 都走这里，
    这样浏览器只需要处理一种临时链接生命周期。
  */
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function downloadText(text, filename, type = "text/plain;charset=utf-8") {
    downloadBlob(new Blob([text], { type }), filename);
  }

