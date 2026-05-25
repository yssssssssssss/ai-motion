import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// 样式按职责拆分到 src/styles/ 子文件，本测试聚合相关文件后再做断言。
const tokens = readFileSync(new URL("../src/styles/tokens.css", import.meta.url), "utf8");
const home = readFileSync(new URL("../src/styles/home.css", import.meta.url), "utf8");
const styles = `${tokens}\n${home}`;

describe("ComponentFeed styles", () => {
  it("uses the requested purple and blue palette", () => {
    expect(styles).toContain("--ink: #000a1c");
    expect(styles).toContain("--white: #ffffff");
    expect(styles).toContain("--violet-soft: #8f55fd");
    expect(styles).toContain("--violet: #6b36fa");
    expect(styles).toContain("--blue: #3544eb");
    expect(styles).toContain("--navy: #052474");
  });

  it("lets iframe previews receive pointer events for hover animations", () => {
    expect(styles).toMatch(/\.feed-preview-frame\s*{[^}]*pointer-events:\s*auto/s);
  });

  it("uses a larger thumbnail stage for complete component previews", () => {
    expect(styles).toMatch(/\.feed-grid\s*{[^}]*minmax\(220px,\s*1fr\)/s);
    expect(styles).toMatch(/\.feed-thumb\s*{[^}]*min-height:\s*180px/s);
    expect(styles).toMatch(/\.feed-preview-frame\s*{[^}]*height:\s*180px/s);
  });
});
