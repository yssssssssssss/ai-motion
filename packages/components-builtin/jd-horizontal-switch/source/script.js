(() => {
  const root = document.querySelector("[data-motion-root]");

  if (!(root instanceof HTMLElement)) {
    return;
  }

  function replay() {
    root.classList.remove("is-playing");
    void root.offsetWidth;
    root.classList.add("is-playing");
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
  root.addEventListener("click", replay);
  requestAnimationFrame(replay);
})();
