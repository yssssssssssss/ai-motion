window.motionReplay = function motionReplay() {
  for (const element of document.querySelectorAll("[data-motion]")) {
    element.style.animation = "none";
    element.offsetHeight;
    element.style.animation = "";
  }
};
