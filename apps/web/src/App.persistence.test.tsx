// @vitest-environment happy-dom
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { MotionComponent } from "@motion-tool/core";
import type { HomeRoute } from "./routes/HomeRoute";
import type { EditorRoute } from "./routes/EditorRoute";
import { App } from "./App";
import { createComponentStore } from "./state/componentStore";

const { applyRecipe } = vi.hoisted(() => ({ applyRecipe: vi.fn() }));
vi.mock("@motion-tool/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@motion-tool/core")>()),
  applyMotionRecipeToComponent: applyRecipe
}));

function component(id: string, origin: MotionComponent["source"]["origin"] = "imported"): MotionComponent {
  return {
    id,
    name: id,
    category: "layout",
    tags: [],
    useCases: [],
    moods: [],
    source: {
      id: "shared-source",
      origin,
      kind: "single-html",
      entry: "index.html",
      files: [{ path: "index.html", kind: "html", content: '<span data-motion="title">original</span>' }]
    },
    manifest: {
      version: "1.0",
      id: id + "-manifest",
      name: id,
      sourceKind: "single-html",
      runtime: { engine: "html", entry: "index.html", sandbox: "iframe" },
      params: [
        {
          id: "title",
          label: "标题",
          type: "text",
          default: "original",
          status: "confirmed",
          targets: [{ kind: "html-text", file: "index.html", selector: "[data-motion=title]" }]
        }
      ]
    }
  };
}

vi.mock("@motion-tool/components-builtin/src/lazy", () => ({
  loadBuiltinComponents: async () => [component("bundled", "builtin"), component("other", "builtin")]
}));
vi.mock("./data/workeasyComponents", () => ({ workEasyComponents: [] }));
vi.mock("./services/atomicMotionGeneration", () => ({ atomicMotionFeedComponents: [] }));
vi.mock("./routes/HomeRoute", () => ({
  HomeRoute: (props: ComponentProps<typeof HomeRoute>) => (
    <div data-view="home" data-loading={props.isLibraryLoading}>
      {props.components.map((item) => (
        <button
          key={item.id}
          data-action={`select-${item.id}`}
          onClick={() => void props.onSelectComponent(item.id)}
        >
          {item.name}
        </button>
      ))}
      <button data-action="upload" onClick={() => props.onComponentAdded(component("upload"))}>
        上传
      </button>
      {["bundled", "saved"].map((id) => (
        <button
          key={id}
          data-action={`upload-${id}`}
          onClick={() => props.onComponentAdded({ ...component(id), name: "reimported" })}
        >
          重新上传 {id}
        </button>
      ))}
      <button
        data-action="generate"
        onClick={() => props.onGeneratedComponentReady?.(component("generated", "generated"))}
      >
        生成
      </button>
    </div>
  )
}));
vi.mock("./routes/EditorRoute", () => ({
  EditorRoute: (props: ComponentProps<typeof EditorRoute>) => (
    <div data-view="editor" data-component={props.project?.manifest.id}>
      <output>{JSON.stringify(props.project?.patch.values)}</output>
      <span data-baseline>{String(props.project?.manifest.params[0]?.default)}</span>
      <button data-action="edit" onClick={() => props.onParamChange("title", "edited")}>
        编辑
      </button>
      <button data-action="back" onClick={props.onBack}>
        返回
      </button>
      <button data-action="reset" onClick={props.onResetParams}>
        重置
      </button>
      <button data-action="save" onClick={props.onSave}>
        保存
      </button>
      <button data-action="delete" onClick={props.onDelete}>
        删除
      </button>
      <button data-action="apply" onClick={() => void props.onApplyRecipeToTarget?.("other", "layer")}>
        应用
      </button>
    </div>
  )
}));

let root: Root | undefined;
let container: HTMLDivElement;
beforeEach(() => {
  applyRecipe.mockReset();
  applyRecipe.mockImplementation(() => component("recipe-draft", "generated"));
  vi.stubGlobal("indexedDB", new IDBFactory());
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
});
afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = undefined;
  container.remove();
  vi.unstubAllGlobals();
});

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}
async function mount() {
  root = createRoot(container);
  await act(async () => root?.render(<App />));
  await settle();
}
async function click(action: string) {
  const button = container.querySelector<HTMLButtonElement>(`[data-action="${action}"]`);
  expect(button, action).not.toBeNull();
  await act(async () => button!.click());
  await settle();
}
async function reload() {
  await act(async () => root?.unmount());
  await mount();
}
function values() {
  return JSON.parse(container.querySelector("output")!.textContent!);
}

it("restores uploaded and saved components on reload, preserving saved baselines and origin", async () => {
  await mount();
  await click("upload");
  await click("back");
  await click("generate");
  await click("edit");
  await click("save");
  await reload();
  expect(container.querySelector('[data-action="select-upload"]')).not.toBeNull();
  expect(container.querySelector('[data-action="select-generated"]')).not.toBeNull();
  const stored = await createComponentStore().load();
  expect(stored.components.map((item) => [item.id, item.source.origin])).toEqual([
    ["generated", "generated"],
    ["upload", "imported"]
  ]);
  await click("select-generated");
  expect(container.querySelector("[data-baseline]")?.textContent).toBe("edited");
  await click("delete");
  await reload();
  expect(container.querySelector('[data-action="select-generated"]')).toBeNull();
});

it.each(["bundled", "saved"])(
  "preserves the original %s and its re-imported copy across reload",
  async (id) => {
    if (id === "saved") await createComponentStore().saveComponent(component(id));
    await mount();
    const timestamp = vi.spyOn(Date, "now").mockReturnValue(123);
    try {
      await click(`upload-${id}`);
    } finally {
      timestamp.mockRestore();
    }
    const copyId = `${id}-copy-123`;
    expect(container.querySelector("[data-component]")?.getAttribute("data-component")).toBe(
      `${copyId}-manifest`
    );
    await click("back");
    for (let attempt = 0; attempt < 2; attempt++) {
      expect(container.querySelectorAll(`[data-action="select-${id}"]`)).toHaveLength(1);
      expect(container.querySelector(`[data-action="select-${id}"]`)?.textContent).toBe(id);
      expect(container.querySelector(`[data-action="select-${copyId}"]`)?.textContent).toBe("reimported");
      if (attempt === 0) await reload();
    }
    const stored = await createComponentStore().load();
    const copy = stored.components.find((item) => item.id === copyId);
    expect(copy).toMatchObject({
      name: "reimported",
      source: { id: copyId, origin: "imported" },
      manifest: { id: `${copyId}-manifest` }
    });
    if (id === "saved") expect(stored.components.find((item) => item.id === id)?.name).toBe(id);
  }
);

it("keeps bundled ids on storage conflicts and shows storage failure in both views", async () => {
  await createComponentStore().saveComponent({ ...component("bundled"), name: "conflicting" });
  await mount();
  expect(container.querySelector('[data-action="select-bundled"]')?.textContent).toBe("bundled");
  await act(async () => root?.unmount());
  vi.stubGlobal("indexedDB", undefined);
  await mount();
  expect(container.querySelector('[data-view="home"]')?.getAttribute("data-loading")).toBe("false");
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("本地");
  await click("select-bundled");
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("本地");
});

it("retains per-component drafts on back, reload and reset without modifying originals", async () => {
  await mount();
  await click("select-bundled");
  await click("edit");
  await click("back");
  await click("select-other");
  expect(values()).toEqual({});
  await click("back");
  await click("select-bundled");
  expect(values()).toEqual({ title: "edited" });
  expect(container.querySelector("[data-baseline]")?.textContent).toBe("original");
  await click("back");
  await reload();
  await click("select-bundled");
  expect(values()).toEqual({ title: "edited" });
  await click("reset");
  await click("back");
  await click("select-bundled");
  expect(values()).toEqual({});
  expect((await createComponentStore().load()).drafts).toEqual({});
});

it("keeps drafts in memory when storage is unavailable", async () => {
  vi.stubGlobal("indexedDB", undefined);
  await mount();
  await click("select-bundled");
  await click("edit");
  await click("back");
  await click("select-bundled");
  expect(values()).toEqual({ title: "edited" });
});

it("debounces writes while editing and never persists unsaved generated drafts", async () => {
  await mount();
  await click("select-bundled");
  await click("edit");
  expect((await createComponentStore().load()).drafts).toEqual({});
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 350));
  });
  expect((await createComponentStore().load()).drafts.bundled?.values).toEqual({ title: "edited" });
  await click("back");
  await click("generate");
  await click("edit");
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 350));
  });
  const stored = await createComponentStore().load();
  expect(stored.components).toEqual([]);
  expect(Object.keys(stored.drafts)).toEqual(["bundled"]);
});

it("opens editor recipe results in a saveable modal and preserves the source draft on cancel", async () => {
  await mount();
  await click("select-bundled");
  await click("edit");
  await click("apply");
  expect(container.querySelector('[data-view="home"]')).not.toBeNull();
  expect(container.querySelector('[role="dialog"] [data-component="recipe-draft-manifest"]')).not.toBeNull();
  expect((await createComponentStore().load()).drafts.bundled?.values).toEqual({ title: "edited" });
  await click("back");
  expect(container.querySelector('[role="dialog"]')).toBeNull();
  await click("select-bundled");
  expect(values()).toEqual({ title: "edited" });
  await click("apply");
  applyRecipe.mockImplementation(() => component("second-recipe", "generated"));
  await click("apply");
  expect(container.querySelector('[role="dialog"] [data-component="second-recipe-manifest"]')).not.toBeNull();
  await click("save");
  expect(container.querySelector('[data-action="select-second-recipe"]')).not.toBeNull();
  expect(container.querySelector('[data-action="select-bundled"]')).not.toBeNull();
});

it("shows recipe failures and leaves the current project and edits intact", async () => {
  await mount();
  await click("select-bundled");
  await click("edit");
  applyRecipe.mockImplementation(() => {
    throw new Error("目标图层缺少可绑定 selector。");
  });
  await click("apply");
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("目标图层缺少可绑定 selector。");
  expect(container.querySelector('[data-component="bundled-manifest"]')).not.toBeNull();
  expect(values()).toEqual({ title: "edited" });
  expect(container.querySelector('[role="dialog"]')).toBeNull();
});
