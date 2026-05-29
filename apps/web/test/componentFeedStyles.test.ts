import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// 样式按职责拆分到 src/styles/ 子文件，本测试聚合相关文件后再做断言。
const tokens = readFileSync(new URL("../src/styles/tokens.css", import.meta.url), "utf8");
const home = readFileSync(new URL("../src/styles/home.css", import.meta.url), "utf8");
const base = readFileSync(new URL("../src/styles/base.css", import.meta.url), "utf8");
const editor = readFileSync(new URL("../src/styles/editor.css", import.meta.url), "utf8");
const styles = `${tokens}\n${base}\n${home}\n${editor}`;

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

  it("keeps primary button text readable while hovering", () => {
    expect(styles).toMatch(/\.primary-action:hover:not\(:disabled\)\s*{[^}]*background:\s*#000000/s);
    expect(styles).toMatch(/\.primary-action:hover:not\(:disabled\)\s*{[^}]*color:\s*#ffffff/s);
  });
});
