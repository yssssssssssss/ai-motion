function setPlaybackState(state) {
  for (const element of document.querySelectorAll("[data-motion]")) {
    element.style.animationPlayState = state;
  }
}

window.motionReplay = function motionReplay() {
  for (const element of document.querySelectorAll("[data-motion]")) {
    element.style.animation = "none";
    element.offsetHeight;
    element.style.animation = "";
  }
  setPlaybackState("running");
};

window.motionPause = function motionPause() {
  setPlaybackState("paused");
};

window.motionSeek = function motionSeek(progress) {
  const nextProgress = Math.min(1, Math.max(0, Number(progress) || 0));
  for (const animation of document.getAnimations({ subtree: true })) {
    if (!animation.effect) continue;
    const timing = animation.effect.getComputedTiming();
    if (Number.isFinite(timing.duration)) animation.currentTime = timing.duration * nextProgress;
  }
};
