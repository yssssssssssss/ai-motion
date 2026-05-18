import { describe, expect, it } from "vitest";
import { importMotionSourceFromFiles } from "../src/import/sourceImporter";

describe("importMotionSourceFromFiles", () => {
  it("detects a single html file", () => {
    const result = importMotionSourceFromFiles({
      "index.html": "<!doctype html><html><body>Hello</body></html>"
    });

    expect(result.source.kind).toBe("single-html");
    expect(result.source.entry).toBe("index.html");
    expect(result.warnings).toEqual([]);
  });

  it("detects html package with css and js", () => {
    const result = importMotionSourceFromFiles({
      "index.html": '<link rel="stylesheet" href="style.css"><script src="script.js"></script>',
      "style.css": "body{}",
      "script.js": "console.log('ok')"
    });

    expect(result.source.kind).toBe("html-package");
    expect(result.source.files).toHaveLength(3);
  });
});
