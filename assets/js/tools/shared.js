/* ==========================================================================
   Shared tool utilities
   ChengYu · Lumen Toolkit
   ========================================================================== */
"use strict";

  /* ----------------------------------------------------------------------
     Tool utilities
     ---------------------------------------------------------------------- */
  /*
    这里只放“被多个工具复用、没有业务语义”的底层函数：

    - paintRange：把 input[type=range] 的当前值写成 CSS 变量，供滑杆
      轨道着色使用，不修改 value 本身。
    - secureRandomInt：无偏随机整数。若直接 `random % max`，当 max 不能
      整除 2^32 时低位会略偏多；这里先拒绝落在尾巴上的样本，保证均匀。
      没有 crypto 时退回 Math.random，仅用于非安全场景。
  */
  function paintRange(input) {
    if (!input) return;
    const min = Number(input.min) || 0;
    const max = Number(input.max) || 100;
    const value = Number(input.value);
    const progress = max === min ? 0 : ((value - min) / (max - min)) * 100;
    input.style.setProperty("--range-progress", `${clamp(progress, 0, 100)}%`);
  }

  function secureRandomInt(max) {
    if (max <= 0) return 0;
    if (!window.crypto?.getRandomValues) return Math.floor(Math.random() * max);
    const limit = Math.floor(0x100000000 / max) * max;
    const buffer = new Uint32Array(1);
    do {
      window.crypto.getRandomValues(buffer);
    } while (buffer[0] >= limit);
    return buffer[0] % max;
  }

