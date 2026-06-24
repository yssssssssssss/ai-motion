(() => {
  const root = document.querySelector("[data-motion-root]");
  const clock = document.querySelector("#clock");

  if (!(root instanceof HTMLElement)) return;

  function replay() {
    root.classList.remove("is-playing");
    // Force the CSS timeline to restart from frame zero.
    void root.offsetWidth;
    root.classList.add("is-playing");

    if (clock) {
      clock.textContent = "4:12";
      window.clearTimeout(window.__dynamicIslandClockTimer);
      window.__dynamicIslandClockTimer = window.setTimeout(() => {
        clock.textContent = "4:13";
      }, 11100);
    }
  }

  window.motionReplay = replay;
  window.motionPause = function motionPause() {
    for (const animation of document.getAnimations({ subtree: true })) animation.pause();
  };
  window.motionSeek = function motionSeek(progress) {
    const nextProgress = Math.min(1, Math.max(0, Number(progress) || 0));
    for (const animation of document.getAnimations({ subtree: true })) {
      if (!animation.effect) continue;
      const timing = animation.effect.getComputedTiming();
      if (Number.isFinite(timing.duration)) animation.currentTime = timing.duration * nextProgress;
    }
  };

  requestAnimationFrame(replay);
})();
