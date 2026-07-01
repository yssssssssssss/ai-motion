import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createEmptyPatch } from "./state/projectStore";
import { EditorRoute } from "./routes/EditorRoute";
import { createReferenceGuidedComponent, type MotionComponent } from "@motion-tool/core";
import { removeComponentById } from "./App";
import { generateAtomicMotionComponent } from "./services/atomicMotionGeneration";

const appSource = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");

function makeComponent(id: string): MotionComponent {
  return {
    id,
    name: id,
    category: "interaction",
    tags: [],
    useCases: [],
    moods: [],
    manifest: {
      version: "1.0",
      id,
      name: id,
      sourceKind: "builtin-component",
      runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
      params: []
    },
    source: {
      id,
      origin: "builtin",
      kind: "builtin-component",
      entry: "source/index.html",
      files: [{ path: "source/index.html", content: "<main></main>", kind: "html" }]
    }
  };
}

function makeProject(component: MotionComponent) {
  return {
    id: `${component.id}-project`,
    source: component.source,
    manifest: component.manifest,
    patch: createEmptyPatch(component.manifest)
  };
}

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
    const readyHandler = appSource.match(/function handleGeneratedComponentReady[\s\S]*?\n  }/)?.[0] ?? "";

    expect(appSource).toContain("handleGeneratedComponentReady");
    expect(appSource).toContain("generatedDraftComponent");
    expect(appSource).toContain("saveGeneratedComponent");
    expect(appSource).toContain("onGeneratedComponentReady={handleGeneratedComponentReady}");
    expect(readyHandler).toContain("startProject");
    expect(readyHandler).toContain("setIsGeneratedEditorOpen(true)");
    expect(readyHandler).not.toContain("setComponents");
  });

  it("owns the home discovery tab so returning from editor restores the previous tab", () => {
    expect(appSource).toContain('useState<BriefPanelMode>("recommend")');
    expect(appSource).toContain("briefMode={homeBriefMode}");
    expect(appSource).toContain("onBriefModeChange={setHomeBriefMode}");
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
    expect(appSource).toContain("isNonAtomicMotionComponent");
    expect(appSource).toMatch(
      /function applyCurrentRecipeToTarget[\s\S]*handleGeneratedComponentReady\(generated\)/
    );
    expect(appSource).toMatch(/recipeTargetComponents=\{components\.filter\([\s\S]*isNonAtomicMotionComponent/);
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
    expect(html).not.toContain("删除组件");
    expect(html).toContain('aria-label="动效预览"');
    expect(html).toContain('aria-label="参数面板"');
    expect(html).toContain('aria-label="检查器内容分类"');
    expect(html).toContain("组件信息");
    expect(html).toContain("信息");
    expect(html).toContain("参数");
    expect(html).toContain("图层");
    expect(html).toContain("其他");
  });
});

describe("EditorRoute delete action", () => {
  it("renders the delete action in the component detail page header", () => {
    const component = makeComponent("detail-motion");
    const html = renderToStaticMarkup(
      createElement(EditorRoute, {
        project: makeProject(component),
        onBack: () => {},
        onParamChange: () => {},
        onReplay: () => {},
        onDelete: () => {}
      })
    );

    expect(html).toContain("editor-delete-button");
    expect(html).toContain('aria-label="删除 detail-motion"');
    expect(html).toContain("删除组件");
  });
});

describe("EditorRoute interaction-triggered previews", () => {
  it("uses reset instead of playback controls for click-triggered components", () => {
    const component = generateAtomicMotionComponent({
      elementId: "popup-close",
      variant: "all",
      now: 1717747200000
    });
    const html = renderToStaticMarkup(
      createElement(EditorRoute, {
        project: makeProject(component),
        onBack: () => {},
        onParamChange: () => {},
        onReplay: () => {}
      })
    );

    expect(component.manifest.motionRecipes?.[0]?.trigger).toBe("click");
    expect(html).toContain("editor-preview is-interaction-preview");
    expect(html).toContain("preview-reset-button");
    expect(html).toContain(">重置<");
    expect(html).not.toContain(">播放<");
    expect(html).not.toContain(">暂停<");
    expect(html).not.toContain(">重播<");
  });
});

describe("EditorRoute non-atomic code component editing", () => {
  it("defaults non-atomic components to the full Pro parameter surface", () => {
    const editorSource = readFileSync(new URL("./routes/EditorRoute.tsx", import.meta.url), "utf8");

    expect(editorSource).toContain('useState<ParameterMode>("pro")');
    expect(editorSource).toContain('setParameterMode(isAtomicMotion ? "plus" : "pro")');
  });
});

describe("removeComponentById", () => {
  it("removes only the selected component from the current library list", () => {
    const components = [makeComponent("one"), makeComponent("two"), makeComponent("three")];

    expect(removeComponentById(components, "two").map((component) => component.id)).toEqual(["one", "three"]);
  });

  it("returns the same list when the component is not present", () => {
    const components = [makeComponent("one")];

    expect(removeComponentById(components, "missing")).toBe(components);
  });
});
