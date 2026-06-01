import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadBuiltinComponent, loadBuiltinComponents } from "./lazy";
import { EXTERNALIZED_BUILTIN_SOURCE_FILES } from "./assetStrategy";

const lazySource = readFileSync(new URL("./lazy.ts", import.meta.url), "utf8");

describe("lazy builtin component loading", () => {
  it("loads lightweight component records before source files", async () => {
    const components = await loadBuiltinComponents();
    const product = components.find((component) => component.id === "jd-product-transition-video");

    expect(product?.source.files).toEqual([{ path: "source/index.html", content: "", kind: "html" }]);
    expect(product?.manifest.params.length).toBeGreaterThan(0);
  });

  it("loads full source files for a selected component", async () => {
    const product = await loadBuiltinComponent("jd-product-transition-video");
    const assets = product?.source.files.find((file) => file.path === "source/assets.css");

    expect(product?.source.files.some((file) => file.path === "source/assets.css")).toBe(true);
    expect(product?.source.files.some((file) => file.path === "source/index.html")).toBe(true);
    expect(assets?.content).not.toContain("data:image");
  });

  it("keeps the heavy product-transition assets out of the raw source glob", () => {
    for (const filePath of EXTERNALIZED_BUILTIN_SOURCE_FILES) {
      expect(lazySource).toContain(`!${filePath}`);
      expect(lazySource).toContain(filePath);
    }
    expect(lazySource).toContain('query: "?url"');
  });
});
