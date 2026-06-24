(() => {
  const root = document.querySelector("[data-motion-root]");

  if (!(root instanceof HTMLElement)) {
    return;
  }

  function createTextTabsController() {
    const tabs = Array.from(root.querySelectorAll(".tab-item")).filter(
      (item) => item instanceof HTMLButtonElement
    );
    const indicator = root.querySelector(".tab-indicator");

    if (!(indicator instanceof HTMLElement) || tabs.length === 0) {
      return null;
    }

    let activeIndex = tabs.findIndex((tab) => tab.classList.contains("is-active"));

    if (activeIndex < 0) {
      activeIndex = 0;
      tabs[0].classList.add("is-active");
      tabs[0].setAttribute("aria-selected", "true");
    }

    root.style.setProperty("--active-tab", String(activeIndex));

    function selectTab(nextIndex) {
      if (nextIndex === activeIndex) {
        return;
      }

      activeIndex = nextIndex;
      root.style.setProperty("--active-tab", String(activeIndex));
      indicator.classList.remove("is-moving");
      void indicator.offsetWidth;
      indicator.classList.add("is-moving");

      for (const [index, tab] of tabs.entries()) {
        const isActive = index === activeIndex;
        tab.classList.toggle("is-active", isActive);
        tab.setAttribute("aria-selected", String(isActive));
      }
    }

    for (const [index, tab] of tabs.entries()) {
      tab.addEventListener("click", () => selectTab(index));
    }

    indicator.addEventListener("animationend", () => {
      indicator.classList.remove("is-moving");
    });

    return {
      replay() {
        selectTab(activeIndex === 0 ? 1 : 0);
      }
    };
  }

  function createChannelTabsController() {
    const tabs = Array.from(root.querySelectorAll(".channel-tab")).filter(
      (item) => item instanceof HTMLButtonElement
    );
    const activeBg = root.querySelector(".channel-active-bg");
    const DURATION_MS = 220;
    const ACTIVE_BG_WIDTH = 128;
    let activeIndex = tabs.findIndex((tab) => tab.classList.contains("is-active"));
    let timeoutId;

    if (tabs.length === 0) {
      return null;
    }

    if (activeIndex < 0) {
      activeIndex = 0;
    }

    function clearMotionClasses() {
      for (const tab of tabs) {
        tab.classList.remove("is-activating", "is-deactivating");
      }
      activeBg?.classList.remove("is-moving");
      activeBg?.style.removeProperty("--channel-active-bg-from-x");
      activeBg?.style.removeProperty("--channel-active-bg-to-x");
      activeBg?.style.removeProperty("--channel-active-bg-overshoot-x");
    }

    function setPressedState() {
      for (const [index, tab] of tabs.entries()) {
        const isActive = index === activeIndex;
        tab.classList.toggle("is-active", isActive);
        tab.setAttribute("aria-pressed", String(isActive));
      }
    }

    function activeBgX(tab) {
      return tab.offsetLeft + tab.offsetWidth / 2 - ACTIVE_BG_WIDTH / 2;
    }

    function moveActiveBg(previousTab, nextTab) {
      if (!(activeBg instanceof HTMLElement)) {
        return;
      }

      const fromX = activeBgX(previousTab);
      const toX = activeBgX(nextTab);
      const delta = toX - fromX;
      const overshootX = delta === 0 ? toX : toX + Math.sign(delta) * 4;
      activeBg.style.setProperty("--channel-active-bg-from-x", `${fromX}px`);
      activeBg.style.setProperty("--channel-active-bg-to-x", `${toX}px`);
      activeBg.style.setProperty("--channel-active-bg-overshoot-x", `${overshootX}px`);
      activeBg.classList.remove("is-moving");
      void activeBg.offsetWidth;
      activeBg.classList.add("is-moving");
    }

    function settle(nextIndex) {
      clearMotionClasses();
      activeIndex = nextIndex;
      setPressedState();
      const activeTab = tabs[activeIndex];

      if (activeBg instanceof HTMLElement && activeTab instanceof HTMLElement) {
        activeBg.style.transform = `translateX(${activeBgX(activeTab)}px)`;
      }
    }

    function select(nextIndex) {
      if (nextIndex === activeIndex || nextIndex < 0 || nextIndex >= tabs.length) {
        return;
      }

      window.clearTimeout(timeoutId);
      const previousTab = tabs[activeIndex];
      const nextTab = tabs[nextIndex];

      if (!previousTab || !nextTab) {
        return;
      }

      clearMotionClasses();
      moveActiveBg(previousTab, nextTab);
      previousTab.classList.add("is-deactivating");
      nextTab.classList.add("is-activating");
      timeoutId = window.setTimeout(() => settle(nextIndex), DURATION_MS);
    }

    for (const [index, tab] of tabs.entries()) {
      tab.addEventListener("click", () => select(index));
    }

    setPressedState();

    return {
      replay() {
        select((activeIndex + 1) % tabs.length);
      },
      reverse() {
        select(activeIndex === 0 ? tabs.length - 1 : activeIndex - 1);
      }
    };
  }

  function createBottomTabbarController() {
    const items = Array.from(root.querySelectorAll(".bottom-tabbar-item")).filter(
      (item) => item instanceof HTMLButtonElement
    );
    const panel = root.querySelector(".bottom-tabbar-panel");
    const activeBg = root.querySelector(".bottom-tabbar-active-bg");
    const DURATION_MS = 300;
    const ITEM_STEP = 61.4;
    let activeIndex = items.findIndex((item) => item.classList.contains("is-active"));
    let timeoutId;

    if (items.length === 0) {
      return null;
    }

    if (activeIndex < 0) {
      activeIndex = 0;
    }

    function clearMotionClasses() {
      for (const item of items) {
        item.classList.remove("is-activating", "is-deactivating");
      }
      activeBg?.classList.remove("is-moving");
      activeBg?.style.removeProperty("--bottom-tabbar-bg-from-x");
      activeBg?.style.removeProperty("--bottom-tabbar-bg-to-x");
    }

    function setPressedState() {
      if (panel instanceof HTMLElement) {
        panel.style.setProperty("--bottom-tabbar-active-index", String(activeIndex));
      }

      for (const [index, item] of items.entries()) {
        const isActive = index === activeIndex;
        item.classList.toggle("is-active", isActive);
        item.setAttribute("aria-pressed", String(isActive));
      }
    }

    function moveActiveBg(previousIndex, nextIndex) {
      if (!(activeBg instanceof HTMLElement)) {
        return;
      }

      activeBg.style.setProperty("--bottom-tabbar-bg-from-x", `${previousIndex * ITEM_STEP}px`);
      activeBg.style.setProperty("--bottom-tabbar-bg-to-x", `${nextIndex * ITEM_STEP}px`);
      activeBg.classList.remove("is-moving");
      void activeBg.offsetWidth;
      activeBg.classList.add("is-moving");
    }

    function settle(nextIndex) {
      clearMotionClasses();
      activeIndex = nextIndex;
      setPressedState();
    }

    function select(nextIndex) {
      if (nextIndex === activeIndex || nextIndex < 0 || nextIndex >= items.length) {
        return;
      }

      window.clearTimeout(timeoutId);
      const previousItem = items[activeIndex];
      const nextItem = items[nextIndex];

      if (!previousItem || !nextItem) {
        return;
      }

      clearMotionClasses();
      previousItem.classList.remove("is-active");
      previousItem.classList.add("is-deactivating");
      nextItem.classList.add("is-activating");
      moveActiveBg(activeIndex, nextIndex);
      timeoutId = window.setTimeout(() => settle(nextIndex), DURATION_MS);
    }

    for (const [index, item] of items.entries()) {
      item.addEventListener("click", () => select(index));
    }

    setPressedState();

    return {
      replay() {
        setPressedState();
      },
      reverse() {
        setPressedState();
      }
    };
  }

  createTextTabsController();
  createChannelTabsController();
  const bottomTabbar = createBottomTabbarController();

  window.motionReplay = function motionReplay() {
    bottomTabbar?.replay();
  };
  window.motionReverse = function motionReverse() {
    bottomTabbar?.reverse();
  };
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
})();
