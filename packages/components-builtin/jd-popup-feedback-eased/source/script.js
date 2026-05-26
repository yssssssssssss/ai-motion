(() => {
  const root = document.querySelector("[data-motion-root]");

  if (!(root instanceof HTMLElement)) {
    return;
  }

  const dim = root.querySelector(".screen-dim");
  const popup = root.querySelector(".coupon-popup");
  const closeButton = root.querySelector(".close-button");
  let activeAnimations = [];

  function readVar(name, fallback) {
    const value = getComputedStyle(root).getPropertyValue(name).trim();
    return value || fallback;
  }

  function readMs(name, fallback) {
    const value = readVar(name, `${fallback}ms`);
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) return fallback;
    return value.endsWith("s") && !value.endsWith("ms") ? parsed * 1000 : parsed;
  }

  function readNumber(name, fallback) {
    const parsed = Number.parseFloat(readVar(name, String(fallback)));
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function offsetAt(milliseconds, cycleDuration) {
    return clamp(milliseconds / cycleDuration, 0, 0.98);
  }

  function stopAnimations() {
    for (const animation of activeAnimations) animation.cancel();
    activeAnimations = [];
  }

  function animateLayer(element, keyframes, options) {
    if (!(element instanceof HTMLElement)) return;
    activeAnimations.push(element.animate(keyframes, options));
  }

  function buildAnimation() {
    const cycleDuration = Math.max(800, readMs("--cycle-duration", 3000));
    const startDelay = clamp(readMs("--start-delay", 270), 0, cycleDuration * 0.75);
    const enterDuration = clamp(readMs("--enter-duration", 540), 120, cycleDuration - startDelay);
    const enterStart = offsetAt(startDelay, cycleDuration);
    const enterEnd = clamp(offsetAt(startDelay + enterDuration, cycleDuration), enterStart + 0.01, 0.98);
    const closeStart = enterStart + (enterEnd - enterStart) * 0.5;
    const dimOpacity = clamp(readNumber("--dim-opacity", 0.68), 0, 1);
    const startScale = Math.max(0.01, readNumber("--start-scale", 1.08));
    const motionEasing = readVar("--motion-easing", "cubic-bezier(0.16, 0.9, 0.2, 1)");
    const timing = { duration: cycleDuration, iterations: Infinity, fill: "both", easing: "linear" };

    animateLayer(
      dim,
      [
        { offset: 0, opacity: 0 },
        { offset: enterStart, opacity: 0, easing: motionEasing },
        { offset: enterEnd, opacity: dimOpacity },
        { offset: 1, opacity: dimOpacity }
      ],
      timing
    );

    animateLayer(
      popup,
      [
        { offset: 0, opacity: 0, transform: `scale(${startScale})` },
        { offset: enterStart, opacity: 0, transform: `scale(${startScale})`, easing: motionEasing },
        { offset: enterEnd, opacity: 1, transform: "scale(1)" },
        { offset: 1, opacity: 1, transform: "scale(1)" }
      ],
      timing
    );

    animateLayer(
      closeButton,
      [
        { offset: 0, opacity: 0, transform: "scale(0.92)" },
        { offset: closeStart, opacity: 0, transform: "scale(0.92)", easing: motionEasing },
        { offset: enterEnd, opacity: 1, transform: "scale(1)" },
        { offset: 1, opacity: 1, transform: "scale(1)" }
      ],
      timing
    );
  }

  function replay() {
    stopAnimations();
    root.classList.remove("is-playing");
    void root.offsetWidth;
    root.classList.add("is-playing");
    buildAnimation();
  }

  function play() {
    if (activeAnimations.length === 0) buildAnimation();
    for (const animation of activeAnimations) animation.play();
  }

  function pause() {
    for (const animation of activeAnimations) animation.pause();
  }

  window.motionReplay = replay;
  window.motionPlay = play;
  window.motionPause = pause;
  root.addEventListener("click", replay);
  requestAnimationFrame(replay);
})();
