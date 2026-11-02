// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { composeEditablePackageFiles, createReferenceGuidedComponent } from "@motion-tool/core";
import type { MotionComponent } from "@motion-tool/core";
import { useImportFlow } from "./useImportFlow";

vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

async function withImportFlow(run: (current: () => ReturnType<typeof useImportFlow>) => Promise<void>) {
  let state: ReturnType<typeof useImportFlow>;
  function Harness() {
    state = useImportFlow();
    return null;
  }
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(<Harness />));
  try {
    await run(() => state);
  } finally {
    await act(async () => root.unmount());
  }
}

function exportedProject() {
  const { component } = createReferenceGuidedComponent({ brief: "从左到右滑动的按钮", references: [] });
  const files = composeEditablePackageFiles({
    sourceFiles: Object.fromEntries(component.source.files.map((file) => [file.path, file.content])),
    manifest: component.manifest,
    metadata: { ...component, name: "我的按钮" },
    patch: {
      id: "edited",
      sourceManifestId: component.manifest.id,
      values: { travelDistance: 160, stale: 1 }
    }
  });
  return { component, files };
}

describe("editable package import", () => {
  it.each(["", "my-comp/"])("round trips the editing model through confirmation (%s)", async (prefix) => {
    const { component: original, files } = exportedProject();
    expect(original.manifest.params.length).toBeGreaterThan(0);
    expect(original.manifest.layers?.length).toBeGreaterThan(0);
    expect(original.manifest.motionRecipes?.length).toBeGreaterThan(0);
    await withImportFlow(async (current) => {
      const wrapped = Object.fromEntries(
        Object.entries(files).map(([path, content]) => [prefix + path, content])
      );
      await act(async () => current().importFiles(wrapped));
      expect(current().phase).toBe("confirm-params");
      expect(current().suggestedParams.map((param) => param.id)).toEqual(
        original.manifest.params.map((param) => param.id)
      );
      expect(current().metadataDefaults?.name).toBe("我的按钮");
      await act(async () => current().confirmParams());
      await act(async () => current().confirmLayers());
      let component: MotionComponent | null = null;
      await act(async () => {
        component = current().submitMetadata(current().metadataDefaults!);
      });
      expect(component).not.toBeNull();
      const restored = component! as MotionComponent;
      expect(restored.manifest.params).toEqual(
        original.manifest.params.map((param) =>
          param.id === "travelDistance" ? { ...param, default: 160, value: 160 } : param
        )
      );
      expect(restored.manifest.layers).toEqual(original.manifest.layers);
      expect(restored.manifest.motionRecipes).toEqual(original.manifest.motionRecipes);
      expect(restored.source.origin).toBe("imported");
      expect(restored.source.entry).toBe(original.source.entry);
      expect(restored.source.files).toEqual(
        original.source.files.map((file) => ({ ...file, content: files[file.path] }))
      );
      expect(restored.source.files.find((file) => file.kind === "css")?.content).toContain(
        "--travel-distance: 160vw"
      );
    });
  });

  it.each(["corrupt", "invalid-schema", "missing-entry"])(
    "rescans with a warning for %s",
    async (problem) => {
      const { files } = exportedProject();
      if (problem === "corrupt") files["motion.manifest.json"] = "{";
      if (problem === "invalid-schema") files["motion.manifest.json"] = '{"version":"2.0"}';
      if (problem === "missing-entry") delete files["source/index.html"];
      await withImportFlow(async (current) => {
        await act(async () => current().importFiles(files));
        expect(current().pendingImport?.files.length).toBeGreaterThan(0);
        expect(current().importWarnings).toEqual(
          expect.arrayContaining([expect.objectContaining({ code: "ignored-project" })])
        );
        expect(current().metadataDefaults).toBeNull();
      });
    }
  );

  it("keeps ordinary ZIP imports on the scan path", async () => {
    await withImportFlow(async (current) => {
      await act(async () =>
        current().importFiles({
          "index.html": "<main>普通组件</main>",
          "style.css": ":root { --size: 12px; }"
        })
      );
      expect(current().pendingImport?.files).toHaveLength(2);
      expect(current().suggestedParams.length).toBeGreaterThan(0);
      expect(current().importWarnings).toEqual([]);
      expect(current().metadataDefaults).toBeNull();
    });
  });
});
