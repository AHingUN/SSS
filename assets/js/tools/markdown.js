/* ==========================================================================
   Markdown preview
   ChengYu · Lumen Toolkit
   ========================================================================== */
"use strict";

  /* ----------------------------------------------------------------------
     Markdown preview
     ---------------------------------------------------------------------- */
  function initMarkdownTool() {
    const input = $("#mdInput");
    const preview = $("#mdPreview");
    const count = $("#mdCount");
    if (!input || !preview) return null;

    input.maxLength = 120000;
    const initialValue = input.value;
    const safeUrl = (value) => {
      try {
        const url = new URL(value);
        return /^https?:$/.test(url.protocol) ? url.href : null;
      } catch (error) {
        return null;
      }
    };

    const inlinePattern =
      /(\u0060[^\u0060\n]+\u0060|\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\n]+_|\[[^\]\n]+\]\(https?:\/\/[^)\s]+\))/g;

    function appendInline(target, text) {
      const fragment = document.createDocumentFragment();
      let cursor = 0;
      let match;
      inlinePattern.lastIndex = 0;

      while ((match = inlinePattern.exec(text)) !== null) {
        if (match.index > cursor) {
          fragment.appendChild(document.createTextNode(text.slice(cursor, match.index)));
        }
        const token = match[0];
        if (token.startsWith("\u0060")) {
          const code = document.createElement("code");
          code.textContent = token.slice(1, -1);
          fragment.appendChild(code);
        } else if (token.startsWith("**") || token.startsWith("__")) {
          const strong = document.createElement("strong");
          strong.textContent = token.slice(2, -2);
          fragment.appendChild(strong);
        } else if (token.startsWith("*") || token.startsWith("_")) {
          const em = document.createElement("em");
          em.textContent = token.slice(1, -1);
          fragment.appendChild(em);
        } else {
          const linkMatch = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
          const href = linkMatch ? safeUrl(linkMatch[2]) : null;
          if (linkMatch && href) {
            const link = document.createElement("a");
            link.href = href;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = linkMatch[1];
            fragment.appendChild(link);
          } else {
            fragment.appendChild(document.createTextNode(token));
          }
        }
        cursor = match.index + token.length;
      }

      if (cursor < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(cursor)));
      }
      target.appendChild(fragment);
    }

    function isBlockStart(line) {
      return (
        /^(#{1,6})\s+/.test(line) ||
        /^\s*\u0060\u0060\u0060/.test(line) ||
        /^\s*>/.test(line) ||
        /^\s*[-*+]\s+/.test(line) ||
        /^\s*\d+\.\s+/.test(line) ||
        /^(?:---|\*\*\*|___)\s*$/.test(line)
      );
    }

    function renderMarkdown() {
      const source = input.value;
      if (count) count.textContent = `${source.length} 字符`;
      if (!source.trim()) {
        const empty = document.createElement("p");
        empty.className = "md-empty";
        empty.textContent = "在左侧写点什么，这里会实时变成排版后的页面。";
        preview.replaceChildren(empty);
        return;
      }

      const lines = source.replace(/\r\n?/g, "\n").split("\n");
      const fragment = document.createDocumentFragment();
      let index = 0;

      while (index < lines.length) {
        const line = lines[index];
        if (!line.trim()) {
          index += 1;
          continue;
        }

        const fence = line.match(/^\s*\u0060\u0060\u0060\s*([\w+-]*)\s*$/);
        if (fence) {
          index += 1;
          const codeLines = [];
          while (index < lines.length && !/^\s*\u0060\u0060\u0060\s*$/.test(lines[index])) {
            codeLines.push(lines[index]);
            index += 1;
          }
          if (index < lines.length) index += 1;
          const pre = document.createElement("pre");
          pre.className = "md-code";
          if (fence[1]) pre.dataset.language = fence[1].toLowerCase();
          const code = document.createElement("code");
          code.textContent = codeLines.join("\n");
          pre.appendChild(code);
          fragment.appendChild(pre);
          continue;
        }

        const heading = line.match(/^(#{1,6})\s+(.*)$/);
        if (heading) {
          const level = Math.min(heading[1].length, 6);
          const node = document.createElement(`h${level}`);
          appendInline(node, heading[2].trim());
          fragment.appendChild(node);
          index += 1;
          continue;
        }

        if (/^(?:---|\*\*\*|___)\s*$/.test(line)) {
          fragment.appendChild(document.createElement("hr"));
          index += 1;
          continue;
        }

        if (/^>\s?/.test(line)) {
          const quoteLines = [];
          while (index < lines.length && /^>\s?/.test(lines[index])) {
            quoteLines.push(lines[index].replace(/^>\s?/, ""));
            index += 1;
          }
          const quote = document.createElement("blockquote");
          const paragraph = document.createElement("p");
          appendInline(paragraph, quoteLines.join(" "));
          quote.appendChild(paragraph);
          fragment.appendChild(quote);
          continue;
        }

        if (/^\s*[-*+]\s+/.test(line)) {
          const list = document.createElement("ul");
          while (index < lines.length && /^\s*[-*+]\s+/.test(lines[index])) {
            const item = document.createElement("li");
            appendInline(item, lines[index].replace(/^\s*[-*+]\s+/, ""));
            list.appendChild(item);
            index += 1;
          }
          fragment.appendChild(list);
          continue;
        }

        if (/^\s*\d+\.\s+/.test(line)) {
          const list = document.createElement("ol");
          while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
            const item = document.createElement("li");
            appendInline(item, lines[index].replace(/^\s*\d+\.\s+/, ""));
            list.appendChild(item);
            index += 1;
          }
          fragment.appendChild(list);
          continue;
        }

        const paragraphLines = [line.trim()];
        index += 1;
        while (index < lines.length && lines[index].trim() && !isBlockStart(lines[index])) {
          paragraphLines.push(lines[index].trim());
          index += 1;
        }
        const paragraph = document.createElement("p");
        appendInline(paragraph, paragraphLines.join(" "));
        fragment.appendChild(paragraph);
      }

      preview.replaceChildren(fragment);
    }

    const scheduledRender = debounce(renderMarkdown, 100);
    input.addEventListener("input", () => {
      if (count) count.textContent = `${input.value.length} 字符`;
      scheduledRender();
    });

    $("#mdSample")?.addEventListener("click", () => {
      input.value = initialValue;
      scheduledRender.cancel();
      renderMarkdown();
      input.focus();
    });
    $("#mdClear")?.addEventListener("click", () => {
      scheduledRender.cancel();
      input.value = "";
      renderMarkdown();
      input.focus();
    });
    $("#mdCopy")?.addEventListener("click", () => {
      if (!input.value) {
        toast("还没有可复制的 Markdown", { type: "info" });
        return;
      }
      copyText(input.value, "Markdown 已复制");
    });
    $("#mdCopyHtml")?.addEventListener("click", () => {
      if (!input.value.trim()) {
        toast("还没有可复制的 HTML", { type: "info" });
        return;
      }
      copyText(preview.innerHTML, "渲染后的 HTML 已复制");
    });
    $("#mdDownloadHtml")?.addEventListener("click", () => {
      if (!input.value.trim()) {
        toast("还没有可导出的 HTML", { type: "info" });
        return;
      }
      const title = (input.value.match(/^#\s+(.+)$/m)?.[1] || "程宇导出").trim();
      const html = `<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title.replace(/[<>&"]/g, "")}</title>
<style>body{max-width:760px;margin:48px auto;padding:0 22px;color:#24222b;background:#faf8f3;font:16px/1.75 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif}h1,h2,h3{line-height:1.25;letter-spacing:-.03em}a{color:#5b52c9}code{background:#eeeaf8;padding:.12em .35em;border-radius:5px}pre{overflow:auto;padding:16px;border-radius:12px;background:#1b1a24;color:#f7f4ff}pre code{background:none;padding:0;color:inherit}blockquote{margin-left:0;padding-left:16px;border-left:3px solid #d8d1ea;color:#666}img{max-width:100%}</style></head>
<body>${preview.innerHTML}</body></html>`;
      downloadText(html, "lumen-markdown.html", "text/html;charset=utf-8");
      toast("HTML 已导出");
    });
    $("#mdDownload")?.addEventListener("click", () => {
      if (!input.value.trim()) {
        toast("还没有可导出的 Markdown", { type: "info" });
        return;
      }
      downloadText(input.value, "lumen-markdown.md", "text/markdown;charset=utf-8");
      toast("Markdown 已导出");
    });

    renderMarkdown();
    return () => scheduledRender.cancel();
  }

