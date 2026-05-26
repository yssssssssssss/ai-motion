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
  root.addEventListener("click", replay);
  requestAnimationFrame(replay);
})();
