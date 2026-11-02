import { describe, expect, it } from "vitest";
import { composeEditablePackageFiles } from "../export/exportPackage";
import { importEditablePackageFromFiles, importMotionSourceFromFiles } from "./sourceImporter";
import type { MotionManifest } from "../manifest/types";

const manifest: MotionManifest = {
  version: "1.0",
  id: "project",
  name: "项目",
  sourceKind: "html-package",
  runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
  params: [
    {
      id: "duration",
      label: "时长",
      type: "duration",
      default: 600,
      status: "confirmed",
      constraints: { unit: "ms" },
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--duration" }]
    }
  ]
};

function projectFiles() {
  return composeEditablePackageFiles({
    manifest,
    sourceFiles: {
      "source/index.html": '<main>组件</main><script src="https://unsafe.test/script.js"></script>',
      "source/style.css": ":root { --duration: 600ms; } main { animation-duration: var(--duration); }",
      "source/script.js": "document.cookie; eval('1');",
      "source/data.json": '{"keep":true}'
    },
    metadata: { id: "project", name: "项目", origin: "builtin" },
    patch: { id: "patch", sourceManifestId: manifest.id, values: { duration: 900, unknown: 1 } }
  });
}

describe("editable package recognition", () => {
  it("sanitizes untrusted source, preserves source JSON, and rebases without applying the patch twice", () => {
    const files = projectFiles();
    const before = { ...files };
    const result = importEditablePackageFromFiles(files);
    expect(result).not.toBeNull();
    expect(result!.source.origin).toBe("imported");
    expect(result!.source.files).toHaveLength(4);
    expect(result!.source.files.find((file) => file.kind === "html")?.content).toBe("<main>组件</main>");
    expect(result!.source.files.find((file) => file.kind === "css")?.content).toContain("--duration: 900ms");
    expect(result!.source.files.find((file) => file.kind === "json")?.path).toBe("source/data.json");
    expect(result!.manifest.params).toEqual([{ ...manifest.params[0], default: 900, value: 900 }]);
    expect(result!.metadata.name).toBe("项目");
    expect(result!.patch?.values).toEqual({ duration: 900, unknown: 1 });
    expect(result!.warnings.filter((warning) => warning.code === "unsafe-content")).toHaveLength(3);
    expect(result!.warnings.some((warning) => warning.code === "sub-directory-entry")).toBe(false);
    expect(files).toEqual(before);
  });

  it("imports a clean editable package without a subdirectory warning while ordinary imports retain it", () => {
    const sourceFiles = {
      "source/index.html": "<main>组件</main>",
      "source/style.css": ":root { --duration: 600ms; } main { animation-duration: var(--duration); }"
    };
    const files = composeEditablePackageFiles({
      manifest,
      sourceFiles,
      metadata: { id: "project", name: "项目" },
      patch: { id: "patch", sourceManifestId: manifest.id, values: {} }
    });
    const result = importEditablePackageFromFiles(files);
    expect(result).not.toBeNull();
    expect(result!.warnings).toEqual([]);
    expect(importMotionSourceFromFiles(sourceFiles).warnings.map((warning) => warning.code)).toEqual([
      "sub-directory-entry"
    ]);
  });

  it.each(["{", "null", '{"values":null}', '{"id":"patch","sourceManifestId":"project","values":[]}'])(
    "ignores malformed patch %s without losing the manifest",
    (patch) => {
      const result = importEditablePackageFromFiles({ ...projectFiles(), "motion.patch.json": patch });
      expect(result).not.toBeNull();
      expect(result!.manifest.params).toEqual(manifest.params);
      expect(result!.source.files.length).toBeGreaterThan(0);
      expect(result!.patch).toBeNull();
    }
  );

  it("resolves all package content relative to the wrapper and ignores files outside it", () => {
    const files = Object.fromEntries(
      Object.entries(projectFiles()).map(([path, value]) => ["wrapped/" + path, value])
    );
    const result = importEditablePackageFromFiles({ ...files, "unrelated.html": "outside" });
    expect(result).not.toBeNull();
    expect(result!.source.entry).toBe("source/index.html");
    expect(result!.source.files).toHaveLength(4);
    expect(result!.source.files.every((file) => file.path.startsWith("source/"))).toBe(true);
  });

  it.each([
    "{",
    '{"version":"2.0"}',
    JSON.stringify({ ...manifest, runtime: { ...manifest.runtime, entry: "missing.html" } })
  ])("returns null for invalid projects and warns on the scan path", (content) => {
    const files = { ...projectFiles(), "motion.manifest.json": content };
    expect(importEditablePackageFromFiles(files)).toBeNull();
    const fallback = importMotionSourceFromFiles(files);
    expect(fallback.source.files.length).toBeGreaterThan(0);
    expect(fallback.warnings.some((warning) => warning.code === "ignored-project")).toBe(true);
  });
});
