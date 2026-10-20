/* ==========================================================================
   Password generator
   ChengYu · Lumen Toolkit
   ========================================================================== */
"use strict";

  /* ----------------------------------------------------------------------
     Password tool
     ---------------------------------------------------------------------- */
  function initPasswordTool() {
    const output = $("#passwordOutput");
    const lengthSlider = $("#passwordLength");
    const lengthValue = $("#passwordLengthValue");
    const strengthLabel = $("#passwordStrengthLabel");
    const strengthTrack = $("#strengthTrack");
    const entropyLabel = $("#passwordEntropy");
    const checkboxes = {
      lower: $("#pwLower"),
      upper: $("#pwUpper"),
      digits: $("#pwDigits"),
      symbols: $("#pwSymbols"),
      avoid: $("#pwAvoid"),
    };
    if (!output || !lengthSlider) return null;

    const SYMBOLS = "!@#$%^&*()_+-=[]{};:,.?/|~";
    const AMBIGUOUS = /[0O1lI|`]/g;
    const sets = [
      { key: "lower", chars: "abcdefghijklmnopqrstuvwxyz" },
      { key: "upper", chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZ" },
      { key: "digits", chars: "0123456789" },
      { key: "symbols", chars: SYMBOLS },
    ];

    function selectedSets() {
      const avoid = checkboxes.avoid.checked;
      return sets
        .filter((set) => checkboxes[set.key].checked)
        .map((set) => ({
          ...set,
          chars: avoid ? set.chars.replace(AMBIGUOUS, "") : set.chars,
        }))
        .filter((set) => set.chars.length > 0);
    }

    function paintStrength(entropy) {
      const level = entropy < 40 ? 1 : entropy < 62 ? 2 : entropy < 88 ? 3 : 4;
      const colors = ["#e5484d", "#f59f0b", "#30a46c", "#0a84ff"];
      const labels = ["弱", "一般", "强", "极强"];
      if (strengthTrack) {
        Array.from(strengthTrack.children).forEach((bar, index) => {
          bar.style.background = index < level ? colors[level - 1] : "";
        });
      }
      if (strengthLabel) {
        strengthLabel.textContent = labels[level - 1];
        strengthLabel.style.color = colors[level - 1];
        strengthLabel.style.background = `${colors[level - 1]}18`;
      }
      if (entropyLabel) entropyLabel.textContent = `约 ${entropy} 位熵`;
      if (lengthSlider) lengthSlider.style.setProperty("--range-accent", colors[level - 1]);
    }

    function createPassword() {
      const activeSets = selectedSets();
      if (!activeSets.length) return null;
      const length = clamp(Number(lengthSlider.value), 6, 64);
      const pool = activeSets.map((set) => set.chars).join("");
      const chars = [];

      activeSets.forEach((set) => {
        chars.push(set.chars[secureRandomInt(set.chars.length)]);
      });
      while (chars.length < length) {
        chars.push(pool[secureRandomInt(pool.length)]);
      }
      while (chars.length > length) chars.pop();

      for (let index = chars.length - 1; index > 0; index -= 1) {
        const swapIndex = secureRandomInt(index + 1);
        [chars[index], chars[swapIndex]] = [chars[swapIndex], chars[index]];
      }

      return {
        password: chars.join(""),
        entropy: Math.round(length * Math.log2(pool.length)),
        length,
      };
    }

    function generatePassword() {
      const result = createPassword();
      if (!result) {
        checkboxes.lower.checked = true;
        toast("至少保留一类字符", { type: "info" });
        return;
      }
      output.textContent = result.password;
      paintStrength(result.entropy);
      paintRange(lengthSlider);
      if (lengthValue) lengthValue.textContent = String(result.length);
    }

    function onToggleChange(event) {
      const anyChecked = sets.some((set) => checkboxes[set.key].checked);
      if (!anyChecked) {
        event.target.checked = true;
        toast("至少保留一类字符", { type: "info" });
      }
      generatePassword();
    }

    lengthSlider.addEventListener("input", () => {
      paintRange(lengthSlider);
      generatePassword();
    });
    Object.values(checkboxes).forEach((checkbox) => {
      checkbox?.addEventListener("change", onToggleChange);
    });
    $("#passwordRefresh")?.addEventListener("click", () => {
      generatePassword();
      if (!reducedMotion) {
        $("#passwordRefresh").animate(
          [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }],
          { duration: 520, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
        );
      }
    });
    $("#passwordCopy")?.addEventListener("click", () => {
      copyText(output.textContent, "密码已复制");
    });
    $("#passwordBatch")?.addEventListener("click", () => {
      const results = Array.from({ length: 5 }, () => createPassword()).filter(Boolean);
      if (!results.length) {
        toast("至少保留一类字符", { type: "info" });
        return;
      }
      copyText(results.map((item) => item.password).join("\n"), "5 个密码已复制");
    });

    paintRange(lengthSlider);
    generatePassword();
    return null;
  }

