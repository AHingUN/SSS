/* ==========================================================================
   Random picker
   ChengYu · Lumen Toolkit
   ========================================================================== */
"use strict";

  /* ----------------------------------------------------------------------
     Random picker
     ---------------------------------------------------------------------- */
  /*
    随机数优先使用 shared.js 的 secureRandomInt（crypto.getRandomValues，
    并用拒绝采样避免取模偏差）；若安全随机不可用再退回普通 Math.random。

    抽签的“抽中移除”只影响当前候选列表，不改写用户输入的原始文本；
    动画只是视觉层，真正的结果在动画开始前就已经确定，刷新页面不会改变
    已抽出的结果（输入内容由用户自行保存）。
  */
  function initRandomTool() {
    const input = $("#randomInput");
    const countNode = $("#randomCount");
    const removeAfter = $("#randomRemove");
    const result = $("#randomResult");
    const drawButton = $("#randomDraw");
    const resetButton = $("#randomReset");
    const copyButton = $("#randomCopy");
    const confettiLayer = $("#confettiLayer");
    const slotsNode = $("#randomSlots");
    const fxNode = $("#randomFx");
    const animationSelect = $("#randomAnimation");
    const stage = $("#randomStage");
    if (!input || !result || !drawButton) return null;

    input.maxLength = 100000;

    const sample = "日式咖喱\n牛肉面\n轻食沙拉\n寿司\n麻辣烫\n意面";
    const confettiColors = ["#ff8d89", "#ffd66b", "#9be7c2", "#8b9dff", "#e3a0ff", "#73d8e9"];
    const animationChoices = ["roulette", "slot", "flip", "fireworks", "orbit"];
    let animation = safeStorageGet("lumen.randomAnimation", "roulette");
    if (!animationChoices.includes(animation)) animation = "roulette";
    if (animationSelect) animationSelect.value = animation;
    let rolling = false;
    let finishTimer = 0;
    let hasDrawn = false;

    function names() {
      return input.value
        .split(/\r\n|\n|\r/)
        .map((line) => line.trim())
        .filter(Boolean);
    }

    function updateCount() {
      const count = names().length;
      if (countNode) countNode.textContent = `${count} 项`;
    }

    function setButtonLabel(text) {
      drawButton.innerHTML = `${icon("sparkles")}${text}`;
    }

    function clearEffects() {
      if (slotsNode) {
        slotsNode.hidden = true;
        slotsNode.className = "random-slots";
        slotsNode.replaceChildren();
        slotsNode.closest(".random-stage")?.classList.remove("is-reeling");
      }
      if (fxNode) {
        fxNode.replaceChildren();
        fxNode.classList.remove("is-orbit");
      }
      if (confettiLayer) confettiLayer.replaceChildren();
      result.style.visibility = "";
      result.classList.remove("is-rolling", "is-flipping", "is-winner");
    }

    function burst({ count = 18, x = 50, y = 42 } = {}) {
      if (reducedMotion || !confettiLayer) return;
      for (let index = 0; index < count; index += 1) {
        const piece = document.createElement("i");
        piece.className = "confetti";
        piece.style.left = `${x}%`;
        piece.style.top = `${y}%`;
        piece.style.setProperty("--x", `${-190 + secureRandomInt(380)}px`);
        piece.style.setProperty("--y", `${-80 - secureRandomInt(190)}px`);
        piece.style.setProperty("--r", `${-300 + secureRandomInt(600)}deg`);
        piece.style.setProperty("--delay", `${(secureRandomInt(16) / 100).toFixed(2)}s`);
        piece.style.setProperty("--c", confettiColors[secureRandomInt(confettiColors.length)]);
        confettiLayer.appendChild(piece);
        window.setTimeout(() => piece.remove(), 1700);
      }
    }

    function spawnOrbit() {
      if (!fxNode || reducedMotion) return;
      fxNode.replaceChildren();
      fxNode.classList.add("is-orbit");
      for (let index = 0; index < 12; index += 1) {
        const dot = document.createElement("i");
        dot.className = "orbit-spark";
        dot.style.setProperty("--i", index);
        dot.style.setProperty("--c", confettiColors[index % confettiColors.length]);
        fxNode.appendChild(dot);
      }
    }

    function removeChosen(chosen) {
      const lines = input.value.split(/\r\n|\n|\r/);
      const index = lines.findIndex((line) => line.trim() === chosen && line.trim());
      if (index >= 0) lines.splice(index, 1);
      input.value = lines.join("\n").replace(/^\n+|\n+$/g, "");
      updateCount();
    }

    function finishDraw(candidates, chosen = candidates[secureRandomInt(candidates.length)]) {
      clearEffects();
      result.textContent = chosen;
      result.classList.add("is-winner");
      result.setAttribute("aria-live", "polite");
      result.setAttribute("role", "status");
      if (animation === "fireworks") {
        burst({ count: 20, x: 26, y: 38 });
        burst({ count: 20, x: 74, y: 30 });
        burst({ count: 24, x: 50, y: 46 });
      } else {
        burst({ x: 50, y: 42 });
      }
      if (navigator.vibrate && navigator.userActivation?.isActive) {
        try {
          navigator.vibrate(animation === "fireworks" ? 22 : 12);
        } catch (error) {
          /* no-op */
        }
      }
      if (removeAfter.checked && candidates.length > 1) {
        removeChosen(chosen);
      }
      rolling = false;
      drawButton.disabled = false;
      if (copyButton) copyButton.disabled = false;
      if (animationSelect) animationSelect.disabled = false;
      hasDrawn = true;
      setButtonLabel("再抽一次");
      finishTimer = 0;
    }

    function drawReels(candidates, chosen, slot) {
      if (!slotsNode) return false;
      const rows = slot ? 9 : 12;
      const itemHeight = slot ? 54 : 72;
      const chosenIndex = rows - 2;
      const laneCount = slot ? 3 : 1;
      slotsNode.hidden = false;
      slotsNode.className = `random-slots${slot ? " is-slot" : " is-roulette"}`;
      slotsNode.closest(".random-stage")?.classList.add("is-reeling");
      slotsNode.innerHTML = `<div class="reel-window${slot ? " is-slot" : ""}" style="--reel-height:${itemHeight}px">${Array.from(
        { length: laneCount },
        () => `<div class="reel-lane">${Array.from({ length: rows }, (_, index) => {
          const name = index === chosenIndex ? chosen : candidates[secureRandomInt(candidates.length)];
          return `<span class="reel-item">${escapeHTML(name)}</span>`;
        }).join("")}</div>`
      ).join("")}</div>`;
      result.style.visibility = "hidden";
      const lanes = [...slotsNode.querySelectorAll(".reel-lane")];
      lanes.forEach((lane) => {
        lane.style.transition = "none";
        lane.style.transform = "translate3d(0, 0, 0)";
      });
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          lanes.forEach((lane, index) => {
            lane.style.transition = `transform ${slot ? 1.74 + index * 0.11 : 1.84}s cubic-bezier(0.12, 0.74, 0.12, 1)`;
            lane.style.transform = `translate3d(0, -${(chosenIndex - 1) * itemHeight}px, 0)`;
          });
        });
      });
      return true;
    }

    function startDraw() {
      if (rolling) return;
      const candidates = names();
      if (!candidates.length) {
        toast("先写下一些候选名字吧", { type: "info" });
        input.focus();
        return;
      }
      rolling = true;
      clearEffects();
      if (stage) {
        const rect = stage.getBoundingClientRect();
        const dockSpace = window.innerWidth <= 760 ? 86 : 24;
        if (rect.top < 70 || rect.bottom > window.innerHeight - dockSpace) {
          stage.scrollIntoView({ block: "center", behavior: "auto" });
        }
      }
      drawButton.disabled = true;
      if (copyButton) copyButton.disabled = true;
      if (animationSelect) animationSelect.disabled = true;
      result.removeAttribute("aria-live");
      result.removeAttribute("role");
      result.textContent = candidates[secureRandomInt(candidates.length)];
      const chosen = candidates[secureRandomInt(candidates.length)];

      if (reducedMotion) {
        finishDraw(candidates, chosen);
        return;
      }

      if (animation === "roulette" || animation === "slot") {
        if (drawReels(candidates, chosen, animation === "slot")) {
          finishTimer = window.setTimeout(
            () => finishDraw(candidates, chosen),
            animation === "slot" ? 2320 : 2020
          );
          return;
        }
      }

      if (animation === "flip") {
        result.classList.add("is-flipping");
        finishTimer = window.setTimeout(() => finishDraw(candidates, chosen), 1040);
        return;
      }

      if (animation === "orbit") spawnOrbit();
      if (animation === "fireworks") burst({ count: 12, x: 50, y: 52 });
      result.classList.add("is-rolling");
      finishTimer = window.setTimeout(
        () => finishDraw(candidates, chosen),
        animation === "fireworks" ? 1120 : 1180
      );
    }

    input.addEventListener("input", () => {
      updateCount();
    });

    drawButton.addEventListener("click", startDraw);
    animationSelect?.addEventListener("change", () => {
      if (!animationChoices.includes(animationSelect.value)) return;
      animation = animationSelect.value;
      safeStorageSet("lumen.randomAnimation", animation);
      if (!rolling) clearEffects();
    });

    copyButton?.addEventListener("click", () => {
      if (copyButton.disabled || !hasDrawn) {
        toast("先抽取一个结果吧", { type: "info" });
        return;
      }
      copyText(result.textContent, "结果已复制");
    });

    function showQuickResult(value) {
      if (rolling) return;
      clearEffects();
      result.textContent = value;
      result.classList.add("is-winner");
      result.setAttribute("role", "status");
      result.setAttribute("aria-live", "polite");
      hasDrawn = true;
      drawButton.disabled = false;
      if (copyButton) copyButton.disabled = false;
      setButtonLabel("再抽一次");
      if (!reducedMotion) burst({ count: 8, x: 50, y: 42 });
    }

    $("#randomCoin")?.addEventListener("click", () => {
      showQuickResult(secureRandomInt(2) ? "正面" : "反面");
    });
    $("#randomDice")?.addEventListener("click", () => {
      showQuickResult(`🎲 ${secureRandomInt(6) + 1}`);
    });

    resetButton?.addEventListener("click", () => {
      if (rolling) return;
      window.clearTimeout(finishTimer);
      finishTimer = 0;
      rolling = false;
      clearEffects();
      input.value = sample;
      updateCount();
      result.textContent = "准备好抽一个了吗？";
      result.removeAttribute("aria-live");
      result.removeAttribute("role");
      hasDrawn = false;
      drawButton.disabled = false;
      if (copyButton) copyButton.disabled = true;
      if (animationSelect) animationSelect.disabled = false;
      setButtonLabel("开始抽取");
      toast("名单已恢复");
    });

    updateCount();
    return () => {
      window.clearTimeout(finishTimer);
      clearEffects();
      rolling = false;
    };
  }
