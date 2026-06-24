import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadBuiltinComponent, loadBuiltinComponents } from "./lazy";
import { EXTERNALIZED_BUILTIN_SOURCE_FILES } from "./assetStrategy";

const lazySource = readFileSync(new URL("./lazy.ts", import.meta.url), "utf8");
const componentsDir = resolve(import.meta.dirname, "..");

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

  it("loads the dynamic island design demo so it can appear in feeds", async () => {
    const components = await loadBuiltinComponents();
    const demo = components.find((component) => component.id === "dynamic-island-design-demo");
    const fullDemo = await loadBuiltinComponent("dynamic-island-design-demo");

    expect(demo?.name).toBe("灵动岛海浪光矩形展开");
    expect(demo?.tags).toContain("dynamic-island");
    expect(fullDemo?.source.files.map((file) => file.path)).toEqual(
      expect.arrayContaining(["source/index.html", "source/style.css", "source/script.js"])
    );
  });

  it("loads the apple fidelity slim dynamic island demo so it can appear in feeds", async () => {
    const components = await loadBuiltinComponents();
    const demo = components.find(
      (component) => component.id === "dynamic-island-design-demo-apple-fidelity-slim"
    );
    const fullDemo = await loadBuiltinComponent("dynamic-island-design-demo-apple-fidelity-slim");

    expect(demo?.name).toBe("灵动岛 Apple 高保真纤薄版");
    expect(demo?.tags).toEqual(expect.arrayContaining(["dynamic-island", "apple-fidelity"]));
    expect(fullDemo?.source.files.map((file) => file.path)).toEqual(
      expect.arrayContaining(["source/index.html", "source/style.css", "source/script.js"])
    );
  });

  it("keeps builtin feed display names unique and in sync with manifests", async () => {
    const components = await loadBuiltinComponents();
    const duplicateNames = components
      .map((component) => component.name)
      .filter((name, index, names) => names.indexOf(name) !== index);

    expect(duplicateNames).toEqual([]);

    for (const dir of readdirSync(componentsDir)) {
      const metadataPath = resolve(componentsDir, dir, "metadata.json");
      const manifestPath = resolve(componentsDir, dir, "motion.manifest.json");
      if (!existsSync(metadataPath) || !existsSync(manifestPath)) continue;

      const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      expect(manifest.name).toBe(metadata.name);
    }
  });

  it("keeps the heavy product-transition assets out of the raw source glob", () => {
    for (const filePath of EXTERNALIZED_BUILTIN_SOURCE_FILES) {
      expect(lazySource).toContain(`!${filePath}`);
      expect(lazySource).toContain(filePath);
    }
    expect(lazySource).toContain('query: "?url"');
  });
});
