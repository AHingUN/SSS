/* ==========================================================================
   CSV / JSON local converter
   ChengYu · Lumen Toolkit
   ========================================================================== */
"use strict";

  /* ----------------------------------------------------------------------
     CSV / JSON
     ---------------------------------------------------------------------- */
  /*
    CSV 解析不是简单 split(",")：
    - 支持双引号包裹的字段；
    - 支持字段内逗号、换行和转义双引号（""）；
    - 自动检测 , / Tab / ; 三种分隔符。
    输出 JSON 后由 JSON.stringify 负责转义，不手工拼 JSON 字符串。
  */
  function detectCsvDelimiter(text) {
    const first = text.split(/\r?\n/).find((line) => line.trim()) || "";
    const candidates = [",", "\t", ";"];
    return candidates
      .map((delimiter) => ({ delimiter, count: first.split(delimiter).length - 1 }))
      .sort((a, b) => b.count - a.count)[0]?.delimiter || ",";
  }

  function parseCsv(text, delimiter) {
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      if (quoted) {
        if (char === '"') {
          if (text[index + 1] === '"') {
            field += '"';
            index += 1;
          } else {
            quoted = false;
          }
        } else {
          field += char;
        }
      } else if (char === '"') {
        quoted = true;
      } else if (char === delimiter) {
        row.push(field);
        field = "";
      } else if (char === "\n" || char === "\r") {
        if (char === "\r" && text[index + 1] === "\n") index += 1;
        row.push(field);
        if (row.some((cell) => cell.trim() !== "")) rows.push(row);
        row = [];
        field = "";
      } else {
        field += char;
      }
    }
    if (field.length || row.length) {
      row.push(field);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
    }
    return rows;
  }

  function escapeCsv(value, delimiter) {
    const text = value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
    return /["\n\r]/.test(text) || text.includes(delimiter) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function initCsvTool() {
    const input = $("#csvInput");
    const output = $("#csvOutput");
    if (!input || !output) return;
    const error = $("#csvError");
    const status = $("#csvStatus");
    const outputLabel = $("#csvOutputLabel");
    const stat = $("#csvStat");
    const headerToggle = $("#csvHeader");
    const delimiterSelect = $("#csvDelimiter");
    const modeButtons = $$("[data-csv-mode]");
    let mode = "csv2json";
    const sampleCsv = "姓名,城市,角色\n林澄,杭州,设计\n周野,上海,开发\n沈知,成都,研究\n";
    const sampleRecords = parseCsv(sampleCsv, ",").slice(1).map((row) => ({
      姓名: row[0],
      城市: row[1],
      角色: row[2],
    }));
    const sampleJson = JSON.stringify(sampleRecords, null, 2);
    const drafts = { csv2json: sampleCsv, json2csv: sampleJson };

    const setStatus = (text, kind = "valid") => {
      if (!status) return;
      status.className = `status-pill ${kind === "error" ? "is-invalid" : "is-valid"}`;
      status.innerHTML = `<span class="status-dot"></span>${text}`;
    };

    const setError = (message = "") => {
      if (!error) return;
      error.textContent = message;
      error.hidden = !message;
      if (message) setStatus("需要检查", "error");
    };

    const currentDelimiter = () => {
      const selected = delimiterSelect?.value || "auto";
      if (selected !== "auto") return selected;
      return mode === "csv2json" ? detectCsvDelimiter(input.value) : ",";
    };

    const convert = () => {
      const raw = input.value.trim();
      setError("");
      if (!raw) {
        output.textContent = "";
        if (stat) stat.textContent = "等待输入";
        setStatus("就绪");
        return;
      }
      try {
        if (mode === "csv2json") {
          const delimiter = currentDelimiter();
          const rows = parseCsv(input.value, delimiter);
          if (!rows.length) throw new Error("没有识别到有效行");
          let data = rows;
          let columns = Math.max(...rows.map((row) => row.length));
          if (headerToggle?.checked) {
            const headers = rows.shift().map((header, index) => header.trim() || `column_${index + 1}`);
            columns = headers.length;
            data = rows.map((row) =>
              Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]))
            );
          }
          output.textContent = JSON.stringify(data, null, 2);
          if (stat) stat.textContent = `${data.length} 行 · ${columns} 列 · ${new Blob([output.textContent]).size} B`;
          setStatus("已转换");
        } else {
          let parsed;
          try {
            parsed = JSON.parse(raw);
          } catch {
            throw new Error("JSON 语法不正确，无法转换为 CSV");
          }
          const records = Array.isArray(parsed) ? parsed : [parsed];
          if (!records.length) throw new Error("JSON 数组为空");
          const delimiter = currentDelimiter();
          let headers = [];
          if (records.every((record) => record && typeof record === "object" && !Array.isArray(record))) {
            const seen = new Set();
            records.forEach((record) => Object.keys(record).forEach((key) => seen.add(key)));
            headers = [...seen];
          } else if (records.every((record) => Array.isArray(record))) {
            const width = Math.max(...records.map((record) => record.length));
            headers = Array.from({ length: width }, (_, index) => `column_${index + 1}`);
          } else {
            headers = ["value"];
          }
          const lines = [];
          if (headerToggle?.checked) lines.push(headers.map((header) => escapeCsv(header, delimiter)).join(delimiter));
          records.forEach((record) => {
            const row = headers.map((header) => {
              if (Array.isArray(record)) return record[headers.indexOf(header)] ?? "";
              if (record && typeof record === "object") return record[header] ?? "";
              return record;
            });
            lines.push(row.map((value) => escapeCsv(value, delimiter)).join(delimiter));
          });
          output.textContent = lines.join("\n");
          if (stat) stat.textContent = `${records.length} 行 · ${headers.length} 列 · ${new Blob([output.textContent]).size} B`;
          setStatus("已转换");
        }
      } catch (problem) {
        output.textContent = "";
        setError(problem.message || "转换失败");
        if (stat) stat.textContent = "等待有效输入";
      }
    };

    const setMode = (next) => {
      if (next === mode) return;
      drafts[mode] = input.value;
      mode = next;
      modeButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.csvMode === next));
      if (outputLabel) outputLabel.textContent = next === "csv2json" ? "output.json" : "output.csv";
      if (!drafts[mode]) drafts[mode] = mode === "csv2json" ? sampleCsv : sampleJson;
      input.value = drafts[mode];
      convert();
    };

    modeButtons.forEach((button) => {
      button.addEventListener("click", () => setMode(button.dataset.csvMode));
    });
    input.addEventListener("input", () => {
      drafts[mode] = input.value;
    });
    $("#csvConvert")?.addEventListener("click", convert);
    $("#csvSample")?.addEventListener("click", () => {
      drafts[mode] = mode === "csv2json" ? sampleCsv : sampleJson;
      input.value = drafts[mode];
      convert();
    });
    $("#csvClear")?.addEventListener("click", () => {
      input.value = "";
      drafts[mode] = "";
      output.textContent = "";
      if (stat) stat.textContent = "等待输入";
      setError("");
      setStatus("就绪");
      input.focus();
    });
    $("#csvCopy")?.addEventListener("click", () => {
      if (!output.textContent) return toast("还没有可复制的结果", { type: "info" });
      copyText(output.textContent, "转换结果已复制");
    });
    $("#csvDownload")?.addEventListener("click", () => {
      if (!output.textContent) return toast("还没有可下载的结果", { type: "info" });
      const extension = mode === "csv2json" ? "json" : "csv";
      downloadText(output.textContent, `lumen-data.${extension}`, extension === "json" ? "application/json;charset=utf-8" : "text/csv;charset=utf-8");
      toast(`已下载 ${extension.toUpperCase()} 文件`);
    });
    $("#csvMarkdown")?.addEventListener("click", () => {
      if (!output.textContent.trim()) return toast("还没有可转换的结果", { type: "info" });
      let rows = [];
      try {
        if (mode === "csv2json") {
          const parsed = JSON.parse(output.textContent);
          const records = Array.isArray(parsed) ? parsed : [parsed];
          if (!records.length) return;
          const headers = Object.keys(records[0]);
          rows = [headers, ...records.map((record) => headers.map((key) => record?.[key] ?? ""))];
        } else {
          rows = parseCsv(output.textContent, currentDelimiter());
        }
      } catch {
        toast("结果格式不完整，暂时无法生成表格", { type: "info" });
        return;
      }
      if (!rows.length) return;
      const cell = (value) => String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
      const headers = rows[0] || [];
      const markdown = [
        `| ${headers.map(cell).join(" | ")} |`,
        `| ${headers.map(() => "---").join(" | ")} |`,
        ...rows.slice(1).map((row) => `| ${headers.map((_, index) => cell(row[index])).join(" | ")} |`),
      ].join("\n");
      copyText(markdown, "Markdown 表格已复制");
    });
    delimiterSelect?.addEventListener("change", convert);
    headerToggle?.addEventListener("change", convert);
    input.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        convert();
      }
    });
    input.value = sampleCsv;
    convert();
  }

