import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { MotionManifest } from "@motion-tool/core";
import {
  DATA_URL_BUDGET_BYTES,
  EXTERNALIZED_BUILTIN_RAW_EXCLUDES,
  EXTERNALIZED_BUILTIN_SOURCE_FILES,
  INLINE_SOURCE_BUDGET_BYTES,
  ENTRY_CHUNK_BUDGET_BYTES,
  isManifestTargetFile,
  shouldExternalizeBuiltinSourceFile
} from "./assetStrategy";

const manifest: MotionManifest = {
  version: "1.0",
  id: "component",
  name: "Component",
  sourceKind: "builtin-component",
  runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
  params: [
    {
      id: "image",
      label: "Image",
      type: "image",
      default: "",
      status: "confirmed",
      targets: [
        { kind: "css-variable", file: "source/editable-assets.css", selector: ":root", name: "--image" }
      ]
    }
  ]
};

describe("builtin asset strategy", () => {
  it("externalizes large source files that are not editable targets", () => {
    expect(
      shouldExternalizeBuiltinSourceFile({
        filePath: "source/assets.css",
        content: "x".repeat(12),
        manifest,
        thresholdBytes: 10
      })
    ).toBe(true);
  });

  it("keeps editable target files inline even when they are large", () => {
    expect(isManifestTargetFile(manifest, "source/editable-assets.css")).toBe(true);
    expect(
      shouldExternalizeBuiltinSourceFile({
        filePath: "source/editable-assets.css",
        content: "x".repeat(12),
        manifest,
        thresholdBytes: 10
      })
    ).toBe(false);
  });

  it("keeps the static glob include and exclude lists in sync", () => {
    expect(EXTERNALIZED_BUILTIN_SOURCE_FILES.length).toBeGreaterThan(0);
    expect(EXTERNALIZED_BUILTIN_RAW_EXCLUDES).toEqual(
      EXTERNALIZED_BUILTIN_SOURCE_FILES.map((filePath) => `!${filePath}`)
    );
  });

  it("keeps inline source files and data URLs within declared budgets", () => {
    const root = resolve(__dirname, "..");
    const externalized = new Set(
      EXTERNALIZED_BUILTIN_SOURCE_FILES.map((path) => path.replace(/^\.\.\//, ""))
    );
    const budgetErrors: string[] = [];
    let inlineEntryBytes = 0;

    for (const componentId of readdirSync(root)) {
      const componentPath = resolve(root, componentId);
      if (!statSync(componentPath).isDirectory() || componentId === "src") continue;
      const sourcePath = resolve(componentPath, "source");
      if (!existsSync(resolve(componentPath, "motion.manifest.json")) || !existsSync(sourcePath)) continue;

      for (const fileName of readdirSync(sourcePath)) {
        const relativePath = `${componentId}/source/${fileName}`;
        const absolutePath = resolve(sourcePath, fileName);
        if (!statSync(absolutePath).isFile() || externalized.has(relativePath)) continue;

        const content = readFileSync(absolutePath, "utf8");
        inlineEntryBytes += Buffer.byteLength(content, "utf8");
        if (Buffer.byteLength(content, "utf8") > INLINE_SOURCE_BUDGET_BYTES) {
          budgetErrors.push(`${relativePath} exceeds inline source budget`);
        }
        for (const match of content.matchAll(/data:[^"')\s]+/g)) {
          if (Buffer.byteLength(match[0], "utf8") > DATA_URL_BUDGET_BYTES) {
            budgetErrors.push(`${relativePath} contains an oversized inline data URL`);
          }
        }
      }
    }

    expect(budgetErrors).toEqual([]);
    expect(inlineEntryBytes).toBeLessThanOrEqual(ENTRY_CHUNK_BUDGET_BYTES);
  });
});
