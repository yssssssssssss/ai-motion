import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createEmptyPatch } from "./state/projectStore";
import { EditorRoute } from "./routes/EditorRoute";
import { createReferenceGuidedComponent } from "@motion-tool/core";

const appSource = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");

describe("App bundle boundaries", () => {
  it("does not statically import heavy component libraries into the entry chunk", () => {
    expect(appSource).not.toMatch(
      /import\s+\{[^}]*builtinComponents[^}]*\}\s+from\s+["']@motion-tool\/components-builtin["']/
    );
    expect(appSource).not.toMatch(
      /import\s+\{[^}]*workEasyComponents[^}]*\}\s+from\s+["']\.\/data\/workeasyComponents["']/
    );
    expect(appSource).toContain("@motion-tool/components-builtin/src/lazy");
    expect(appSource).toContain("loadInitialComponents");
  });

  it("keeps user-added components when the async library load finishes later", () => {
    expect(appSource).toContain("setComponents((current) => mergeComponents(initialComponents, current))");
  });

  it("opens generated components as unsaved drafts before writing to the library", () => {
    expect(appSource).toContain("handleGeneratedComponentReady");
    expect(appSource).toContain("generatedDraftComponent");
    expect(appSource).toContain("saveGeneratedComponent");
    expect(appSource).toContain("onGeneratedComponentReady={handleGeneratedComponentReady}");
    expect(appSource).toMatch(
      /function handleGeneratedComponentReady[\s\S]*startProject[\s\S]*setIsGeneratedEditorOpen\(true\)/
    );
    expect(appSource).not.toMatch(/function handleGeneratedComponentReady[\s\S]*setComponents/);
  });

  it("saves generated drafts only from the modal save action", () => {
    expect(appSource).toMatch(/function saveGeneratedComponent[\s\S]*setComponents/);
    expect(appSource).toContain("保存组件");
    expect(appSource).toContain("closeGeneratedEditor");
  });

  it("wires motion recipe migration into the generated draft flow", () => {
    expect(appSource).toContain("applyMotionRecipeToComponent");
    expect(appSource).toContain("applyCurrentRecipeToTarget");
    expect(appSource).toContain("onApplyRecipeToTarget={applyCurrentRecipeToTarget}");
    expect(appSource).toMatch(/function applyCurrentRecipeToTarget[\s\S]*handleGeneratedComponentReady\(generated\)/);
  });

  it("renders a generated page-transition draft in the editor modal contract", () => {
    const result = createReferenceGuidedComponent({
      brief: "不要按钮，我要一个页面前后切换的进场动效，泛白弱一点",
      now: 1
    });
    const project = {
      id: `${result.component.id}-project`,
      source: result.component.source,
      manifest: result.component.manifest,
      patch: createEmptyPatch(result.component.manifest)
    };
    const html = renderToStaticMarkup(
      createElement(EditorRoute, {
        project,
        variant: "modal",
        onBack: () => {},
        onParamChange: () => {},
        onReplay: () => {},
        onResetParams: () => {},
        onSave: () => {},
        saveLabel: "保存组件"
      })
    );

    expect(result.validation.valid).toBe(true);
    expect(html).toContain("生成结果");
    expect(html).toContain("语义生成页面转场");
    expect(html).toContain("保存组件");
    expect(html).toContain('aria-label="动效预览"');
    expect(html).toContain('aria-label="参数面板"');
  });
});
