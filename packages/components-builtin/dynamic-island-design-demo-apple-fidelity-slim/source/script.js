(() => {
  const root = document.querySelector("[data-motion-root]");
  const clock = document.querySelector("#clock");
  const islandShell = document.querySelector("#islandShell");
  const siriLightWrap = document.querySelector("#siriLightWrap");
  const recordDot = document.querySelector("#recordDot");
  const compactSpinner = document.querySelector("#compactSpinner");
  const siriCard = document.querySelector("#siriCard");
  const siriText = document.querySelector("#siriText");
  const siriLabel = document.querySelector(".dialog-copy span");
  const bottomWaveWrap = document.querySelector("#bottomWaveWrap");
  const searchPill = document.querySelector("#searchPill");
  const dock = document.querySelector("#dock");
  const weatherResponse = document.querySelector("#weatherResponse");
  const weatherText = document.querySelector(".weather-response > p");
  const weatherCard = document.querySelector("#weatherCard");
  const weatherGlow = document.querySelector(".weather-glow");
  const siriCanvas = document.querySelector("#siriCanvas");
  const waveCanvas = document.querySelector("#waveCanvas");

  if (!(root instanceof HTMLElement) || !(islandShell instanceof HTMLElement)) return;

  const noopRenderer = {
    resize() {},
    show() {},
    hide() {},
    setIntensity() {},
    destroy() {}
  };

  const siriRenderer =
    siriCanvas instanceof HTMLCanvasElement && typeof createSiriLightRenderer === "function"
      ? createSiriLightRenderer(siriCanvas)
      : noopRenderer;
  const waveRenderer =
    waveCanvas instanceof HTMLCanvasElement && typeof createBottomWaveRenderer === "function"
      ? createBottomWaveRenderer(waveCanvas)
      : noopRenderer;

  const totalDuration = 18400;
  const timers = [];
  let isPaused = false;

  function clearTimers() {
    while (timers.length) window.clearTimeout(timers.pop());
    window.clearTimeout(window.__dynamicIslandAppleClockTimer);
  }

  function schedule(at, action) {
    timers.push(
      window.setTimeout(() => {
        if (!isPaused) action();
      }, at)
    );
  }

  function readNumber(name, fallback) {
    const value = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
    return Number.isFinite(value) ? value : fallback;
  }

  function px(value) {
    return `${Math.round(value)}px`;
  }

  function glowIntensity() {
    return Math.min(1, Math.max(0, readNumber("--glow-intensity", 1)));
  }

  function shellStates() {
    const baseW = readNumber("--shell-base-width", 94);
    const baseH = readNumber("--shell-base-height", 29);
    const cardW = readNumber("--card-width", 348);

    return {
      capsule: {
        w: baseW,
        h: baseH,
        y: 18,
        radii: [999, 999, 999, 999, 999, 999, 999, 999]
      },
      blobA: {
        w: baseW + 56,
        h: baseH + 55,
        y: 18,
        radii: [72, 78, 68, 80, 50, 40, 48, 38]
      },
      blobB: {
        w: baseW + 48,
        h: baseH + 47,
        y: 21,
        radii: [67, 75, 64, 78, 43, 34, 42, 33]
      },
      blobC: {
        w: baseW + 54,
        h: baseH + 51,
        y: 21,
        radii: [75, 70, 66, 82, 40, 36, 45, 37]
      },
      overshootCard: {
        w: cardW + 22,
        h: 122,
        y: 40,
        radii: [34, 34, 34, 34, 34, 34, 34, 34]
      },
      undershootCard: {
        w: cardW - 12,
        h: 96,
        y: 44,
        radii: [31, 31, 31, 31, 31, 31, 31, 31]
      },
      finalCard: {
        w: cardW,
        h: 104,
        y: 42,
        radii: [32, 32, 32, 32, 32, 32, 32, 32]
      },
      compact: {
        w: baseW + 46,
        h: Math.max(35, baseH + 6),
        y: 18,
        radii: [999, 999, 999, 999, 999, 999, 999, 999]
      }
    };
  }

  function applyShell(state) {
    const style = document.documentElement.style;
    const [r1x, r2x, r3x, r4x, r1y, r2y, r3y, r4y] = state.radii;

    style.setProperty("--shell-w", px(state.w));
    style.setProperty("--shell-h", px(state.h));
    style.setProperty("--shell-y", px(state.y));
    style.setProperty("--r1x", px(r1x));
    style.setProperty("--r2x", px(r2x));
    style.setProperty("--r3x", px(r3x));
    style.setProperty("--r4x", px(r4x));
    style.setProperty("--r1y", px(r1y));
    style.setProperty("--r2y", px(r2y));
    style.setProperty("--r3y", px(r3y));
    style.setProperty("--r4y", px(r4y));
  }

  function setOpacity(element, opacity) {
    if (element instanceof HTMLElement) element.style.opacity = String(opacity);
  }

  function setTransform(element, transform) {
    if (element instanceof HTMLElement) element.style.transform = transform;
  }

  function setTranslate(element, translate) {
    if (element instanceof HTMLElement) element.style.translate = translate;
  }

  function resetInlineState() {
    setOpacity(siriLightWrap, 0);
    setOpacity(recordDot, 1);
    setOpacity(compactSpinner, 0);
    setOpacity(siriCard, 0);
    setOpacity(siriText, 0);
    setOpacity(siriLabel, 0);
    setOpacity(bottomWaveWrap, 0);
    setOpacity(searchPill, 0);
    setOpacity(dock, 0);
    setOpacity(weatherResponse, 0);
    setOpacity(weatherText, 0);
    setOpacity(weatherCard, 0);

    setTransform(recordDot, "scale(1)");
    setTransform(siriText, "translateY(8px)");
    setTransform(siriLabel, "translateY(6px)");
    setTransform(dock, "translateY(78px) scale(.92)");
    setTransform(weatherText, "translateY(-10px)");
    setTransform(weatherCard, "translateY(-23px) scale(.68, .22)");
    setTranslate(searchPill, "-50% 24px");

    if (weatherGlow instanceof HTMLElement) {
      weatherGlow.style.animation = "";
      weatherGlow.style.transform = "";
    }

    siriRenderer.setIntensity(0);
    siriRenderer.hide();
    waveRenderer.setIntensity(0);
    waveRenderer.hide();
  }

  function reset() {
    clearTimers();
    isPaused = false;
    root.classList.remove("is-playing");
    applyShell(shellStates().capsule);
    resetInlineState();
    if (clock) clock.textContent = "4:12";
  }

  function buildTimeline() {
    const states = shellStates();
    const light = glowIntensity();

    return [
      { at: 0, action: () => root.classList.add("is-playing") },
      { at: 920, action: () => applyShell(states.blobA) },
      {
        at: 950,
        action: () => {
          setOpacity(recordDot, 0);
          setTransform(recordDot, "scale(.35)");
          siriRenderer.show();
          siriRenderer.setIntensity(light);
        }
      },
      {
        at: 1120,
        action: () => {
          setOpacity(siriLightWrap, 1);
        }
      },
      { at: 1540, action: () => applyShell(states.blobB) },
      { at: 1900, action: () => applyShell(states.blobC) },
      { at: 3050, action: () => applyShell(states.blobB) },
      { at: 4000, action: () => applyShell(states.blobC) },
      { at: 5150, action: () => applyShell(states.blobB) },
      { at: 5280, action: () => applyShell(states.overshootCard) },
      {
        at: 5550,
        action: () => {
          setOpacity(siriLightWrap, 0);
          siriRenderer.setIntensity(0);
        }
      },
      { at: 5700, action: () => applyShell(states.undershootCard) },
      {
        at: 5720,
        action: () => {
          setOpacity(siriCard, 1);
        }
      },
      { at: 5920, action: () => applyShell(states.finalCard) },
      {
        at: 6020,
        action: () => {
          setOpacity(siriText, 1);
          setTransform(siriText, "translateY(0)");
          setOpacity(bottomWaveWrap, 1);
          waveRenderer.show();
          waveRenderer.setIntensity(light);
        }
      },
      {
        at: 6080,
        action: () => {
          setOpacity(siriLabel, 1);
          setTransform(siriLabel, "translateY(0)");
        }
      },
      {
        at: 9280,
        action: () => {
          setOpacity(searchPill, 1);
          setTranslate(searchPill, "-50% 0");
        }
      },
      {
        at: 9350,
        action: () => {
          setOpacity(dock, 1);
          setTransform(dock, "translateY(0) scale(1)");
        }
      },
      {
        at: 10950,
        action: () => {
          setOpacity(siriCard, 0);
          setOpacity(bottomWaveWrap, 0);
          waveRenderer.setIntensity(0);
          waveRenderer.hide();
        }
      },
      { at: 11420, action: () => applyShell(states.compact) },
      {
        at: 11740,
        action: () => {
          setOpacity(compactSpinner, 1);
        }
      },
      {
        at: 11100,
        action: () => {
          if (clock) clock.textContent = "4:13";
        }
      },
      {
        at: 13220,
        action: () => {
          setOpacity(compactSpinner, 0);
        }
      },
      {
        at: 13280,
        action: () => {
          setOpacity(weatherResponse, 1);
        }
      },
      {
        at: 13440,
        action: () => {
          setOpacity(weatherText, 1);
          setTransform(weatherText, "translateY(0)");
        }
      },
      {
        at: 13620,
        action: () => {
          setOpacity(weatherCard, 1);
          setTransform(weatherCard, "translateY(0) scale(1, 1)");
        }
      },
      {
        at: 14180,
        action: () => {
          if (weatherGlow instanceof HTMLElement)
            weatherGlow.style.animation = "weatherGlow 1.8s ease-in-out infinite";
        }
      }
    ];
  }

  function replay() {
    reset();
    void root.offsetWidth;
    for (const item of buildTimeline()) schedule(item.at, item.action);
  }

  function pause() {
    isPaused = true;
    clearTimers();
    for (const animation of document.getAnimations({ subtree: true })) animation.pause();
    siriRenderer.setIntensity(0);
    waveRenderer.setIntensity(0);
  }

  function seek(progress) {
    const nextProgress = Math.min(1, Math.max(0, Number(progress) || 0));
    const targetTime = totalDuration * nextProgress;
    reset();
    for (const item of buildTimeline()) {
      if (item.at <= targetTime) item.action();
    }
    for (const animation of document.getAnimations({ subtree: true })) {
      if (!animation.effect) continue;
      const timing = animation.effect.getComputedTiming();
      if (Number.isFinite(timing.duration)) animation.currentTime = timing.duration * nextProgress;
    }
  }

  window.motionReplay = replay;
  window.motionPause = pause;
  window.motionSeek = seek;

  requestAnimationFrame(replay);
  window.addEventListener("resize", () => {
    siriRenderer.resize();
    waveRenderer.resize();
  });
})();
