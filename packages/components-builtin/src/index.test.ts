import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EXTERNALIZED_BUILTIN_SOURCE_FILES } from "./assetStrategy";

const indexSource = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

describe("builtin component entry loading", () => {
  it("keeps the heavy product-transition assets out of the eager raw source glob", () => {
    for (const filePath of EXTERNALIZED_BUILTIN_SOURCE_FILES) {
      expect(indexSource).toContain(`!${filePath}`);
      expect(indexSource).toContain(filePath);
    }
    expect(indexSource).toContain('query: "?url"');
  });
});
