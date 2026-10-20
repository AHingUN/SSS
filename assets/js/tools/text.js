/* ==========================================================================
   Text analysis · Word-like local document editor
   ChengYu · Lumen Toolkit

   This module is intentionally self-contained:
   - contenteditable document + formatting toolbar
   - live Chinese / English statistics
   - find & replace over text nodes (formatting survives)
   - local draft persistence
   - TXT / standalone HTML / real DOCX export + print
   - all work happens in the browser; no upload or network request
   ========================================================================== */
"use strict";

  /* ----------------------------------------------------------------------
     Text document
     ---------------------------------------------------------------------- */
  /*
    文档状态模型（不依赖框架）：
    - editor：contenteditable 的 A4 文档纸；
    - savedRange：工具栏操作前暂存选区，因为点击按钮会让编辑器失焦；
    - lastSnapshot：批量文本处理前的 HTML，用于“撤销处理”；
    - destroyed：路由离开后阻止迟到的 rAF / 输入回调继续写 DOM；
    - saveTimer：草稿自动保存的延时句柄。
  */
  function initTextTool() {
    const editor = $("#docEditor");
    const frequency = $("#charFrequency");
    if (!editor || !frequency) return null;

    const refs = {
      chars: $("#statChars"),
      words: $("#statWords"),
      paragraphs: $("#statParagraphs"),
      pages: $("#statPages"),
      read: $("#statRead"),
      sentences: $("#textSentences"),
      lines: $("#textLines"),
      cjk: $("#textCjk"),
      unique: $("#textUnique"),
      bytes: $("#textBytes"),
      limit: $("#textLimit"),
      title: $("#docTitleLabel"),
      saveStatus: $("#docSaveStatus"),
      findCount: $("#docFindCount"),
      find: $("#docFind"),
      replace: $("#docReplace"),
      findNext: $("#docFindNext"),
      replaceOne: $("#docReplaceOne"),
      replaceAll: $("#docReplaceAll"),
      undo: $("#textUndo"),
      copy: $("#textCopy"),
      clear: $("#textClear"),
      reset: $("#docReset"),
      styleSelect: $("#docStyle"),
      fontSelect: $("#docFont"),
      sizeSelect: $("#docSize"),
      toolbar: $(".doc-toolbar"),
    };

    const LIMIT = 200000;
    const DRAFT_KEY = "lumen.textDocument.v1";
    let destroyed = false;
    let savedRange = null;
    let lastSnapshot = "";
    let lastFound = { query: "", next: 0 };
    let saveTimer = 0;

    const SAMPLE_DOC = [
      "<h1>把日常小事，做得顺手一点</h1>",
      '<p class="doc-subtitle">一份在浏览器本地写作、分析与导出的文档</p>',
      "<h2>一、从一段文字开始</h2>",
      "<p>好的工具不必喧哗。它应该在你需要的时候出现，安静地完成工作，然后退到背景里。</p>",
      "<p>这个文本工作台把写作、排版和文本分析放在同一页里：左边写，右边看；不用上传，也不用等待网络。你可以把它当成一个轻量的本地 Word。</p>",
      "<h2>二、可以做什么</h2>",
      "<ul><li>用标题、加粗、对齐、列表和引用整理文档结构。</li>",
      "<li>实时查看字数、段落、句子、页数与阅读时间。</li>",
      "<li>查找、替换，或者对全文做一次批量处理。</li>",
      "<li>导出为 Word、纯文本、网页，或打印成 PDF。</li></ul>",
      "<blockquote>把复杂留给自己，把顺手留给使用者。</blockquote>",
      "<h2>三、写在最后</h2>",
      "<p>日常并不需要宏大的叙事。顺手的工具、恰到好处的节奏，就已经很好。愿每一次点击，都干净、轻快，刚刚好。</p>",
    ].join("");

    let segmenter = null;
    if (typeof Intl.Segmenter === "function") {
      try {
        segmenter = new Intl.Segmenter("zh-CN", { granularity: "word" });
      } catch (error) {
        segmenter = null;
      }
    }

    /* --------------------------------------------------------------------
       Text extraction and analysis
       -------------------------------------------------------------------- */
    /*
      统计统一从 `editor.innerText` 提取，不直接解析 HTML：
      - 字符数按 Unicode 码点；
      - 词语优先用 Intl.Segmenter，回退到 Unicode 正则；
      - 段落按块元素 / 列表项计数；
      - 页数按纸张高度估算，不是 Word 的真实分页。
      所有统计只读，不修改文档。
    */

    function plainText() {
      const text = typeof editor.innerText === "string" ? editor.innerText : editor.textContent || "";
      return text.replace(/\u00a0/g, " ").replace(/\r\n?/g, "\n");
    }

    function analysisText() {
      return plainText().replace(/^\n+|\n+$/g, "");
    }

    function countWords(text) {
      if (!text.trim()) return 0;
      if (segmenter) {
        let count = 0;
        for (const segment of segmenter.segment(text)) {
          if (segment.isWordLike) count += 1;
        }
        return count;
      }
      const matches = text.match(/[\p{L}\p{N}]+/gu);
      return matches ? matches.length : 0;
    }

    function escapeRegExp(value) {
      return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function countParagraphs() {
      let count = 0;
      const visit = (parent) => {
        Array.from(parent.children).forEach((child) => {
          if (child.matches("p, h1, h2, h3, h4, h5, h6, blockquote, pre, li")) {
            if (child.innerText.trim()) count += 1;
            return;
          }
          if (child.matches("ul, ol")) return;
          if (child.children.length) visit(child);
        });
      };
      visit(editor);
      return count || (analysisText().trim() ? 1 : 0);
    }

    function documentTitle() {
      const heading = editor.querySelector("h1, h2");
      const firstLine = analysisText().split("\n").find((line) => line.trim());
      const title = (heading ? heading.innerText : firstLine || "").trim();
      return title || "未命名文档";
    }

    function topCharacters(text) {
      const counts = new Map();
      Array.from(text.toLocaleLowerCase()).forEach((char) => {
        if (!/[\p{L}\p{N}]/u.test(char)) return;
        counts.set(char, (counts.get(char) || 0) + 1);
      });
      return Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);
    }

    function renderFrequency(entries) {
      frequency.innerHTML = "";
      if (!entries.length) {
        const empty = document.createElement("p");
        empty.className = "frequency-empty";
        empty.textContent = "写下一些文字，这里会出现高频字符。";
        frequency.appendChild(empty);
        return;
      }
      const max = entries[0][1] || 1;
      entries.forEach(([char, count]) => {
        const row = document.createElement("div");
        row.className = "frequency-row";
        const charNode = document.createElement("span");
        charNode.className = "frequency-char";
        charNode.textContent = char;
        const bar = document.createElement("span");
        bar.className = "frequency-bar";
        const fill = document.createElement("i");
        fill.style.width = `${Math.max(8, (count / max) * 100)}%`;
        bar.appendChild(fill);
        const countNode = document.createElement("span");
        countNode.className = "frequency-count";
        countNode.textContent = String(count);
        row.append(charNode, bar, countNode);
        frequency.appendChild(row);
      });
    }

    function analyze() {
      if (destroyed) return;
      const text = analysisText();
      const characters = Array.from(text).length;
      const words = countWords(text);
      const cjk = (text.match(/[\u3400-\u9fff\uf900-\ufaff]/g) || []).length;
      const lines = text ? text.split("\n").length : 0;
      const paragraphs = countParagraphs();
      const sentences = (text.match(/[^。！？.!?\n]+[。！？.!?]?/g) || []).filter((part) => part.trim()).length;
      const unique = new Set(Array.from(text.replace(/\s/g, ""))).size;
      const bytes = new TextEncoder().encode(text).length;
      const reading = characters ? Math.max(1, Math.ceil(Math.max(cjk / 350, words / 220))) : 0;
      const pageHeight = Math.max(620, parseFloat(getComputedStyle(editor).minHeight) || 1123);
      const overflow = Math.max(0, editor.scrollHeight - pageHeight);
      const pages = characters ? 1 + Math.ceil(Math.max(0, overflow - 24) / Math.max(600, pageHeight - 40)) : 1;

      if (refs.chars) refs.chars.textContent = String(characters);
      if (refs.words) refs.words.textContent = String(words);
      if (refs.paragraphs) refs.paragraphs.textContent = String(paragraphs);
      if (refs.pages) refs.pages.textContent = String(pages);
      if (refs.read) refs.read.textContent = String(reading);
      if (refs.sentences) refs.sentences.textContent = `${sentences} 句`;
      if (refs.lines) refs.lines.textContent = `${lines} 行`;
      if (refs.cjk) refs.cjk.textContent = `${cjk} 中文字`;
      if (refs.unique) refs.unique.textContent = `${unique} 个不同字符`;
      if (refs.bytes) refs.bytes.textContent = formatBytes(bytes);
      if (refs.limit) {
        refs.limit.textContent = `${characters} / ${LIMIT.toLocaleString("en-US")}`;
        refs.limit.style.color = characters > LIMIT * 0.9 ? "var(--text)" : "";
      }
      if (refs.title) refs.title.textContent = documentTitle();
      renderFrequency(topCharacters(text));
      refreshFindCount();
    }

    const scheduleAnalyze = debounce(analyze, 90);

    /* --------------------------------------------------------------------
       Draft persistence
       -------------------------------------------------------------------- */
    /*
      草稿保存完整的 editor.innerHTML，而不是纯文本，因此重新打开时能恢复
      标题、加粗、列表等格式。写入使用 localStorage；失败时仅提示当前页面
      可用，不阻塞编辑。
    */

    function saveStatus(message) {
      if (refs.saveStatus) refs.saveStatus.textContent = message;
    }

    function saveDraftNow() {
      if (destroyed) return;
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ html: editor.innerHTML, savedAt: Date.now() }));
        const time = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
        saveStatus(`已保存到本机 · ${time}`);
      } catch (error) {
        saveStatus("草稿仅保留在当前页面");
      }
    }

    function scheduleSave() {
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(saveDraftNow, 650);
    }

    /* --------------------------------------------------------------------
       Selection and formatting
       -------------------------------------------------------------------- */
    /*
      工具栏按钮会让 contenteditable 失焦，所以选择前先把 Range 存进
      savedRange；点击按钮时 restoreSelection() 再恢复。
      execCommand 在这里只用于浏览器原生的行内格式；现代浏览器仍支持它，
      且不需要引入额外富文本库。
    */

    function selectionInside() {
      const selection = document.getSelection();
      return Boolean(
        selection &&
        selection.rangeCount &&
        selection.anchorNode &&
        editor.contains(selection.anchorNode) &&
        editor.contains(selection.focusNode)
      );
    }

    function rememberSelection() {
      const selection = document.getSelection();
      if (selectionInside()) savedRange = selection.getRangeAt(0).cloneRange();
    }

    function placeCaretAtEnd() {
      const selection = document.getSelection();
      if (!selection) return;
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
      savedRange = range.cloneRange();
    }

    function restoreSelection() {
      editor.focus({ preventScroll: true });
      const selection = document.getSelection();
      if (!selection) return;
      if (savedRange && editor.contains(savedRange.startContainer) && editor.contains(savedRange.endContainer)) {
        selection.removeAllRanges();
        selection.addRange(savedRange);
        return;
      }
      placeCaretAtEnd();
    }

    function commandState(command) {
      try {
        return document.queryCommandState(command);
      } catch (error) {
        return false;
      }
    }

    function refreshToolbarState() {
      if (!refs.toolbar) return;
      const stateMap = {
        bold: commandState("bold"),
        italic: commandState("italic"),
        underline: commandState("underline"),
        strikeThrough: commandState("strikeThrough"),
        justifyLeft: commandState("justifyLeft"),
        justifyCenter: commandState("justifyCenter"),
        justifyRight: commandState("justifyRight"),
        justifyFull: commandState("justifyFull"),
        insertUnorderedList: commandState("insertUnorderedList"),
        insertOrderedList: commandState("insertOrderedList"),
      };
      refs.toolbar.querySelectorAll("[data-doc-command]").forEach((button) => {
        const command = button.dataset.docCommand;
        if (!(command in stateMap)) return;
        button.classList.toggle("is-active", Boolean(stateMap[command]));
        button.setAttribute("aria-pressed", stateMap[command] ? "true" : "false");
      });

      if (refs.styleSelect) {
        let block = "";
        try {
          block = String(document.queryCommandValue("formatBlock") || "").replace(/[<>]/g, "").toLowerCase();
        } catch (error) {
          block = "";
        }
        const style = ["p", "h1", "h2", "h3", "blockquote"].includes(block) ? block : "p";
        refs.styleSelect.value = style;
      }

      if (refs.fontSelect) {
        let font = "";
        try {
          font = String(document.queryCommandValue("fontName") || "").replace(/["']/g, "").split(",")[0].trim();
        } catch (error) {
          font = "";
        }
        const match = Array.from(refs.fontSelect.options).find((option) => option.value === font);
        refs.fontSelect.value = match ? match.value : "";
      }

      if (refs.sizeSelect && selectionInside()) {
        const selection = document.getSelection();
        const node = selection?.anchorNode;
        const element = node?.nodeType === 1 ? node : node?.parentElement;
        const size = element ? Math.round(parseFloat(getComputedStyle(element).fontSize)) : 0;
        const match = Array.from(refs.sizeSelect.options).find((option) => Number(option.value) === size);
        if (match) refs.sizeSelect.value = match.value;
      }
    }

    function afterContentChange({ save = true, keepUndo = false } = {}) {
      rememberSelection();
      refreshToolbarState();
      if (!keepUndo) {
        lastSnapshot = "";
        if (refs.undo) refs.undo.hidden = true;
      }
      scheduleAnalyze();
      if (save) scheduleSave();
    }

    function exec(command, value = null) {
      restoreSelection();
      document.execCommand("styleWithCSS", false, true);
      const changed = document.execCommand(command, false, value);
      afterContentChange();
      return changed;
    }

    /*
      execCommand("fontSize") 只接受 1–7 的档位，无法直接写像素。
      这里先用最大档 7 让浏览器包一层 <font>，再把这些节点替换成
      带精确 px 的 <span>；选区跨多个块时回退到 Range 包裹。
    */
    function applyFontSize(px) {
      restoreSelection();
      editor.focus({ preventScroll: true });
      document.execCommand("styleWithCSS", false, false);
      document.execCommand("fontSize", false, "7");
      const candidates = Array.from(editor.querySelectorAll('font[size="7"]'));
      candidates.forEach((font) => {
        const span = document.createElement("span");
        span.style.fontSize = `${px}px`;
        while (font.firstChild) span.appendChild(font.firstChild);
        font.replaceWith(span);
      });
      document.execCommand("styleWithCSS", false, true);
      if (!candidates.length) {
        const selection = document.getSelection();
        if (selection?.rangeCount && !selection.isCollapsed) {
          const range = selection.getRangeAt(0);
          const span = document.createElement("span");
          span.style.fontSize = `${px}px`;
          try {
            span.appendChild(range.extractContents());
            range.insertNode(span);
            selection.removeAllRanges();
            const next = document.createRange();
            next.selectNodeContents(span);
            selection.addRange(next);
          } catch (error) {
            /* A selection crossing block boundaries cannot be wrapped reliably. */
          }
        }
      }
      afterContentChange();
    }

    function insertLink() {
      restoreSelection();
      const selection = document.getSelection();
      const url = window.prompt("输入链接地址", "https://");
      if (!url || !/^(https?:\/\/|mailto:)/i.test(url.trim())) {
        if (url) toast("请输入 http(s) 或 mailto 链接", { type: "info" });
        return;
      }
      const href = url.trim();
      if (selection && !selection.isCollapsed) {
        document.execCommand("createLink", false, href);
      } else {
        document.execCommand(
          "insertHTML",
          false,
          `<a href="${escapeAttribute(href)}" target="_blank" rel="noopener noreferrer">${escapeHTML(href)}</a>`
        );
      }
      afterContentChange();
    }

    refs.toolbar?.addEventListener("mousedown", (event) => {
      if (event.target.closest("select")) {
        rememberSelection();
        return;
      }
      if (event.target.closest("button")) event.preventDefault();
    });

    refs.toolbar?.querySelectorAll("[data-doc-command]").forEach((button) => {
      button.addEventListener("click", () => {
        const command = button.dataset.docCommand;
        if (command === "undo" || command === "redo") {
          restoreSelection();
          document.execCommand(command);
          afterContentChange();
          return;
        }
        exec(command);
      });
    });

    refs.toolbar?.querySelectorAll("[data-doc-action]").forEach((button) => {
      button.addEventListener("click", () => {
        switch (button.dataset.docAction) {
          case "link":
            insertLink();
            break;
          case "clear":
            exec("removeFormat");
            break;
          case "quote": {
            restoreSelection();
            let current = "";
            try {
              current = String(document.queryCommandValue("formatBlock") || "").replace(/[<>]/g, "").toLowerCase();
            } catch (error) {
              current = "";
            }
            exec("formatBlock", current === "blockquote" ? "<p>" : "<blockquote>");
            break;
          }
          default:
            break;
        }
      });
    });

    refs.styleSelect?.addEventListener("change", () => {
      restoreSelection();
      const value = refs.styleSelect.value;
      if (value === "blockquote") {
        document.execCommand("formatBlock", false, "<blockquote>");
      } else {
        document.execCommand("formatBlock", false, `<${value}>`);
      }
      afterContentChange();
    });

    refs.fontSelect?.addEventListener("change", () => {
      restoreSelection();
      document.execCommand("fontName", false, refs.fontSelect.value || "SimSun");
      afterContentChange();
    });

    refs.sizeSelect?.addEventListener("change", () => {
      applyFontSize(Number(refs.sizeSelect.value) || 15);
    });

    function onSelectionChange() {
      if (selectionInside()) {
        rememberSelection();
        refreshToolbarState();
      }
    }

    document.addEventListener("selectionchange", onSelectionChange);

    /* --------------------------------------------------------------------
       Editing events
       -------------------------------------------------------------------- */
    /*
      编辑事件只做三件事：
      1. 输入后重算统计；
      2. 同步草稿保存；
      3. 处理粘贴 / 输入上限 / 快捷键。
      粘贴统一转纯文本，避免把外部网页的复杂 HTML 或脚本带进文档。
    */

    editor.addEventListener("input", () => {
      lastSnapshot = "";
      if (refs.undo) refs.undo.hidden = true;
      scheduleAnalyze();
      scheduleSave();
    });

    editor.addEventListener("beforeinput", (event) => {
      if (!event.inputType.startsWith("insert") || !event.data) return;
      if (analysisText().length >= LIMIT) {
        event.preventDefault();
        toast("文档已达到 200,000 字符上限", { type: "info" });
      }
    });

    editor.addEventListener("paste", (event) => {
      const clipboard = event.clipboardData;
      if (!clipboard) return;
      const text = clipboard.getData("text/plain");
      if (typeof text !== "string" || !text) return;
      event.preventDefault();
      const remaining = Math.max(0, LIMIT - analysisText().length);
      if (!remaining) {
        toast("文档已达到 200,000 字符上限", { type: "info" });
        return;
      }
      const clipped = text.slice(0, remaining);
      document.execCommand("insertText", false, clipped);
      if (clipped.length < text.length) toast("超过上限的部分未粘贴", { type: "info" });
    });

    editor.addEventListener("drop", (event) => {
      if (event.dataTransfer?.files?.length) {
        event.preventDefault();
        toast("文档编辑器只接收文字内容", { type: "info" });
      }
    });

    editor.addEventListener("keydown", (event) => {
      if (event.key === "Tab") {
        event.preventDefault();
        document.execCommand("insertText", false, "  ");
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveDraftNow();
        toast("草稿已保存到本机");
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        refs.find?.focus();
        refs.find?.select();
      }
    });

    refs.find?.addEventListener("input", refreshFindCount);
    refs.find?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        findNext();
      }
    });
    refs.replace?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        replaceCurrent();
      }
    });

    /* --------------------------------------------------------------------
       Find and replace
       -------------------------------------------------------------------- */
    /*
      查找不是在 HTML 字符串上做 replace，而是：
      1. 遍历编辑器内的文本节点，拼成完整字符串与偏移表；
      2. 在完整字符串上定位；
      3. 把起点 / 终点映射回 Range；
      4. 替换时只改文本节点，保留已有的加粗 / 斜体等结构。
      匹配大小写不敏感；替换字符串按字面量插入，不解释 `$&`。
    */

    /*
      把编辑器内的文本节点展开成一条连续的字符串，同时记录每个节点
      在整串中的 start / end。查找和替换都依赖这张映射，避免直接操作
      innerHTML 时破坏行内格式。
    */
    function textNodeMap() {
      const nodes = [];
      let text = "";
      const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent || parent.closest("script, style, [contenteditable='false']")) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      let node;
      while ((node = walker.nextNode())) {
        const value = node.nodeValue || "";
        if (!value) continue;
        nodes.push({ node, start: text.length, end: text.length + value.length });
        text += value;
      }
      return { nodes, text };
    }

    function rangeForOffsets(start, end) {
      const { nodes } = textNodeMap();
      let startNode = null;
      let startOffset = 0;
      let endNode = null;
      let endOffset = 0;
      nodes.forEach((item) => {
        if (start >= item.start && start <= item.end) {
          startNode = item.node;
          startOffset = start - item.start;
        }
        if (end >= item.start && end <= item.end) {
          endNode = item.node;
          endOffset = end - item.start;
        }
      });
      if (!startNode || !endNode) return null;
      const range = document.createRange();
      range.setStart(startNode, startOffset);
      range.setEnd(endNode, endOffset);
      return range;
    }

    function selectionOffset() {
      const selection = document.getSelection();
      if (!selectionInside() || !selection.rangeCount) return 0;
      const range = selection.getRangeAt(0).cloneRange();
      range.collapse(false);
      const pre = document.createRange();
      pre.selectNodeContents(editor);
      pre.setEnd(range.endContainer, range.endOffset);
      return pre.toString().length;
    }

    function selectRange(range, { scroll = true } = {}) {
      const selection = document.getSelection();
      if (!selection) return;
      selection.removeAllRanges();
      selection.addRange(range);
      savedRange = range.cloneRange();
      if (scroll) {
        const rect = range.getBoundingClientRect();
        if (rect.top < editor.getBoundingClientRect().top + 20 || rect.bottom > editor.getBoundingClientRect().bottom - 20) {
          editor.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
      }
    }

    function refreshFindCount() {
      if (!refs.findCount) return;
      const query = refs.find?.value || "";
      if (!query) {
        refs.findCount.textContent = "0 处";
        return;
      }
      const { text } = textNodeMap();
      const haystack = text.toLocaleLowerCase();
      const needle = query.toLocaleLowerCase();
      let count = 0;
      let from = 0;
      while (needle && (from = haystack.indexOf(needle, from)) !== -1) {
        count += 1;
        from += needle.length;
      }
      refs.findCount.textContent = `${count} 处`;
    }

    function findNext() {
      const query = refs.find?.value || "";
      if (!query) {
        toast("先输入要查找的文字", { type: "info" });
        return false;
      }
      const { text } = textNodeMap();
      const haystack = text.toLocaleLowerCase();
      const needle = query.toLocaleLowerCase();
      let start = lastFound.query === query ? lastFound.next : 0;
      if (lastFound.query !== query && selectionInside()) start = selectionOffset();
      let index = haystack.indexOf(needle, start);
      if (index === -1 && start > 0) {
        index = haystack.indexOf(needle);
        if (index !== -1) toast("已从文档开头继续查找", { type: "info" });
      }
      if (index === -1) {
        toast("没有找到匹配文字", { type: "info" });
        return false;
      }
      const range = rangeForOffsets(index, index + query.length);
      if (!range) return false;
      lastFound = { query, next: index + query.length };
      selectRange(range);
      return true;
    }

    function replaceCurrent() {
      const query = refs.find?.value || "";
      const replacement = refs.replace?.value || "";
      if (!query) {
        toast("先输入要查找的文字", { type: "info" });
        return;
      }
      const selection = document.getSelection();
      if (selectionInside() && selection && !selection.isCollapsed) {
        const selected = selection.toString();
        if (selected.toLocaleLowerCase() === query.toLocaleLowerCase()) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          range.insertNode(document.createTextNode(replacement));
          selection.removeAllRanges();
          const caret = document.createRange();
          caret.setStart(range.endContainer, range.endOffset);
          caret.collapse(true);
          selection.addRange(caret);
          lastFound = { query, next: 0 };
          afterContentChange();
          toast("已替换 1 处");
          return;
        }
      }
      if (findNext()) toast("已定位，再次点击替换", { type: "info" });
    }

    /*
      全部替换只在一个文本节点内部做字符串替换，不重新序列化整个文档。
      replacement 用函数返回，确保 `$&` / `$1` 等不会被当成 replace 语法。
    */
    function replaceAll() {
      const query = refs.find?.value || "";
      const replacement = refs.replace?.value || "";
      if (!query) {
        toast("先输入要查找的文字", { type: "info" });
        return;
      }
      const { nodes } = textNodeMap();
      const pattern = new RegExp(escapeRegExp(query), "gi");
      let count = 0;
      nodes.forEach((item) => {
        const value = item.node.nodeValue || "";
        if (!pattern.test(value)) {
          pattern.lastIndex = 0;
          return;
        }
        pattern.lastIndex = 0;
        const matches = value.match(pattern);
        count += matches ? matches.length : 0;
        item.node.nodeValue = value.replace(pattern, () => replacement);
      });
      if (!count) {
        toast("没有找到匹配文字", { type: "info" });
        return;
      }
      lastFound = { query: "", next: 0 };
      afterContentChange();
      toast(`已替换 ${count} 处`);
    }

    refs.findNext?.addEventListener("click", findNext);
    refs.replaceOne?.addEventListener("click", replaceCurrent);
    refs.replaceAll?.addEventListener("click", replaceAll);

    /* --------------------------------------------------------------------
       Plain text helpers and batch transforms
       -------------------------------------------------------------------- */
    /*
      批量处理针对全文纯文本执行。只要发生处理，就把当前 HTML 存进
      lastSnapshot，用户可以通过“撤销处理”恢复；这是破坏性较小的设计：
      批量格式转换（大小写 / slug / 排序）本身会重排段落。
    */

    function setPlainText(text) {
      const normalized = String(text).replace(/\r\n?/g, "\n");
      if (!normalized.trim()) {
        editor.innerHTML = "";
        return;
      }
      editor.innerHTML = normalized
        .split(/\n{2,}/)
        .map((block) => `<p>${escapeHTML(block).replace(/\n/g, "<br>")}</p>`)
        .join("");
    }

    function setUndoAvailable(available) {
      if (refs.undo) refs.undo.hidden = !available;
    }

    function transform(kind) {
      const value = analysisText();
      const previous = value;
      const words = (source) =>
        source
          .replace(/([\p{Ll}\d])(\p{Lu})/gu, "$1 $2")
          .replace(/(\p{Lu}+)(\p{Lu}\p{Ll})/gu, "$1 $2")
          .split(/[^\p{L}\p{N}]+/u)
          .filter(Boolean)
          .map((word) => word.toLocaleLowerCase());
      const capitalize = (word) => word.charAt(0).toLocaleUpperCase() + word.slice(1);
      const joinCase = (style) => {
        const parts = words(value);
        if (!parts.length) return "";
        if (style === "camel") return parts.map((word, index) => (index ? capitalize(word) : word)).join("");
        if (style === "pascal") return parts.map(capitalize).join("");
        if (style === "snake") return parts.join("_");
        if (style === "kebab") return parts.join("-");
        return parts.map((word) => word.toLocaleUpperCase()).join("_");
      };
      let output;
      switch (kind) {
        case "upper": output = value.toLocaleUpperCase(); break;
        case "lower": output = value.toLocaleLowerCase(); break;
        case "trim":
          output = value.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
          break;
        case "strip": output = value.replace(/\s*\n+\s*/g, " ").trim(); break;
        case "reverse": output = Array.from(value).reverse().join(""); break;
        case "title":
          output = value.toLocaleLowerCase().replace(/(^|[\s\-_/(])(\p{L})/gu, (match, prefix, letter) => `${prefix}${letter.toLocaleUpperCase()}`);
          break;
        case "sort": output = value.split(/\r?\n/).sort((a, b) => a.localeCompare(b, "zh-CN")).join("\n"); break;
        case "dedupe": {
          const seen = new Set();
          output = value.split(/\r?\n/).filter((line) => {
            const key = line.trim();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          }).join("\n");
          break;
        }
        case "number": output = value.split(/\r?\n/).map((line, index) => `${index + 1}. ${line}`).join("\n"); break;
        case "empty": output = value.split(/\r?\n/).filter((line) => line.trim()).join("\n"); break;
        case "slug":
          output = value
            .toLocaleLowerCase()
            .normalize("NFKD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^\p{L}\p{N}]+/gu, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 120);
          break;
        case "sentence":
          output = value.toLocaleLowerCase().replace(/(^\s*|[.!?。！？]\s+)(\p{L})/gu, (match, prefix, letter) => `${prefix}${letter.toLocaleUpperCase()}`);
          break;
        case "camel":
        case "pascal":
        case "snake":
        case "kebab":
        case "constant":
          output = joinCase(kind);
          break;
        case "emails": {
          const found = [...new Set(value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])];
          if (!found.length) { toast("没有找到邮箱地址", { type: "info" }); return; }
          output = found.join("\n");
          break;
        }
        case "urls": {
          const found = [...new Set(value.match(/https?:\/\/[^\s<>"'`]+|www\.[^\s<>"'`]+/gi) || [])];
          if (!found.length) { toast("没有找到链接", { type: "info" }); return; }
          output = found.join("\n");
          break;
        }
        case "numbers": {
          const found = value.match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) || [];
          if (!found.length) { toast("没有找到数字", { type: "info" }); return; }
          output = found.join("\n");
          break;
        }
        default:
          return;
      }
      if (output === previous) {
        toast("文本没有可处理的变化", { type: "info" });
        return;
      }
      lastSnapshot = editor.innerHTML;
      setPlainText(output);
      setUndoAvailable(true);
      afterContentChange({ keepUndo: true });
      toast("已处理全文", { type: "info" });
    }

    $$("[data-transform]").forEach((button) => {
      button.addEventListener("click", () => transform(button.dataset.transform));
    });

    refs.undo?.addEventListener("click", () => {
      if (!lastSnapshot) return;
      editor.innerHTML = lastSnapshot;
      lastSnapshot = "";
      setUndoAvailable(false);
      afterContentChange();
      toast("已撤销上一次处理");
    });

    refs.copy?.addEventListener("click", () => {
      const text = plainText().replace(/\n+$/g, "");
      if (!text.trim()) {
        toast("还没有可复制的文字", { type: "info" });
        return;
      }
      copyText(text, "文档全文已复制");
    });

    refs.clear?.addEventListener("click", () => {
      if (analysisText().trim() && !window.confirm("清空当前文档？此操作会同时清除本地草稿。")) return;
      editor.innerHTML = "";
      lastSnapshot = "";
      setUndoAvailable(false);
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch (error) {
        /* Storage can be unavailable under strict file:// policies. */
      }
      afterContentChange();
      editor.focus();
      toast("文档已清空");
    });

    refs.reset?.addEventListener("click", () => {
      if (analysisText().trim() && !window.confirm("恢复示例会覆盖当前文档，继续吗？")) return;
      editor.innerHTML = SAMPLE_DOC;
      lastSnapshot = "";
      setUndoAvailable(false);
      afterContentChange();
      saveDraftNow();
      toast("已恢复示例文档");
    });

    /* --------------------------------------------------------------------
       HTML and text export helpers
       -------------------------------------------------------------------- */
    /*
      导出 HTML 前先清理编辑器内容：
      - 移除 script / style / iframe / 表单控件等非正文元素；
      - 移除 on* 事件属性；
      - 移除 javascript: 链接。
      导出的 HTML 使用独立内联样式，因此不依赖本项目的 CSS 文件。
    */

    function safeFilename(title) {
      return String(title || "未命名文档")
        .replace(/[\\/:*?"<>|]+/g, "-")
        .replace(/[\s.]+$/g, "")
        .slice(0, 42) || "未命名文档";
    }

    function exportBaseName() {
      const now = new Date();
      const stamp = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0"),
      ].join("");
      return `${safeFilename(documentTitle())}-${stamp}`;
    }

    function sanitizedContentHtml() {
      const template = document.createElement("template");
      template.innerHTML = editor.innerHTML;
      template.content
        .querySelectorAll("script, style, iframe, object, embed, link, meta, form, input, button, textarea, select, option, video, audio")
        .forEach((node) => node.remove());
      template.content.querySelectorAll("*").forEach((element) => {
        Array.from(element.attributes).forEach((attribute) => {
          if (/^on/i.test(attribute.name)) element.removeAttribute(attribute.name);
          if (attribute.name === "href" && /^\s*javascript:/i.test(attribute.value)) {
            element.removeAttribute("href");
          }
        });
      });
      return template.innerHTML;
    }

    /*
      生成独立 HTML：屏幕样式与打印样式共用同一套内联 CSS。
      print=true 时去掉纸张阴影、圆角和外层背景，让浏览器按 A4 正常分页。
    */
    function standaloneHtml({ print = false } = {}) {
      const title = documentTitle();
      const body = sanitizedContentHtml();
      return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHTML(title)}</title>
<style>
  @page { size: A4; margin: 20mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: ${print ? "#fff" : "#ececf1"}; color: #22232a; }
  body { padding: ${print ? "0" : "30px 18px"}; }
  .paper {
    width: min(100%, 760px);
    min-height: ${print ? "auto" : "980px"};
    margin: 0 auto;
    padding: ${print ? "0" : "62px 68px 76px"};
    border-radius: ${print ? "0" : "16px"};
    background: #fff;
    box-shadow: ${print ? "none" : "0 22px 50px -28px rgba(40,34,62,.35)"};
    font-family: "Songti SC", "Noto Serif SC", "Source Han Serif SC", "SimSun", Georgia, serif;
    font-size: 15px;
    line-height: 1.9;
    overflow-wrap: anywhere;
  }
  h1, h2, h3, h4 { margin: .6em 0 .4em; color: #1b1c22; font-weight: 650; letter-spacing: -.03em; line-height: 1.28; }
  h1 { margin-top: 0; font-size: 31px; }
  h2 { margin-top: 1.25em; font-size: 22px; }
  h3 { margin-top: 1.1em; font-size: 17px; }
  p { margin: 0 0 .85em; }
  .doc-subtitle { margin-bottom: 1.5em; color: #777984; font-family: "PingFang SC", "Microsoft YaHei", sans-serif; font-size: 12px; }
  ul, ol { margin: .7em 0 1.05em; padding-left: 1.4em; }
  li { margin: .3em 0; }
  blockquote { margin: 1.1em 0; padding: 12px 18px; border-radius: 12px; background: #f4f3f7; color: #4e4f58; }
  a { color: #375b91; text-underline-offset: 2px; }
  hr { height: 1px; margin: 1.7em 0; border: 0; background: #e3e2e8; }
  code { padding: 1px 5px; border-radius: 5px; background: #f0eff4; font-family: Consolas, monospace; font-size: .84em; }
  pre { overflow-x: auto; margin: 1em 0; padding: 14px 16px; border-radius: 12px; background: #f3f2f7; font-family: Consolas, monospace; font-size: 12px; line-height: 1.7; }
  pre code { padding: 0; background: transparent; }
  table { width: 100%; margin: 1em 0; border-collapse: collapse; font-size: 13px; }
  th, td { padding: 8px 10px; border: 1px solid #e6e5eb; text-align: left; }
  th { background: #f6f5f8; }
  @media (max-width: 640px) { .paper { padding: ${print ? "0" : "34px 24px 46px"}; font-size: 14.5px; } h1 { font-size: 26px; } h2 { font-size: 19px; } }
</style>
</head>
<body><main class="paper">${body}</main></body>
</html>`;
    }

    /* --------------------------------------------------------------------
       DOCX writer
       -------------------------------------------------------------------- */
    /*
      手写最小 OOXML 文档：
        [Content_Types].xml
        _rels/.rels
        word/document.xml
        word/styles.xml
        word/_rels/document.xml.rels
      文本区块按 p / h1-h6 / blockquote / pre / ul / ol 拆分；
      行内格式转换成 w:rPr；ZIP 使用 store（不压缩）以保证兼容性和速度。
      不使用任何外部 DOCX 库。
    */

    function xmlEscape(value) {
      return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
    }

    /*
      通过 computedStyle 读取文本的真实字体 / 字号 / 行内样式，
      转换成 WordprocessingML 的 run properties。这样工具栏的加粗、
      字体和字号能进入 DOCX，而不是只导出纯文本。
    */
    function runStyleFor(node) {
      const element = node.nodeType === 1 ? node : node.parentElement;
      if (!element) return {};
      const computed = getComputedStyle(element);
      const family = computed.fontFamily
        .split(",")[0]
        .replace(/["']/g, "")
        .replace(/\s+/g, " ")
        .trim();
      const size = Math.round(parseFloat(computed.fontSize) * 2);
      return {
        bold: parseInt(computed.fontWeight, 10) >= 600 || Boolean(element.closest("b, strong")),
        italic: computed.fontStyle === "italic" || Boolean(element.closest("em, i")),
        underline: computed.textDecorationLine.includes("underline") || Boolean(element.closest("u")),
        strike: computed.textDecorationLine.includes("line-through") || Boolean(element.closest("s, strike, del")),
        code: Boolean(element.closest("code, pre")),
        font: family || "SimSun",
        eastAsia: family || "SimSun",
        size: Number.isFinite(size) && size > 0 ? size : 24,
        align: computed.textAlign,
      };
    }

    function runXml(text, style) {
      const props = [];
      if (style.bold) props.push("<w:b/>");
      if (style.italic) props.push("<w:i/>");
      if (style.underline) props.push('<w:u w:val="single"/>');
      if (style.strike) props.push("<w:strike/>");
      if (style.code) {
        props.push('<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:eastAsia="Consolas"/>');
      } else if (style.font) {
        props.push(
          `<w:rFonts w:ascii="${xmlEscape(style.font)}" w:hAnsi="${xmlEscape(style.font)}" w:eastAsia="${xmlEscape(style.eastAsia)}"/>`
        );
      }
      if (style.size) props.push(`<w:sz w:val="${style.size}"/><w:szCs w:val="${style.size}"/>`);
      const rPr = props.length ? `<w:rPr>${props.join("")}</w:rPr>` : "";
      const pieces = String(text).split("\n");
      const runs = pieces.map((piece, index) => {
        const breakTag = index > 0 ? "<w:br/>" : "";
        return `${breakTag}<w:t xml:space="preserve">${xmlEscape(piece)}</w:t>`;
      }).join("");
      return `<w:r>${rPr}${runs}</w:r>`;
    }

    function inlineRuns(parent) {
      const runs = [];
      const visit = (node) => {
        if (node.nodeType === 3) {
          if (node.nodeValue) runs.push(runXml(node.nodeValue, runStyleFor(node)));
          return;
        }
        if (node.nodeType !== 1) return;
        if (node.tagName === "BR") {
          runs.push("<w:r><w:br/></w:r>");
          return;
        }
        if (node.tagName === "IMG") {
          const alt = node.getAttribute("alt");
          if (alt) runs.push(runXml(`[${alt}]`, runStyleFor(node)));
          return;
        }
        if (node.tagName === "A") {
          Array.from(node.childNodes).forEach(visit);
          const href = node.getAttribute("href");
          const label = node.textContent.trim();
          if (href && href !== label) runs.push(runXml(` (${href})`, runStyleFor(node)));
          return;
        }
        Array.from(node.childNodes).forEach(visit);
      };
      Array.from(parent.childNodes).forEach(visit);
      return runs;
    }

    function paragraphProperties(styleId, align, list = false) {
      const parts = [];
      if (styleId) parts.push(`<w:pStyle w:val="${styleId}"/>`);
      if (align && ["center", "right", "justify"].includes(align)) {
        parts.push(`<w:jc w:val="${align === "justify" ? "both" : align}"/>`);
      }
      if (list) parts.push('<w:ind w:left="720" w:hanging="180"/>');
      return parts.length ? `<w:pPr>${parts.join("")}</w:pPr>` : "";
    }

    function blockXml(block) {
      if (block.type === "hr") {
        return '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="D8D6DF"/></w:pBdr></w:pPr></w:p>';
      }
      const node = block.node;
      if (block.type === "text") {
        const text = node.nodeValue || "";
        if (!text.trim()) return "";
        return `<w:p>${runXml(text, runStyleFor(node))}</w:p>`;
      }
      const tag = node.tagName;
      if (tag === "UL" || tag === "OL") {
        return Array.from(node.querySelectorAll(":scope > li")).map((li, index) => {
          const marker = tag === "OL" ? `${index + 1}. ` : "• ";
          const textStyle = runStyleFor(li);
          const content = inlineRuns(li).join("");
          return `<w:p>${paragraphProperties("Normal", runStyleFor(li).align, true)}${runXml(marker, textStyle)}${content}</w:p>`;
        }).join("");
      }
      const styleMap = { H1: "Heading1", H2: "Heading2", H3: "Heading3", H4: "Heading3", H5: "Heading3", H6: "Heading3", BLOCKQUOTE: "Quote", PRE: "Code" };
      const styleId = styleMap[tag] || "Normal";
      const style = runStyleFor(node);
      const runs = inlineRuns(node).join("");
      if (!runs && !node.textContent.trim() && tag !== "P") return "";
      return `<w:p>${paragraphProperties(styleId, style.align)}${runs}</w:p>`;
    }

    /*
      把编辑器 DOM 拆成块级语义：普通段落、标题、引用、代码块、
      列表项和分隔线。DOCX 生成器只依赖这些块，不直接理解整个 DOM。
    */
    function documentBlocks() {
      const blocks = [];
      const pushNode = (node) => {
        if (node.nodeType === 3) {
          if (node.nodeValue.trim()) blocks.push({ type: "text", node });
          return;
        }
        if (node.nodeType !== 1) return;
        if (node.tagName === "UL" || node.tagName === "OL") {
          blocks.push({ type: "list", node });
          return;
        }
        if (node.tagName === "HR") {
          blocks.push({ type: "hr" });
          return;
        }
        if (node.tagName === "DIV" && node.querySelector(":scope > p, :scope > h1, :scope > h2, :scope > h3, :scope > ul, :scope > ol, :scope > blockquote, :scope > pre")) {
          Array.from(node.childNodes).forEach(pushNode);
          return;
        }
        if (["P", "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE", "PRE", "LI"].includes(node.tagName)) {
          blocks.push({ type: "block", node });
          return;
        }
        if (node.textContent.trim()) blocks.push({ type: "block", node });
      };
      Array.from(editor.childNodes).forEach(pushNode);
      return blocks.length ? blocks : [{ type: "block", node: editor }];
    }

    /*
      生成最小的 Word 文档包。styles.xml 提供 Normal / Title /
      Heading1-3 / Quote / Code 六种段落样式；document.xml 只负责
      实际内容与分页设置。复杂表格、图片、页眉页脚不在这里生成。
    */
    function buildDocx() {
      const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Microsoft YaHei"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="360" w:lineRule="auto"/></w:pPr></w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="160" w:line="360" w:lineRule="auto"/></w:pPr></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="240"/></w:pPr><w:rPr><w:b/><w:sz w:val="56"/><w:szCs w:val="56"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="320" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="44"/><w:szCs w:val="44"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="100"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="80"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:ind w:left="420" w:right="420"/></w:pPr><w:rPr><w:i/><w:color w:val="555661"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/><w:pPr><w:shd w:val="clear" w:fill="F2F1F6"/><w:spacing w:after="80" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:eastAsia="Consolas"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:style>
</w:styles>`;

      const body = documentBlocks().map(blockXml).join("");
      const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;

      const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

      const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

      const documentRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

      return { contentTypes, rootRels, documentRels, documentXml, stylesXml };
    }

    function crc32(bytes) {
      let table = crc32.table;
      if (!table) {
        table = new Uint32Array(256);
        for (let n = 0; n < 256; n += 1) {
          let c = n;
          for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
          table[n] = c >>> 0;
        }
        crc32.table = table;
      }
      let crc = 0xffffffff;
      for (let i = 0; i < bytes.length; i += 1) crc = table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
      return (crc ^ 0xffffffff) >>> 0;
    }

    /*
      ZIP writer（store，无压缩）：
      只生成 DOCX 需要的本地文件头、中央目录和 EOCD。CRC32 必须自己算，
      因为浏览器没有同步 ZIP API；Word 接受不压缩条目。
    */
    function zipStore(files) {
      const encoder = new TextEncoder();
      const now = new Date();
      const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
      const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
      const entries = files.map(({ name, data }) => {
        const nameBytes = encoder.encode(name);
        const dataBytes = typeof data === "string" ? encoder.encode(data) : data;
        return { nameBytes, dataBytes, crc: crc32(dataBytes) };
      });
      let offset = 0;
      const locals = [];
      entries.forEach((entry) => {
        const header = new Uint8Array(30 + entry.nameBytes.length);
        const view = new DataView(header.buffer);
        view.setUint32(0, 0x04034b50, true);
        view.setUint16(4, 20, true);
        view.setUint16(6, 0x0800, true);
        view.setUint16(8, 0, true);
        view.setUint16(10, dosTime, true);
        view.setUint16(12, dosDate, true);
        view.setUint32(14, entry.crc, true);
        view.setUint32(18, entry.dataBytes.length, true);
        view.setUint32(22, entry.dataBytes.length, true);
        view.setUint16(26, entry.nameBytes.length, true);
        view.setUint16(28, 0, true);
        header.set(entry.nameBytes, 30);
        entry.offset = offset;
        offset += header.length + entry.dataBytes.length;
        locals.push(header, entry.dataBytes);
      });
      const central = [];
      entries.forEach((entry) => {
        const header = new Uint8Array(46 + entry.nameBytes.length);
        const view = new DataView(header.buffer);
        view.setUint32(0, 0x02014b50, true);
        view.setUint16(4, 20, true);
        view.setUint16(6, 20, true);
        view.setUint16(8, 0x0800, true);
        view.setUint16(10, 0, true);
        view.setUint16(12, dosTime, true);
        view.setUint16(14, dosDate, true);
        view.setUint32(16, entry.crc, true);
        view.setUint32(20, entry.dataBytes.length, true);
        view.setUint32(24, entry.dataBytes.length, true);
        view.setUint16(28, entry.nameBytes.length, true);
        view.setUint16(30, 0, true);
        view.setUint16(32, 0, true);
        view.setUint16(34, 0, true);
        view.setUint16(36, 0, true);
        view.setUint32(38, 0, true);
        view.setUint32(42, entry.offset, true);
        header.set(entry.nameBytes, 46);
        central.push(header);
      });
      const centralSize = central.reduce((sum, chunk) => sum + chunk.length, 0);
      const end = new Uint8Array(22);
      const endView = new DataView(end.buffer);
      endView.setUint32(0, 0x06054b50, true);
      endView.setUint16(4, 0, true);
      endView.setUint16(6, 0, true);
      endView.setUint16(8, entries.length, true);
      endView.setUint16(10, entries.length, true);
      endView.setUint32(12, centralSize, true);
      endView.setUint32(16, offset, true);
      endView.setUint16(20, 0, true);
      return new Blob([...locals, ...central, end], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
    }

    /*
      导出入口：空文档直接提示，其他情况生成 Blob 并交给 downloadBlob。
      文件在浏览器内生成，不经过服务器。
    */
    function exportDocx() {
      if (!analysisText().trim()) {
        toast("文档为空，没有可导出的内容", { type: "info" });
        return;
      }
      const files = buildDocx();
      const blob = zipStore([
        { name: "[Content_Types].xml", data: files.contentTypes },
        { name: "_rels/.rels", data: files.rootRels },
        { name: "word/document.xml", data: files.documentXml },
        { name: "word/styles.xml", data: files.stylesXml },
        { name: "word/_rels/document.xml.rels", data: files.documentRels },
      ]);
      downloadBlob(blob, `${exportBaseName()}.docx`);
      toast("Word 文档已生成");
    }

    function exportTxt() {
      const text = analysisText();
      if (!text.trim()) {
        toast("文档为空，没有可导出的内容", { type: "info" });
        return;
      }
      downloadBlob(
        new Blob([`\ufeff${text}\n`], { type: "text/plain;charset=utf-8" }),
        `${exportBaseName()}.txt`
      );
      toast("纯文本已导出");
    }

    function exportHtml() {
      if (!analysisText().trim()) {
        toast("文档为空，没有可导出的内容", { type: "info" });
        return;
      }
      downloadBlob(
        new Blob([standaloneHtml()], { type: "text/html;charset=utf-8" }),
        `${exportBaseName()}.html`
      );
      toast("网页文档已导出");
    }

    function printDocument() {
      if (!analysisText().trim()) {
        toast("文档为空，没有可打印的内容", { type: "info" });
        return;
      }
      const blob = new Blob([standaloneHtml({ print: true })], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const frame = document.createElement("iframe");
      frame.setAttribute("aria-hidden", "true");
      frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none";
      frame.src = url;
      frame.addEventListener("load", () => {
        try {
          frame.contentWindow.focus();
          frame.contentWindow.print();
        } catch (error) {
          toast("当前浏览器阻止了打印窗口", { type: "error" });
        }
        window.setTimeout(() => {
          URL.revokeObjectURL(url);
          frame.remove();
        }, 2000);
      }, { once: true });
      document.body.appendChild(frame);
      toast("已打开打印窗口，可选择另存为 PDF", { type: "info" });
    }

    refs.toolbar?.querySelectorAll("[data-doc-export]").forEach((button) => {
      button.addEventListener("click", () => {
        const kind = button.dataset.docExport;
        if (kind === "docx") exportDocx();
        else if (kind === "txt") exportTxt();
        else if (kind === "html") exportHtml();
        else if (kind === "print") printDocument();
      });
    });

    $$("[data-doc-export]", $(".doc-side")).forEach((button) => {
      button.addEventListener("click", () => {
        const kind = button.dataset.docExport;
        if (kind === "docx") exportDocx();
        else if (kind === "txt") exportTxt();
        else if (kind === "html") exportHtml();
        else if (kind === "print") printDocument();
      });
    });

    /* --------------------------------------------------------------------
       Initial render
       -------------------------------------------------------------------- */
    /*
      初始化顺序：先绑定事件，再读取草稿 / 放示例，最后在下一帧计算统计。
      下一帧计算可以拿到真实纸张高度；destroyed 检查避免用户快速离开时
      继续操作已移除的 DOM。
    */

    let restoredDraft = false;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.html === "string") {
          editor.innerHTML = parsed.html;
          restoredDraft = true;
        }
      }
    } catch (error) {
      restoredDraft = false;
    }
    if (!restoredDraft) editor.innerHTML = SAMPLE_DOC;
    editor.setAttribute("data-placeholder", "在这里开始写，或粘贴一段文字…");
    saveStatus(restoredDraft ? "已恢复本地草稿" : "示例文档 · 自动保存在本机");
    window.requestAnimationFrame(() => {
      if (destroyed) return;
      analyze();
      refreshToolbarState();
    });

    function cleanup() {
      if (destroyed) return;
      window.clearTimeout(saveTimer);
      scheduleAnalyze.cancel();
      saveDraftNow();
      destroyed = true;
      document.removeEventListener("selectionchange", onSelectionChange);
    }

    return cleanup;
  }
