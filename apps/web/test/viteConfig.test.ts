import { describe, expect, it } from "vitest";
import { builtinComponentChunk } from "../vite.config";

describe("vite chunking", () => {
  it("splits builtin component assets by component directory", () => {
    expect(
      builtinComponentChunk(
        "/Users/demo/project/packages/components-builtin/jd-product-transition-video/source/assets.css?raw"
      )
    ).toBe("builtin-jd-product-transition-video");
    expect(
      builtinComponentChunk(
        "/Users/demo/project/packages/components-builtin/hero-text-reveal/source/style.css?raw"
      )
    ).toBe("builtin-hero-text-reveal");
    expect(
      builtinComponentChunk("/Users/demo/project/packages/components-builtin/src/lazy.ts")
    ).toBeUndefined();
  });
});
