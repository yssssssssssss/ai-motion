import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const currentDir = dirname(fileURLToPath(import.meta.url));
const componentDir = resolve(currentDir, "../jd-horizontal-switch");

function readComponentFile(path) {
  return readFileSync(resolve(componentDir, path), "utf8");
}

describe("jd horizontal switch component", () => {
  it("rebuilds the APNG as coded layers with a clickable tab navigation", () => {
    const html = readComponentFile("source/index.html");
    const script = readComponentFile("source/script.js");
    const assets = readComponentFile("source/assets.css");

    expect(html).not.toContain("<video");
    expect(html).toContain('<span class="joy-agent" aria-hidden="true">');
    expect(html).toContain('class="joy-agent-image"');
    expect(html).toContain(
      "https://img20.360buyimg.com/img/jfs/t1/458414/18/12592/185791/6a394f58F40ad981b/0276210210a38efd.png"
    );
    expect(script).not.toContain("HTMLVideoElement");
    expect(script).not.toContain("requestAnimationFrame");
    expect(html).toContain("data-motion-root");
    expect(html).toContain("screen-window");
    expect(html).toContain("tab-nav");
    expect(html).toContain("tab-indicator");
    expect(html).toContain("channel-tabs");
    expect(html).toContain("channel-icon-alarm");
    expect(html).toContain("bottom-tabbar");
    expect(html).toContain("bottom-tabbar-active-bg");
    expect(html).toContain("bottom-tabbar-item is-active");
    expect(html).toContain('aria-pressed="true" data-bottom-tab="0"');
    expect(html).toContain('data-motion="bottomTabbarLabel1">首页');
    expect(html).toContain('data-motion="channelTabLabel2">秒杀');
    expect(html).toContain('aria-selected="true" data-tab="1"');
    expect(script).toContain("selectTab(index)");
    expect(script).toContain("createChannelTabsController");
    expect(script).toContain("createBottomTabbarController");
    expect(script).toContain('classList.add("is-activating")');
    expect(script).toContain('previousTab.classList.add("is-deactivating")');
    expect(script).toContain('activeBg.style.setProperty("--bottom-tabbar-bg-from-x"');
    expect(script).toContain('activeBg.style.setProperty("--bottom-tabbar-bg-to-x"');
    expect(script).toContain("window.motionReplay");
    expect(script).toContain("setPressedState();");
    expect(script).not.toContain("select((activeIndex + 1) % items.length);");
    expect(script).not.toContain("channelTabs?.replay();");
    expect(script).not.toContain("textTabs?.replay();");
    expect(assets).toContain('--shell-frame: url("data:image/webp;base64,');
    expect(assets).toContain('--start-screen: url("data:image/webp;base64,');
    expect(assets).toContain("start-screen-source: frame_0001_crop_213_222_1118_2417");
  });

  it("uses the APNG canvas, screen window, and tab navigation timing", () => {
    const style = readComponentFile("source/style.css");

    expect(style).toContain("--stage-width: 1545px;");
    expect(style).toContain("--stage-height: 2868px;");
    expect(style).toContain("aspect-ratio: 1545 / 2868;");
    expect(style).toContain("--window-x: 213px;");
    expect(style).toContain("--window-y: 222px;");
    expect(style).toContain("--window-width: 1118px;");
    expect(style).toContain("--window-height: 2417px;");
    expect(style).toContain("--tab-gap: 336px;");
    expect(style).toContain("--tab-active-color: #e60012;");
    expect(style).toContain("--tab-inactive-color: #11141a;");
    expect(style).toContain("--channel-motion-duration: 200ms;");
    expect(style).toContain("--channel-tabs-width: 375px;");
    expect(style).toContain("--channel-tabs-height: 75px;");
    expect(style).toContain("--channel-tab-active-width: 128px;");
    expect(style).toContain("--channel-tab-icon-overshoot-size: 46px;");
    expect(style).toContain("--bottom-tabbar-motion-duration: 300ms;");
    expect(style).toContain("--bottom-tabbar-motion-easing: cubic-bezier(0.38, 0, 0.24, 1);");
    expect(style).toContain("--bottom-tabbar-size-easing: cubic-bezier(0.8, 0, 0.24, 1);");
    expect(style).toContain("--bottom-tabbar-item-step: 61.4px;");
    expect(style).toContain("--bottom-tabbar-item-width: 65.4px;");
    expect(style).toContain("--bottom-tabbar-item-overshoot-width: 80.4px;");
    expect(style).toContain("--bottom-tabbar-active-color: #ff0f23;");
    expect(style).toContain("--bottom-tabbar-active-bg: #f2f4f7;");
    expect(style).toContain("width: 52px;");
    expect(style).toContain("height: 52px;");
    expect(style).toContain(".joy-agent-image");
    expect(style).toContain("left: -24px;");
    expect(style).toContain("width: 100px;");
    expect(style).toContain("--bottom-tabbar-icon-inactive:");
    expect(style).toContain("--bottom-tabbar-icon-active:");
    expect(style).toContain("--bottom-tabbar-icon-active-detail:");
    expect(style).toContain("transition: transform 300ms var(--motion-easing);");
    expect(style).toContain("transition: color 120ms var(--color-easing) 80ms;");
    expect(style).toContain(
      "animation: channel-active-bg-move var(--channel-motion-duration) var(--motion-easing) both;"
    );
    expect(style).toContain("animation: bottom-tabbar-bg-move var(--bottom-tabbar-motion-duration)");
    expect(style).toContain("animation: bottom-tabbar-size-pulse var(--bottom-tabbar-motion-duration)");
    expect(style).toContain("animation: bottom-tabbar-icon-in var(--bottom-tabbar-motion-duration)");
    expect(style).toContain('--channel-active-bg: url("data:image/svg+xml,');
    expect(style).toContain("background: #ff0031;");
    expect(style).toContain("transform: translateX(42px);");
    expect(style).toContain(".channel-tab:nth-of-type(6)");
    expect(style).toContain("@keyframes channel-tab-icon-in");
    expect(style).toContain("@keyframes channel-tab-icon-out");
    expect(style).toContain("@keyframes channel-tab-name-out");
    expect(style).toContain("@keyframes bottom-tabbar-bg-move");
    expect(style).toContain("@keyframes bottom-tabbar-size-pulse");
    expect(style).toContain("transform: translateX(var(--bottom-tabbar-bg-from-x, 0px));");
    expect(style).toContain("transform: translateX(var(--bottom-tabbar-bg-to-x, 0px));");
    expect(style).toContain(
      "transform: scaleX(calc(var(--bottom-tabbar-item-overshoot-width) / var(--bottom-tabbar-item-width)));"
    );
    expect(style).toContain("font-weight: 600;");
    expect(style).toContain("background-image: var(--bottom-tabbar-icon-inactive);");
    expect(style).toContain("background-image: var(--bottom-tabbar-icon-active);");
    expect(style).toContain("background-image: var(--bottom-tabbar-icon-active-detail);");
    expect(style).toContain("object-fit: contain;");
    expect(style).not.toContain("border-top: 2px solid currentColor;");
    expect(style).not.toContain("box-shadow: inset 0 -4px 0 #fff;");
    expect(style).not.toContain(".joy-agent::before");
    expect(style).not.toContain(".bottom-tabbar-item::before");
    expect(style.match(/background-image: url\("data:image\/png;base64,/g)).toHaveLength(6);
    expect(style).not.toContain("clip-path");
    expect(style).toContain("26.666% {");
    expect(style).toContain("transform: scaleX(2);");
  });

  it("exposes tab navigation layout and visual controls", () => {
    const manifest = JSON.parse(readComponentFile("motion.manifest.json"));
    const paramById = Object.fromEntries(manifest.params.map((param) => [param.id, param]));

    expect(paramById.tabGap.default).toBe(336);
    expect(paramById.tabStartX.default).toBe(398);
    expect(paramById.tabY.default).toBe(118);
    expect(paramById.tabTextWidth.default).toBe(160);
    expect(paramById.indicatorWidth.default).toBe(16);
    expect(paramById.channelMotionDuration.default).toBe(200);
    expect(paramById.channelTabLabel2.default).toBe("秒杀");
    expect(paramById.channelTabLabel6.default).toBe("临期清仓");
    expect(paramById.bottomTabbarMotionDuration.default).toBe(300);
    expect(paramById.bottomTabbarMotionEasing.default).toBe("cubic-bezier(0.38, 0, 0.24, 1)");
    expect(paramById.bottomTabbarSizeEasing.default).toBe("cubic-bezier(0.8, 0, 0.24, 1)");
    expect(paramById.bottomTabbarActiveColor.default).toBe("#ff0f23");
    expect(paramById.bottomTabbarActiveBg.default).toBe("#f2f4f7");
    expect(paramById.bottomTabbarLabel2.default).toBe("首页");
    expect(paramById.easing.default).toBe("cubic-bezier(0.38, 0, 0.24, 1)");
    expect(manifest.motionRecipes?.[0]?.trigger).toBe("click");
    expect(manifest.motionRecipes?.[0]?.recipeName).toBe("横向切换 / Tab导航");
    expect(manifest.motionRecipes?.[1]?.trigger).toBe("click");
    expect(manifest.motionRecipes?.[1]?.recipeName).toBe("横向切换 / 频道Tab");
    expect(manifest.motionRecipes?.[1]?.targetSelectors).toContain(".channel-tabs");
    expect(manifest.motionRecipes?.[2]?.trigger).toBe("click");
    expect(manifest.motionRecipes?.[2]?.recipeName).toBe("横向切换 / Tabbar底导");
    expect(manifest.motionRecipes?.[2]?.targetSelectors).toContain(".bottom-tabbar");
    expect(
      manifest.params.every((param) =>
        param.targets.some(
          (target) =>
            (target.kind === "css-variable" && target.name?.startsWith("--")) || target.kind === "html-text"
        )
      )
    ).toBe(true);
  });
});
