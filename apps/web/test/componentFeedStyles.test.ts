import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

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
