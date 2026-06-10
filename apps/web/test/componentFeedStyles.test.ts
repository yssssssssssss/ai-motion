import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// 样式按职责拆分到 src/styles/ 子文件，本测试聚合相关文件后再做断言。
const tokens = readFileSync(new URL("../src/styles/tokens.css", import.meta.url), "utf8");
const home = readFileSync(new URL("../src/styles/home.css", import.meta.url), "utf8");
const base = readFileSync(new URL("../src/styles/base.css", import.meta.url), "utf8");
const editor = readFileSync(new URL("../src/styles/editor.css", import.meta.url), "utf8");
const motion = readFileSync(new URL("../src/styles/motion.css", import.meta.url), "utf8");
const responsive = readFileSync(new URL("../src/styles/responsive.css", import.meta.url), "utf8");
const styles = `${tokens}\n${base}\n${home}\n${editor}\n${motion}`;

describe("ComponentFeed styles", () => {
  it("uses a restrained neutral palette with one action blue", () => {
    expect(styles).toContain("--ink: #050505");
    expect(styles).toContain("--white: #ffffff");
    expect(styles).toContain("--surface: #f5f5f4");
    expect(styles).toContain("--panel-muted: #eeeeec");
    expect(styles).toContain("--accent: #0071e3");
    expect(styles).toContain("--hero-bg: #060606");
  });

  it("lets iframe previews receive pointer events for hover animations", () => {
    expect(styles).toMatch(/\.feed-preview-frame\s*{[^}]*pointer-events:\s*auto/s);
    expect(styles).toMatch(/\.recommendation-preview-frame\s*{[^}]*pointer-events:\s*auto/s);
  });

  it("uses a larger thumbnail stage for complete component previews", () => {
    expect(styles).toMatch(/\.feed-grid\s*{[^}]*minmax\(230px,\s*1fr\)/s);
    expect(styles).toMatch(/\.feed-thumb\s*{[^}]*min-height:\s*180px/s);
    expect(styles).toMatch(/\.feed-preview-frame\s*{[^}]*height:\s*180px/s);
  });

  it("keeps the hero short enough for the feed to peek into the first viewport", () => {
    expect(styles).toMatch(
      /\.discovery-panel\s*{[^}]*min-height:\s*min\(560px,\s*calc\(100svh - 52px\)\)/s
    );
    expect(styles).toMatch(/\.recommendation-strip,\s*\.feed-panel\s*{[^}]*padding:\s*62px 0 18px/s);
  });

  it("keeps recommendation and generation tab entry timing aligned", () => {
    expect(styles).toMatch(/\.brief-stack\s*{[^}]*animation:\s*hero-rise 720ms ease-out both/s);
    expect(styles).toMatch(/\.brief-stack\.is-generate-stack,\s*\.brief-stack\.is-atomic-stack\s*{/s);
    expect(styles).toMatch(/\.background-gradient-animation\s*{[^}]*transition:\s*opacity 720ms ease/s);
    expect(styles).not.toContain("sci-panel-enter");
  });

  it("keeps atomic motion parameters embedded in the shared three-tab hero", () => {
    expect(home).toMatch(/\.brief-mode-tabs\s*{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s);
    expect(home).toContain(".discovery-panel.is-atomic-mode");
    expect(home).toContain(".brief-content-region.is-atomic-content");
    expect(home).toContain(".ethereal-shadow-background");
    expect(home).toContain(".ethereal-shadow-mask");
    expect(home).toContain(".ethereal-shadow-noise");
    expect(home).toContain("filter: url(#ethereal-shadow-filter)");
    expect(home).toContain("mask-image");
    expect(home).toContain("@keyframes ethereal-shadow-drift");
    expect(home).toContain("@keyframes ethereal-noise-drift");
    expect(home).toMatch(/\.ethereal-shadow-field\s*{[^}]*animation:\s*ethereal-shadow-drift 5s/s);
    expect(home).toMatch(/\.ethereal-shadow-noise\s*{[^}]*animation:\s*ethereal-noise-drift 3s/s);
    expect(home).toContain(".atomic-motion-element-grid");
    expect(home).toContain(".atomic-motion-variant-tray");
    expect(home).toMatch(/\.atomic-motion-option:hover:not\(:disabled\)\s*{[^}]*background:\s*rgba\(126,\s*34,\s*206,\s*0\.2\)/s);
    expect(home).toMatch(/\.atomic-motion-option\.is-on:hover:not\(:disabled\)\s*{[^}]*background:\s*rgba\(126,\s*34,\s*206,\s*0\.34\)/s);
    expect(home).toMatch(
      /\.discovery-panel\.is-generate-mode \.brief-mode-tab\.is-on,\s*\.discovery-panel\.is-atomic-mode \.brief-mode-tab\.is-on\s*{[^}]*color:\s*var\(--brief-active-tab-color\)/s
    );
    expect(home).toContain("@keyframes brief-content-enter");
    expect(home).toContain("@keyframes atomic-content-expand");
    expect(home).not.toContain(".atomic-motion-backdrop");
    expect(home).not.toContain(".atomic-motion-button");
  });

  it("keeps primary button text readable while hovering", () => {
    expect(styles).toMatch(/\.primary-action:hover:not\(:disabled\)\s*{[^}]*background:\s*#000000/s);
    expect(styles).toMatch(/\.primary-action:hover:not\(:disabled\)\s*{[^}]*color:\s*#ffffff/s);
  });

  it("allocates more editor width to the inspector and groups it with high-level tabs", () => {
    expect(editor).toContain("grid-template-columns: minmax(380px, 0.82fr) clamp(420px, 38vw, 560px)");
    expect(editor).toContain(".inspector-tabs");
    expect(editor).toMatch(/\.inspector-tabs\s*{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/s);
    expect(editor).toContain(".inspector-tab-panel");
  });

  it("keeps the editor preview visible while the inspector scrolls", () => {
    expect(editor).toMatch(/\.editor-shell\s*{[^}]*--editor-preview-sticky-offset:\s*0px/s);
    expect(editor).toMatch(/\.editor-shell\.is-modal\s*{[^}]*--editor-preview-sticky-offset:\s*72px/s);
    expect(editor).toMatch(/\.editor-preview\s*{[^}]*position:\s*sticky/s);
    expect(editor).toMatch(/\.editor-preview\s*{[^}]*top:\s*var\(--editor-preview-sticky-offset\)/s);
    expect(editor).toMatch(/\.editor-preview\s*{[^}]*max-height:\s*calc\(100svh - var\(--editor-preview-sticky-offset\)\)/s);
    expect(responsive).toMatch(/\.editor-preview\s*{[^}]*position:\s*static/s);
    expect(responsive).toMatch(/\.editor-preview\s*{[^}]*overflow:\s*visible/s);
  });

  it("uses a black upload button in the home header", () => {
    expect(styles).toMatch(/\.home-upload-button\s*{[^}]*background:\s*#050505/s);
    expect(styles).toMatch(/\.home-upload-button\s*{[^}]*color:\s*#ffffff/s);
    expect(styles).toMatch(/\.home-upload-button:hover:not\(:disabled\)\s*{[^}]*background:\s*#000000/s);
  });
});
