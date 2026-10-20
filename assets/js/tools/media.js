/* ==========================================================================
   Media studio: audio, screen, camera recording and speech synthesis
   ChengYu · Lumen Toolkit
   ========================================================================== */
"use strict";

/*
  媒体工具是一个“用户主动授权”的状态机：

    idle ──开始──> recording ──暂停──> paused ──继续──> recording
      ^                 │
      └────停止─────────┘

  三个面板各自维护 stream / recorder / chunks，但共享：
  - 计时器（performance.now() 累计，暂停时间不计入）；
  - 状态提示和按钮可用性；
  - 退出工具时的 dispose（停止轨道、关闭 AudioContext、释放 ObjectURL）。

  所有 getUserMedia / getDisplayMedia 都必须在用户点击后调用；页面加载时
  不请求权限。录制功能不可用（无 MediaRecorder / 无媒体设备）时，只禁用
  对应面板，不影响其他工具。
*/
function initMediaTool() {
  const tabs = $$("#mediaTabs [data-studio-tab]");
  const panes = $$(".studio-pane", $("#mediaTabs")?.closest(".studio-panel"));
  if (!tabs.length || !panes.length) return;
  let mediaDisposed = false;

  const captureVideoFrame = (video, filename) => {
    if (!video || !video.videoWidth || !video.videoHeight) {
      toast("先开始录制，再截取画面", { type: "info" });
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      downloadBlob(blob, filename);
      toast("画面已截取");
    }, "image/png");
  };
  const activate = (id) => {
    tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.studioTab === id));
    panes.forEach((pane) => {
      const active = pane.dataset.studioPane === id;
      pane.hidden = !active;
      pane.classList.toggle("is-active", active);
    });
  };
  tabs.forEach((tab) => tab.addEventListener("click", () => activate(tab.dataset.studioTab)));

  const formatTimer = (milliseconds) => {
    const total = Math.max(0, Math.floor(milliseconds / 1000));
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  };
  const makeTimer = (node) => {
    let accumulated = 0;
    let startedAt = 0;
    let interval = 0;
    let running = false;
    const paint = () => {
      if (node) node.textContent = formatTimer(accumulated + (running ? performance.now() - startedAt : 0));
    };
    const pause = () => {
      if (!running) return;
      accumulated += performance.now() - startedAt;
      running = false;
      if (interval) window.clearInterval(interval);
      interval = 0;
      paint();
    };
    const clear = () => {
      accumulated = 0;
      running = false;
      if (interval) window.clearInterval(interval);
      interval = 0;
      paint();
    };
    const startTimer = () => {
      if (running) return;
      running = true;
      startedAt = performance.now();
      if (interval) window.clearInterval(interval);
      interval = window.setInterval(paint, 250);
      paint();
    };
    return { start: startTimer, pause, clear };
  };
  const setStatus = (node, text, state = "") => {
    if (!node) return;
    node.textContent = text;
    node.className = `studio-status${state ? ` is-${state}` : ""}`;
  };
  const setButtonState = (button, { disabled = false, label = null } = {}) => {
    if (!button) return;
    button.disabled = disabled;
    if (label !== null) button.textContent = label;
  };

  // ---------------------------------------------------------------------
  // Audio recording
  // ---------------------------------------------------------------------
  const audioDevice = $("#audioDevice");
  const audioFormat = $("#audioFormat");
  const audioTimer = $("#audioTimer");
  const audioLevel = $("#audioLevel");
  const audioStart = $("#audioStart");
  const audioPause = $("#audioPause");
  const audioStop = $("#audioStop");
  const audioStatus = $("#audioStatus");
  const audioPlayback = $("#audioPlayback");
  const audioDownload = $("#audioDownload");
  const audioRecorderTimer = makeTimer(audioTimer);
  const audio = { stream: null, recorder: null, chunks: [], url: "", meter: null, meterFrame: 0, audioContext: null };
  const audioSupported = Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);

  const stopAudioMeter = () => {
    if (audio.meterFrame) cancelAnimationFrame(audio.meterFrame);
    audio.meterFrame = 0;
    audio.meter = null;
    if (audio.audioContext) audio.audioContext.close().catch(() => {});
    audio.audioContext = null;
    if (audioLevel) audioLevel.style.transform = "scaleX(0)";
  };

  const startAudioMeter = (stream) => {
    stopAudioMeter();
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass || !audioLevel) return;
    audio.audioContext = new AudioContextClass();
    const source = audio.audioContext.createMediaStreamSource(stream);
    const analyser = audio.audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    audio.meter = analyser;
    const values = new Uint8Array(analyser.frequencyBinCount);
    const paint = () => {
      if (!audio.meter) return;
      audio.meter.getByteFrequencyData(values);
      const average = values.reduce((sum, value) => sum + value, 0) / values.length;
      audioLevel.style.transform = `scaleX(${Math.min(1, average / 90)})`;
      audio.meterFrame = requestAnimationFrame(paint);
    };
    paint();
  };

  const refreshAudioDevices = async () => {
    if (!navigator.mediaDevices?.enumerateDevices || !audioDevice) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices.filter((device) => device.kind === "audioinput");
      const selected = audioDevice.value;
      audioDevice.replaceChildren(new Option("默认设备", ""));
      inputs.forEach((device, index) => {
        audioDevice.add(new Option(device.label || `麦克风 ${index + 1}`, device.deviceId));
      });
      if (selected) audioDevice.value = selected;
    } catch (error) {
      /* Device labels may remain unavailable until permission is granted. */
    }
  };

  const stopAudio = () => {
    if (audio.recorder && audio.recorder.state !== "inactive") audio.recorder.stop();
    audio.stream?.getTracks().forEach((track) => track.stop());
    audio.stream = null;
    audioRecorderTimer.clear();
    stopAudioMeter();
    setButtonState(audioStart, { disabled: false });
    setButtonState(audioPause, { disabled: true, label: "暂停" });
    setButtonState(audioStop, { disabled: true });
  };

  const startAudio = async () => {
    if (!audioSupported) {
      setStatus(audioStatus, "当前浏览器不支持录音", "error");
      return;
    }
    try {
      const deviceId = audioDevice?.value || "";
      audio.stream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      });
      await refreshAudioDevices();
      audio.chunks = [];
      const preferred = audioFormat?.value || "audio/webm";
      const mimeType = MediaRecorder.isTypeSupported(preferred) ? preferred : "audio/webm";
      audio.recorder = new MediaRecorder(audio.stream, { mimeType });
      audio.recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size) audio.chunks.push(event.data);
      });
      audio.recorder.addEventListener("stop", () => {
        if (mediaDisposed) return;
        const type = audio.recorder?.mimeType || mimeType;
        const blob = new Blob(audio.chunks, { type });
        if (audio.url) URL.revokeObjectURL(audio.url);
        audio.url = URL.createObjectURL(blob);
        if (audioPlayback) {
          audioPlayback.src = audio.url;
          audioPlayback.hidden = false;
        }
        if (audioDownload) {
          const extension = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
          audioDownload.href = audio.url;
          audioDownload.download = `lumen-recording.${extension}`;
          audioDownload.hidden = false;
        }
        setStatus(audioStatus, `已录制 · ${(blob.size / 1024).toFixed(1)} KB`, "valid");
      });
      audio.recorder.start();
      startAudioMeter(audio.stream);
      audioRecorderTimer.start();
      setButtonState(audioStart, { disabled: true });
      setButtonState(audioPause, { disabled: false, label: "暂停" });
      setButtonState(audioStop, { disabled: false });
      setStatus(audioStatus, "正在录音…", "valid");
    } catch (error) {
      setStatus(audioStatus, error.name === "NotAllowedError" ? "麦克风权限被拒绝" : "无法开始录音", "error");
      audio.stream?.getTracks().forEach((track) => track.stop());
      audio.stream = null;
      stopAudioMeter();
      setButtonState(audioStart, { disabled: false });
    }
  };

  audioStart?.addEventListener("click", startAudio);
  audioStop?.addEventListener("click", stopAudio);
  audioPause?.addEventListener("click", () => {
    if (!audio.recorder) return;
    if (audio.recorder.state === "recording") {
      audio.recorder.pause();
      setButtonState(audioPause, { label: "继续" });
      setStatus(audioStatus, "已暂停", "valid");
      audioRecorderTimer.pause();
    } else if (audio.recorder.state === "paused") {
      audio.recorder.resume();
      setButtonState(audioPause, { label: "暂停" });
      setStatus(audioStatus, "正在录音…", "valid");
      audioRecorderTimer.start();
    }
  });

  // ---------------------------------------------------------------------
  // Screen recording
  // ---------------------------------------------------------------------
  const screenStart = $("#screenStart");
  const screenPause = $("#screenPause");
  const screenStop = $("#screenStop");
  const screenStatus = $("#screenStatus");
  const screenTimer = $("#screenTimer");
  const screenAudio = $("#screenAudio");
  const screenPlayback = $("#screenPlayback");
  const screenDownload = $("#screenDownload");
  const screenSnapshot = $("#screenSnapshot");
  const screenRecorderTimer = makeTimer(screenTimer);
  const screen = { stream: null, recorder: null, chunks: [], url: "" };
  const screenSupported = Boolean(navigator.mediaDevices?.getDisplayMedia && window.MediaRecorder);

  const stopScreen = () => {
    if (screen.recorder && screen.recorder.state !== "inactive") screen.recorder.stop();
    screen.stream?.getTracks().forEach((track) => track.stop());
    screen.stream = null;
    screenRecorderTimer.clear();
    setButtonState(screenStart, { disabled: false });
    setButtonState(screenPause, { disabled: true, label: "暂停" });
    setButtonState(screenStop, { disabled: true });
  };

  const startScreen = async () => {
    if (!screenSupported) {
      setStatus(screenStatus, "当前浏览器不支持屏幕录制", "error");
      return;
    }
    const withAudio = Boolean(screenAudio?.checked);
    const start = async (audioRequested) =>
      navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: audioRequested,
      });
    try {
      try {
        screen.stream = await start(withAudio);
      } catch (error) {
        if (!withAudio || error.name === "NotAllowedError") throw error;
        screen.stream = await start(false);
        setStatus(screenStatus, "系统声音不可用，仅录制画面", "valid");
      }
      screen.chunks = [];
      const preferred = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm";
      try {
        screen.recorder = new MediaRecorder(screen.stream, { mimeType: preferred });
      } catch (error) {
        screen.recorder = new MediaRecorder(screen.stream);
      }
      screen.recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size) screen.chunks.push(event.data);
      });
      screen.recorder.addEventListener("stop", () => {
        if (mediaDisposed) return;
        const blob = new Blob(screen.chunks, { type: "video/webm" });
        if (screen.url) URL.revokeObjectURL(screen.url);
        screen.url = URL.createObjectURL(blob);
        if (screenPlayback) {
          screenPlayback.srcObject = null;
          screenPlayback.src = screen.url;
          screenPlayback.hidden = false;
        }
        if (screenDownload) {
          screenDownload.href = screen.url;
          screenDownload.hidden = false;
        }
        setStatus(screenStatus, `已录制 · ${(blob.size / 1024 / 1024).toFixed(1)} MB`, "valid");
      });
      if (screenPlayback) {
        screenPlayback.srcObject = screen.stream;
        screenPlayback.hidden = false;
        screenPlayback.play().catch(() => {});
      }
      if (screenSnapshot) screenSnapshot.disabled = false;
      screen.recorder.start();
      screenRecorderTimer.start();
      setButtonState(screenStart, { disabled: true });
      setButtonState(screenPause, { disabled: false, label: "暂停" });
      setButtonState(screenStop, { disabled: false });
      setStatus(screenStatus, "正在录屏…", "valid");
      screen.stream.getVideoTracks()[0]?.addEventListener("ended", stopScreen, { once: true });
    } catch (error) {
      setStatus(screenStatus, error.name === "NotAllowedError" ? "屏幕录制权限被取消" : "无法开始录屏", "error");
      screen.stream?.getTracks().forEach((track) => track.stop());
      screen.stream = null;
      setButtonState(screenStart, { disabled: false });
    }
  };
  screenStart?.addEventListener("click", startScreen);
  screenSnapshot?.addEventListener("click", () => captureVideoFrame(screenPlayback, "lumen-screen.png"));
  screenStop?.addEventListener("click", stopScreen);
  screenPause?.addEventListener("click", () => {
    if (!screen.recorder) return;
    if (screen.recorder.state === "recording") {
      screen.recorder.pause();
      setButtonState(screenPause, { label: "继续" });
      setStatus(screenStatus, "已暂停", "valid");
      screenRecorderTimer.pause();
    } else if (screen.recorder.state === "paused") {
      screen.recorder.resume();
      setButtonState(screenPause, { label: "暂停" });
      setStatus(screenStatus, "正在录屏…", "valid");
      screenRecorderTimer.start();
    }
  });

  // ---------------------------------------------------------------------
  // Camera recording
  // ---------------------------------------------------------------------
  const cameraStart = $("#cameraStart");
  const cameraPause = $("#cameraPause");
  const cameraStop = $("#cameraStop");
  const cameraStatus = $("#cameraStatus");
  const cameraTimer = $("#cameraTimer");
  const cameraFacing = $("#cameraFacing");
  const cameraPlayback = $("#cameraPlayback");
  const cameraDownload = $("#cameraDownload");
  const cameraRecorderTimer = makeTimer(cameraTimer);
  const camera = { stream: null, recorder: null, chunks: [], url: "" };

  const stopCamera = () => {
    if (camera.recorder && camera.recorder.state !== "inactive") camera.recorder.stop();
    camera.stream?.getTracks().forEach((track) => track.stop());
    camera.stream = null;
    cameraRecorderTimer.clear();
    setButtonState(cameraStart, { disabled: false });
    setButtonState(cameraPause, { disabled: true, label: "暂停" });
    setButtonState(cameraStop, { disabled: true });
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setStatus(cameraStatus, "当前浏览器不支持摄像头录制", "error");
      return;
    }
    try {
      camera.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: cameraFacing?.value || "user" },
        audio: true,
      });
      camera.chunks = [];
      const preferred = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm";
      try {
        camera.recorder = new MediaRecorder(camera.stream, { mimeType: preferred });
      } catch (error) {
        camera.recorder = new MediaRecorder(camera.stream);
      }
      camera.recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size) camera.chunks.push(event.data);
      });
      camera.recorder.addEventListener("stop", () => {
        if (mediaDisposed) return;
        const blob = new Blob(camera.chunks, { type: "video/webm" });
        if (camera.url) URL.revokeObjectURL(camera.url);
        camera.url = URL.createObjectURL(blob);
        if (cameraPlayback) {
          cameraPlayback.srcObject = null;
          cameraPlayback.muted = false;
          cameraPlayback.src = camera.url;
          cameraPlayback.hidden = false;
        }
        if (cameraDownload) {
          cameraDownload.href = camera.url;
          cameraDownload.hidden = false;
        }
        setStatus(cameraStatus, `已录制 · ${(blob.size / 1024 / 1024).toFixed(1)} MB`, "valid");
      });
      if (cameraPlayback) {
        cameraPlayback.srcObject = camera.stream;
        cameraPlayback.muted = true;
        cameraPlayback.hidden = false;
        cameraPlayback.play().catch(() => {});
      }
      if (cameraSnapshot) cameraSnapshot.disabled = false;
      camera.recorder.start();
      cameraRecorderTimer.start();
      setButtonState(cameraStart, { disabled: true });
      setButtonState(cameraPause, { disabled: false, label: "暂停" });
      setButtonState(cameraStop, { disabled: false });
      setStatus(cameraStatus, "正在录制…", "valid");
      camera.stream.getVideoTracks()[0]?.addEventListener("ended", stopCamera, { once: true });
    } catch (error) {
      setStatus(cameraStatus, error.name === "NotAllowedError" ? "摄像头权限被拒绝" : "无法打开摄像头", "error");
      camera.stream?.getTracks().forEach((track) => track.stop());
      camera.stream = null;
      setButtonState(cameraStart, { disabled: false });
    }
  };
  cameraStart?.addEventListener("click", startCamera);
  cameraSnapshot?.addEventListener("click", () => captureVideoFrame(cameraPlayback, "lumen-camera.png"));
  cameraStop?.addEventListener("click", stopCamera);
  cameraPause?.addEventListener("click", () => {
    if (!camera.recorder) return;
    if (camera.recorder.state === "recording") {
      camera.recorder.pause();
      setButtonState(cameraPause, { label: "继续" });
      setStatus(cameraStatus, "已暂停", "valid");
      cameraRecorderTimer.pause();
    } else if (camera.recorder.state === "paused") {
      camera.recorder.resume();
      setButtonState(cameraPause, { label: "暂停" });
      setStatus(cameraStatus, "正在录制…", "valid");
      cameraRecorderTimer.start();
    }
  });

  // ---------------------------------------------------------------------
  // Speech synthesis
  // ---------------------------------------------------------------------
  const speechText = $("#speechText");
  const speechLanguage = $("#speechLanguage");
  const speechVoice = $("#speechVoice");
  const speechRate = $("#speechRate");
  const speechPitch = $("#speechPitch");
  const speechVolume = $("#speechVolume");
  const speechRateValue = $("#speechRateValue");
  const speechPitchValue = $("#speechPitchValue");
  const speechVolumeValue = $("#speechVolumeValue");
  const speechCount = $("#speechCount");
  const speechStatus = $("#speechStatus");
  const speechSpeak = $("#speechSpeak");
  const speechPause = $("#speechPause");
  const speechStop = $("#speechStop");
  const synth = window.speechSynthesis;
  let voices = [];
  let currentUtterance = null;
  let speechCanceled = false;

  const fillLanguageOptions = () => {
    if (!speechLanguage) return;
    const languages = [...new Set(voices.map((voice) => voice.lang).filter(Boolean))].sort();
    const current = speechLanguage.value;
    speechLanguage.replaceChildren(new Option("全部语言", ""));
    languages.forEach((lang) => speechLanguage.add(new Option(lang, lang)));
    if (current) speechLanguage.value = current;
  };
  const fillVoices = () => {
    if (!synth || !speechVoice) return;
    voices = synth.getVoices();
    fillLanguageOptions();
    const language = speechLanguage?.value || "";
    speechVoice.replaceChildren();
    const filtered = voices.filter((voice) => !language || voice.lang.startsWith(language));
    if (!filtered.length) {
      speechVoice.add(new Option("系统默认声音", ""));
      return;
    }
    filtered.forEach((voice) => speechVoice.add(new Option(`${voice.name} · ${voice.lang}`, voice.name)));
  };
  fillVoices();
  if (synth) synth.onvoiceschanged = fillVoices;
  speechLanguage?.addEventListener("change", fillVoices);
  const updateSpeechCount = () => {
    if (speechCount) speechCount.textContent = `${speechText?.value.length || 0} 字`;
  };
  speechText?.addEventListener("input", updateSpeechCount);
  speechRate?.addEventListener("input", () => {
    if (speechRateValue) speechRateValue.textContent = `${Number(speechRate.value).toFixed(1)}×`;
  });
  speechPitch?.addEventListener("input", () => {
    if (speechPitchValue) speechPitchValue.textContent = Number(speechPitch.value).toFixed(1);
  });
  speechVolume?.addEventListener("input", () => {
    if (speechVolumeValue) speechVolumeValue.textContent = `${Math.round(Number(speechVolume.value) * 100)}%`;
  });

  const resetSpeechButtons = () => {
    setButtonState(speechSpeak, { disabled: false });
    setButtonState(speechPause, { disabled: true, label: "暂停" });
    setButtonState(speechStop, { disabled: true });
  };

  $("#speechSpeak")?.addEventListener("click", () => {
    if (!synth) {
      setStatus(speechStatus, "当前浏览器不支持文本朗读", "error");
      return;
    }
    const text = speechText?.value.trim();
    if (!text) {
      setStatus(speechStatus, "请先输入要朗读的文本", "error");
      return;
    }
    if (currentUtterance) {
      currentUtterance.onstart = null;
      currentUtterance.onend = null;
      currentUtterance.onerror = null;
    }
    synth.cancel();
    speechCanceled = false;
    currentUtterance = new SpeechSynthesisUtterance(text);
    const selected = voices.find((voice) => voice.name === speechVoice?.value);
    if (selected) currentUtterance.voice = selected;
    currentUtterance.rate = Number(speechRate?.value || 1);
    currentUtterance.pitch = Number(speechPitch?.value || 1);
    currentUtterance.volume = Number(speechVolume?.value || 1);
    currentUtterance.onstart = () => {
      speechCanceled = false;
      setStatus(speechStatus, "正在朗读…", "valid");
      setButtonState(speechSpeak, { disabled: true });
      setButtonState(speechPause, { disabled: false, label: "暂停" });
      setButtonState(speechStop, { disabled: false });
    };
    currentUtterance.onend = () => {
      setStatus(speechStatus, speechCanceled ? "已停止" : "朗读结束", "valid");
      resetSpeechButtons();
    };
    currentUtterance.onerror = () => {
      setStatus(speechStatus, speechCanceled ? "已停止" : "朗读失败或被打断", speechCanceled ? "" : "error");
      resetSpeechButtons();
    };
    synth.speak(currentUtterance);
  });
  speechPause?.addEventListener("click", () => {
    if (!synth) return;
    if (synth.paused) {
      synth.resume();
      setButtonState(speechPause, { label: "暂停" });
      setStatus(speechStatus, "正在朗读…", "valid");
    } else {
      synth.pause();
      setButtonState(speechPause, { label: "继续" });
      setStatus(speechStatus, "已暂停", "valid");
    }
  });
  $("#speechStop")?.addEventListener("click", () => {
    speechCanceled = true;
    synth?.cancel();
    resetSpeechButtons();
    setStatus(speechStatus, "已停止");
  });
  updateSpeechCount();
  resetSpeechButtons();

  const cleanup = () => {
    if (mediaDisposed) return;
    mediaDisposed = true;
    stopAudio();
    stopScreen();
    stopCamera();
    speechCanceled = true;
    synth?.cancel();
    if (synth) synth.onvoiceschanged = null;
    if (audio.url) URL.revokeObjectURL(audio.url);
    if (screen.url) URL.revokeObjectURL(screen.url);
    if (camera.url) URL.revokeObjectURL(camera.url);
    window.removeEventListener("pagehide", cleanup);
  };
  window.addEventListener("pagehide", cleanup, { once: true });
  return cleanup;
}
