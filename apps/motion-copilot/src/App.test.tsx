// @vitest-environment happy-dom
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyDocumentPatch,
  compileIntent,
  createDefaultDocument,
  type CompositionStep,
  type MotionDocument
} from "@motion-copilot/core";
import { App } from "./App";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let host: HTMLDivElement | undefined;
const originalImage = globalThis.Image;

function mockImageDimensions(dimensions: { width: number; height: number }) {
  class MockImage {
    naturalWidth = dimensions.width;
    naturalHeight = dimensions.height;
    private listeners: Partial<Record<"load" | "error", Array<(event: Event) => void>>> = {};

    addEventListener(type: "load" | "error", listener: (event: Event) => void) {
      this.listeners[type] = [...(this.listeners[type] ?? []), listener];
    }

    set src(_value: string) {
      queueMicrotask(() => {
        for (const listener of this.listeners.load ?? []) listener(new Event("load"));
      });
    }
  }

  globalThis.Image = MockImage as unknown as typeof Image;
}

function savedWorkspace() {
  const value = globalThis.localStorage?.getItem("motion-copilot-workspace");
  if (!value) throw new Error("Saved workspace not found");
  return JSON.parse(value) as {
    document: MotionDocument;
    compositionSteps?: CompositionStep[];
  };
}

function sampleWorkspaceDocument(): MotionDocument {
  return applyDocumentPatch(
    createDefaultDocument("modal"),
    compileIntent({ prompt: "做一个中型弹窗，弹性一点出现" })
  );
}

function seedSampleWorkspace() {
  globalThis.localStorage?.setItem("mc-onboarded", "1");
  globalThis.localStorage?.setItem(
    "motion-copilot-workspace",
    JSON.stringify({
      schemaVersion: "0.2",
      document: sampleWorkspaceDocument(),
      compositionSteps: [],
      hasStarted: true,
      prompt: "做一个中型弹窗，弹性一点出现",
      presetTarget: "selected-layer"
    })
  );
}

function renderApp(): HTMLDivElement {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root?.render(<App />);
  });
  return host;
}

function clickButton(name: string) {
  const buttons = Array.from(document.querySelectorAll("button"));
  const button = buttons.find((item) => item.textContent?.trim() === name);
  if (!button) throw new Error(`Button not found: ${name}`);
  act(() => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function clickButtonByTitle(title: string) {
  const button = document.querySelector<HTMLButtonElement>(`button[title="${title}"]`);
  if (!button) throw new Error(`Button with title not found: ${title}`);
  act(() => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

// 异步生成入口(走 LLM client,测试环境降级到本地 mock)点击后需 flush 微任务。
async function clickButtonAsync(name: string) {
  const buttons = Array.from(document.querySelectorAll("button"));
  const button = buttons.find((item) => item.textContent?.trim() === name);
  if (!button) throw new Error(`Button not found: ${name}`);
  await act(async () => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function setPresetSearch(value: string) {
  const input = document.querySelector<HTMLInputElement>(".preset-search");
  if (!input) throw new Error("Preset search not found");
  act(() => {
    input.value = value;
    input.dispatchEvent(new InputEvent("input", { bubbles: true, data: value }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function setPromptInput(value: string) {
  const input = document.querySelector<HTMLTextAreaElement>(".prompt-input");
  if (!input) throw new Error("Prompt input not found");
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(input, value);
    input.dispatchEvent(new InputEvent("input", { bubbles: true, data: value }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function setTextareaByLabel(label: string, value: string) {
  const textarea = document.querySelector<HTMLTextAreaElement>(`textarea[aria-label="${label}"]`);
  if (!textarea) throw new Error(`Textarea not found: ${label}`);
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(textarea, value);
    textarea.dispatchEvent(new InputEvent("input", { bubbles: true, data: value }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function frameFixture(name: string): string {
  const candidates = [
    resolve(process.cwd(), "fixtures/frames", `${name}.json`),
    resolve(process.cwd(), "../../fixtures/frames", `${name}.json`)
  ];
  const fixturePath = candidates.find((path) => existsSync(path));
  if (!fixturePath) throw new Error(`Frame fixture not found: ${name}`);
  return readFileSync(fixturePath, "utf8");
}

function visualFixture(nodeId: "28:19" | "28:2") {
  const isCollapsed = nodeId === "28:19";
  return {
    schemaVersion: "motion-copilot.zero-visual-snapshot.v1",
    frameId: nodeId,
    nodeId,
    name: isCollapsed ? "信息收起状态" : "信息展开状态",
    width: isCollapsed ? 505 : 583,
    height: 38,
    screenshotUrl: `http://localhost:27618/assets/${nodeId.replace(":", "-")}.png`,
    html: `<div class="zero-frame" data-node-id="${nodeId}"><span data-node-id="${isCollapsed ? "28:32" : "28:11"}">继续指派 &gt;</span></div>`,
    css: `.zero-frame{position:relative;width:${isCollapsed ? 505 : 583}px;height:38px}`,
    assets: [],
    nodes: [
      {
        nodeId,
        name: isCollapsed ? "信息收起状态" : "信息展开状态",
        kind: "group",
        bounds: { x: 0, y: 0, w: isCollapsed ? 505 : 583, h: 38 }
      },
      {
        nodeId: isCollapsed ? "28:32" : "28:11",
        name: "继续指派",
        kind: "text",
        bounds: { x: isCollapsed ? 209 : 287, y: 10, w: 60, h: 17 },
        text: "继续指派 >"
      }
    ]
  };
}

function layerFixture(nodeId: "28:19" | "28:2") {
  const isCollapsed = nodeId === "28:19";
  const rootWidth = isCollapsed ? 505 : 583;
  return {
    schemaVersion: "motion-copilot.zero-layer-snapshot.v1",
    frameId: nodeId,
    nodeId,
    name: isCollapsed ? "信息收起状态" : "信息展开状态",
    width: rootWidth,
    height: 38,
    screenshotUrl: `data:image/png;base64,${isCollapsed ? "FROM" : "TO"}`,
    assets: [],
    layers: [
      {
        nodeId,
        name: isCollapsed ? "信息收起状态" : "信息展开状态",
        kind: "frame",
        bounds: { x: 0, y: 0, w: rootWidth, h: 38 },
        opacity: 1,
        visible: true,
        fills: [{ type: "solid", color: "#ffffff", opacity: 0 }]
      },
      {
        nodeId: isCollapsed ? "28:28" : "28:7",
        parentId: nodeId,
        name: "组件背景",
        kind: "rect",
        bounds: { x: 0, y: 0, w: isCollapsed ? 288 : 366, h: 38 },
        opacity: 1,
        visible: true,
        cornerRadius: 8,
        fills: [{ type: "solid", color: "#ffffff" }]
      },
      {
        nodeId: isCollapsed ? "28:34" : "28:12",
        parentId: nodeId,
        name: "状态胶囊",
        kind: "rect",
        bounds: { x: isCollapsed ? 78 : 79, y: 6, w: isCollapsed ? 108 : 185, h: 26 },
        opacity: 1,
        visible: true,
        cornerRadius: 999,
        fills: [{ type: "solid", color: "#f3f3f3" }]
      },
      {
        nodeId: isCollapsed ? "28:36" : "28:14",
        parentId: nodeId,
        name: "待确认文字",
        kind: "text",
        bounds: { x: isCollapsed ? 103 : 88, y: 10, w: isCollapsed ? 8 : 48, h: 17 },
        opacity: 1,
        visible: true,
        text: isCollapsed ? "2" : "待确认 2",
        fills: [{ type: "solid", color: "#cdab18" }],
        textStyle: { fontSize: 12, fontWeight: 500, lineHeight: 16 }
      },
      ...(isCollapsed
        ? [
            {
              nodeId: "28:40",
              parentId: nodeId,
              name: "首帧专有",
              kind: "rect",
              bounds: { x: 420, y: 10, w: 28, h: 18 },
              opacity: 1,
              visible: true,
              cornerRadius: 9,
              fills: [{ type: "solid", color: "#111111" }]
            }
          ]
        : [
            {
              nodeId: "28:41",
              parentId: nodeId,
              name: "尾帧专有",
              kind: "rect",
              bounds: { x: 530, y: 10, w: 28, h: 18 },
              opacity: 1,
              visible: true,
              cornerRadius: 9,
              fills: [{ type: "solid", color: "#111111" }]
            }
          ])
    ]
  };
}

function lowConfidenceLayerFixture(nodeId: "28:19" | "28:2") {
  const fixture = layerFixture(nodeId);
  if (nodeId === "28:2") {
    return {
      ...fixture,
      layers: fixture.layers.map((layer) =>
        layer.nodeId === "28:12"
          ? { ...layer, nodeId: "28:99", name: "状态胶囊尾帧", bounds: { ...layer.bounds, x: 430 } }
          : layer
      )
    };
  }
  return fixture;
}

async function importVisualFrameMorphFixture(): Promise<HTMLDivElement> {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { nodeId?: "28:19" | "28:2" };
      if (!String(url).includes("/api/zero/visual-snapshot")) {
        return new Response(JSON.stringify({ error: "unexpected endpoint" }), { status: 500 });
      }
      return new Response(JSON.stringify({ snapshot: visualFixture(body.nodeId ?? "28:2") }), {
        status: 200
      });
    })
  );

  const app = renderApp();
  clickButton("开始使用");
  openFrameMotionMode("高保真预览");
  await clickButtonAsync("从 Zero 读取并生成高保真时间线");
  await waitFor(() => expect(app.textContent).toContain("matched"));
  return app;
}

function findPresetItem(name: string) {
  const items = Array.from(document.querySelectorAll(".preset-item"));
  return items.find((node) => {
    const strong = node.querySelector("strong");
    return strong?.textContent?.trim() === name;
  });
}

const presetTabHints: Partial<Record<string, string>> = {
  进入屏幕: "转场",
  永久离开: "转场",
  容器变化: "转场",
  横向切换: "横向",
  骨架屏加载: "骨架"
};

function ensurePresetTab(name: string) {
  const tab = presetTabHints[name];
  if (tab) clickPresetTab(tab);
}

function clickPresetApply(name: string) {
  ensurePresetTab(name);
  let item = findPresetItem(name);
  if (!item) {
    setPresetSearch(name);
    item = findPresetItem(name);
  }
  const button = item?.querySelector<HTMLButtonElement>(".preset-apply");
  if (!button) throw new Error(`Preset apply button not found: ${name}`);
  act(() => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function addPresetToComposition(name: string) {
  ensurePresetTab(name);
  let item = findPresetItem(name);
  if (!item) {
    setPresetSearch(name);
    item = findPresetItem(name);
  }
  const button = item?.querySelector<HTMLButtonElement>(".preset-add-track");
  if (!button) throw new Error(`Add-to-track button not found: ${name}`);
  act(() => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function clickPresetTab(name: string) {
  const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
  const tab = tabs.find((item) => item.textContent?.trim() === name);
  if (!tab) throw new Error(`Preset tab not found: ${name}`);
  act(() => {
    tab.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function selectCompositionStep(name: string) {
  const steps = Array.from(document.querySelectorAll(".composition-step"));
  const step = steps.find((node) => node.textContent?.includes(name));
  if (!step) throw new Error(`Composition step not found: ${name}`);
  act(() => {
    step.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function toggleCompositionStepTiming(name: string) {
  const steps = Array.from(document.querySelectorAll(".composition-step"));
  const step = steps.find((node) => node.textContent?.includes(name));
  const button = Array.from(step?.querySelectorAll("button") ?? []).find((item) =>
    item.classList.contains("step-timing")
  );
  if (!button) throw new Error(`Composition step timing not found: ${name}`);
  act(() => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function selectLayer(name: string) {
  const rows = Array.from(document.querySelectorAll<HTMLElement>(".command-layer-row"));
  const row = rows.find(
    (item) =>
      item.textContent?.includes(name) || item.querySelector<HTMLInputElement>("input")?.value.includes(name)
  );
  if (!row) throw new Error(`Layer not found: ${name}`);
  act(() => {
    row.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function changeInputByLabel(label: string, value: string) {
  const input = document.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
  if (!input) throw new Error(`Input not found: ${label}`);
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function useLegacyZeroLayerFixtureIds() {
  changeInputByLabel("Zero 图层首帧 nodeId", "28:19");
  changeInputByLabel("Zero 图层尾帧 nodeId", "28:2");
}

function selectValueByLabel(label: string, value: string) {
  const select = document.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`);
  if (!select) throw new Error(`Select not found: ${label}`);
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(select, value);
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function clickByLabel(label: string) {
  const button = document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  if (!button) throw new Error(`Button not found: ${label}`);
  act(() => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function openFrameMotionMode(mode: "Zero 原生" | "高保真预览" | "低保真调试") {
  clickButton("帧间动效");
  if (mode !== "Zero 原生") clickButton(mode);
}

function dragCompositionStep(name: string, deltaX: number, deltaY = 0) {
  const steps = Array.from(document.querySelectorAll<HTMLElement>(".composition-step"));
  const step = steps.find((node) => node.textContent?.includes(name));
  if (!step) throw new Error(`Composition step not found: ${name}`);
  const laneCanvas = step.closest<HTMLElement>(".composition-lane-canvas");
  if (!laneCanvas) throw new Error(`Composition lane not found: ${name}`);
  const originalElementFromPoint = document.elementFromPoint;
  step.getBoundingClientRect = () =>
    ({
      left: 180,
      top: 120,
      width: 220,
      height: 92,
      right: 400,
      bottom: 212,
      x: 180,
      y: 120,
      toJSON: () => ({})
    }) as DOMRect;
  laneCanvas.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 100,
      width: 760,
      height: 112,
      right: 760,
      bottom: 212,
      x: 0,
      y: 100,
      toJSON: () => ({})
    }) as DOMRect;
  document.elementFromPoint = () => laneCanvas;
  const rect = step.getBoundingClientRect();
  const startX = rect.left + rect.width / 2;
  const startY = rect.top + rect.height / 2;
  act(() => {
    step.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientX: startX, clientY: startY }));
    document.dispatchEvent(
      new MouseEvent("mousemove", {
        bubbles: true,
        clientX: startX + deltaX,
        clientY: startY + deltaY
      })
    );
    document.dispatchEvent(
      new MouseEvent("mouseup", {
        bubbles: true,
        clientX: startX + deltaX,
        clientY: startY + deltaY
      })
    );
  });
  document.elementFromPoint = originalElementFromPoint;
}

async function uploadFile(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, "files", {
    configurable: true,
    value: [file]
  });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await Promise.resolve();
  });
}

async function waitFor(assertion: () => void) {
  const startedAt = Date.now();
  let lastError: unknown;
  while (Date.now() - startedAt < 1000) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    }
  }
  throw lastError;
}

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  host?.remove();
  root = undefined;
  host = undefined;
  globalThis.localStorage?.removeItem("mc-onboarded");
  globalThis.localStorage?.removeItem("motion-copilot-workspace");
  globalThis.Image = originalImage;
  vi.unstubAllGlobals();
});

describe("Motion Copilot app", () => {
  it("renders the independent workspace and Phase 1 controls", () => {
    const app = renderApp();

    // 先关闭 onboarding
    clickButton("开始使用");
    const text = app.textContent ?? "";

    expect(text).toContain("Motion Copilot");
    expect(text).toContain("实时画布");
    expect(text).not.toContain("从空白画布开始");
    expect(text).toContain("新建空白");
    expect(text).not.toContain("加载示例");
    expect(text).toContain("图层素材");
    expect(text).not.toContain("新品上线提醒");
    expect(text).toContain("循环");
    expect(text).not.toContain("重播");
    expect(text).toContain("参数面板");
    expect(text).toContain("克制");
    expect(text).toContain("Q弹");
    expect(text).toContain("App 规范动效");
    expect(text).toContain("当前图层");
    expect(text).toContain("当前图层推荐");
    expect(text).toContain("推荐");
    expect(text).toContain("组合");
    expect(text).toContain("转场");
    expect(text).toContain("导航");
    expect(text).not.toContain("导航切换");
    expect(text).not.toContain("目标对象");
    expect(text).toContain("动效参数");
    expect(text).toContain("上传背景图");

    clickPresetTab("导航");
    expect(app.textContent).toContain("导航切换");

    // 切换到规范 tab
    clickButton("规范");
    const textAfterTab = app.textContent ?? "";
    expect(textAfterTab).toContain("下载完整 HTML");
    expect(textAfterTab).toContain("导出代码");
  });

  it("keeps a new blank project truly empty", async () => {
    const app = renderApp();
    clickButton("开始使用");

    clickButton("新建空白");

    expect(app.textContent).not.toContain("从空白画布开始");
    expect(app.textContent).not.toContain("图片位");
    expect(app.textContent).not.toContain("新品上线提醒");
    expect(document.querySelector(".canvas-empty-state")).toBeNull();
    expect(document.querySelector(".motion-target")).toBeNull();
    expect(document.querySelector(".safe-area")).toBeNull();
    expect(document.querySelectorAll(".free-layer")).toHaveLength(0);
    await waitFor(() => {
      expect(savedWorkspace().document.layers).toHaveLength(0);
      expect(savedWorkspace().document.stage.showSafeArea).toBe(false);
    });
  });

  it("imports a real image layer and restores it from local storage", async () => {
    let app = renderApp();
    clickButton("开始使用");
    clickButton("新建空白");

    const input = document.querySelector<HTMLInputElement>('input[aria-label="导入图片图层"]');
    if (!input) throw new Error("Image layer import input not found");

    await uploadFile(input, new File(["foreground"], "foreground.png", { type: "image/png" }));

    await waitFor(() => {
      const image = document.querySelector<HTMLImageElement>(".free-layer-image img");
      expect(image?.alt).toBe("foreground.png");
      expect(image?.src).toContain("data:image/png;base64,");
      expect(app.textContent).toContain("foreground");
    });
    await waitFor(() => {
      expect(globalThis.localStorage?.getItem("motion-copilot-workspace")).toContain("foreground");
    });

    act(() => {
      root?.unmount();
    });
    host?.remove();
    root = undefined;
    host = undefined;

    app = renderApp();
    await waitFor(() => {
      expect(app.textContent).toContain("foreground");
      expect(document.querySelector<HTMLImageElement>(".free-layer-image img")?.src).toContain(
        "data:image/png;base64,"
      );
    });
  });

  it("keeps selected image replacement proportional and inside the stage", async () => {
    const app = renderApp();
    clickButton("开始使用");
    clickButton("新建空白");

    const importInput = document.querySelector<HTMLInputElement>('input[aria-label="导入图片图层"]');
    if (!importInput) throw new Error("Image layer import input not found");

    mockImageDimensions({ width: 1000, height: 1000 });
    await uploadFile(importInput, new File(["first"], "first.png", { type: "image/png" }));

    await waitFor(() => {
      expect(app.textContent).toContain("first");
    });

    const uploadInput = document.querySelector<HTMLInputElement>('input[aria-label="上传图层图片"]');
    if (!uploadInput) throw new Error("Selected image upload input not found");

    mockImageDimensions({ width: 2000, height: 1000 });
    await uploadFile(uploadInput, new File(["wide"], "wide.png", { type: "image/png" }));

    await waitFor(() => {
      const image = document.querySelector<HTMLImageElement>(".free-layer-image img");
      expect(image?.alt).toBe("wide.png");
    });

    await waitFor(() => {
      const imageLayer = savedWorkspace().document.layers.find((layer) => layer.name === "first");
      expect(imageLayer?.layout).toMatchObject({
        width: 310,
        height: 155,
        aspectLocked: true
      });
      expect(imageLayer?.layout?.x).toBeGreaterThanOrEqual(0);
      expect(imageLayer?.layout?.y).toBeGreaterThanOrEqual(0);
      expect((imageLayer?.layout?.x ?? 0) + (imageLayer?.layout?.width ?? 0)).toBeLessThanOrEqual(430);
      expect((imageLayer?.layout?.y ?? 0) + (imageLayer?.layout?.height ?? 0)).toBeLessThanOrEqual(720);
    });
  });

  it("edits text and image styling from the inspector", async () => {
    const app = renderApp();
    clickButton("开始使用");
    clickButton("新建空白");
    clickButton("新增文本");

    await waitFor(() => {
      expect(app.textContent).toContain("自定义文本");
    });

    changeInputByLabel("文本字号", "22");
    selectValueByLabel("文本字重", "700");
    changeInputByLabel("文本行高", "1.6");
    selectValueByLabel("文本对齐", "right");
    changeInputByLabel("图层透明度", "0.7");
    changeInputByLabel("图层圆角", "12");

    await waitFor(() => {
      expect(document.querySelector<HTMLElement>(".free-layer-text")?.style.fontSize).toBe("22px");
      expect(document.querySelector<HTMLElement>(".free-layer-text")?.style.fontWeight).toBe("700");
      expect(document.querySelector<HTMLElement>(".free-layer-text")?.style.lineHeight).toBe("1.6");
      expect(document.querySelector<HTMLElement>(".free-layer-text")?.style.textAlign).toBe("right");
      expect(
        savedWorkspace().document.layers.find((layer) => layer.name === "自定义文本")?.style
      ).toMatchObject({
        fontSize: 22,
        fontWeight: 700,
        lineHeight: 1.6,
        textAlign: "right",
        opacity: 0.7,
        radius: 12
      });
    });

    const importInput = document.querySelector<HTMLInputElement>('input[aria-label="导入图片图层"]');
    if (!importInput) throw new Error("Image layer import input not found");
    mockImageDimensions({ width: 640, height: 480 });
    await uploadFile(importInput, new File(["photo"], "photo.png", { type: "image/png" }));

    await waitFor(() => {
      expect(document.querySelector<HTMLImageElement>(".free-layer-image img")?.alt).toBe("photo.png");
    });

    selectValueByLabel("图片适配", "contain");
    selectValueByLabel("图片焦点", "bottom");
    await waitFor(() => {
      const image = document.querySelector<HTMLImageElement>(".free-layer-image img");
      expect(image?.style.objectFit).toBe("contain");
      expect(image?.style.objectPosition).toBe("bottom");
      expect(savedWorkspace().document.layers.find((layer) => layer.name === "photo")?.style).toMatchObject({
        fit: "contain",
        position: "bottom"
      });
    });
  });

  it("supports layer duplicate, visibility, lock, stacking, and delete cleanup", async () => {
    const app = renderApp();
    clickButton("开始使用");
    clickButton("新建空白");
    clickButton("新增文本");

    await waitFor(() => {
      expect(app.textContent).toContain("自定义文本");
    });

    addPresetToComposition("进入屏幕");
    expect(document.querySelector(".composition-track")?.textContent).toContain("自定义文本");

    clickByLabel("复制图层 自定义文本");
    await waitFor(() => {
      expect(app.textContent).toContain("自定义文本 副本");
      expect(document.querySelectorAll(".free-layer-text")).toHaveLength(2);
    });

    clickByLabel("隐藏图层 自定义文本 副本");
    await waitFor(() => {
      expect(app.textContent).toContain("隐藏");
    });
    clickByLabel("显示图层 自定义文本 副本");

    clickByLabel("锁定图层 自定义文本 副本");
    await waitFor(() => {
      expect(app.textContent).toContain("锁定");
    });
    const copiedLayerRow = Array.from(document.querySelectorAll<HTMLElement>(".command-layer-row")).find(
      (row) => row.querySelector<HTMLInputElement>("input")?.value === "自定义文本 副本"
    );
    expect(copiedLayerRow).toBeTruthy();
    expect(copiedLayerRow?.textContent).toContain("锁定");
    expect(copiedLayerRow?.querySelector(".command-layer-drag-handle")).toBeTruthy();
    clickByLabel("解锁图层 自定义文本 副本");

    clickByLabel("删除图层 自定义文本");
    await waitFor(() => {
      expect(app.textContent).not.toContain("自定义文本\n");
      expect(document.querySelector(".composition-track")?.textContent ?? "").not.toContain("自定义文本");
      expect(document.querySelectorAll(".free-layer-text")).toHaveLength(1);
    });
  });

  it("returns the preview to the empty state after deleting every layer", async () => {
    const app = renderApp();
    clickButton("开始使用");
    clickButton("新建空白");
    clickButton("新增文本");

    await waitFor(() => {
      expect(document.querySelectorAll(".free-layer-text")).toHaveLength(1);
    });

    clickByLabel("删除图层 自定义文本");

    await waitFor(() => {
      expect(app.textContent).not.toContain("从空白画布开始");
      expect(document.querySelector(".canvas-empty-state")).toBeNull();
      expect(document.querySelectorAll(".free-layer")).toHaveLength(0);
      expect(document.querySelector(".motion-target")).toBeNull();
      expect(savedWorkspace().document.layers).toHaveLength(0);
      expect(savedWorkspace().document.selectedLayerId).toBeUndefined();
    });
  });

  it("keeps project actions visible in the left rail", () => {
    const app = renderApp();
    clickButton("开始使用");

    const text = app.textContent ?? "";
    expect(text).toContain("项目");
    expect(text).toContain("新建空白");
    expect(text).not.toContain("加载示例");
  });

  it("changes canvas size from the inspector dropdown", () => {
    renderApp();
    clickButton("开始使用");

    selectValueByLabel("画布尺寸", "web-1440");

    expect(document.querySelector<HTMLInputElement>('input[value="1440"]')).toBeTruthy();
    expect(document.querySelector<HTMLInputElement>('input[value="900"]')).toBeTruthy();
  });

  it("toggles mobile safe area guides from the inspector", async () => {
    renderApp();
    clickButton("开始使用");

    expect(document.querySelector(".safe-area")).toBeNull();

    selectValueByLabel("安全区参考线", "show");

    expect(document.querySelector(".safe-area-top")).toBeTruthy();
    expect(document.querySelector(".safe-area-bottom")).toBeTruthy();
    await waitFor(() => {
      expect(savedWorkspace().document.stage.showSafeArea).toBe(true);
    });
  });

  it("applies a guideline suggestion generated by a style token", () => {
    seedSampleWorkspace();
    const app = renderApp();

    clickButton("快速");
    // 切到规范 tab 查看建议
    clickButton("规范");
    expect(app.textContent).toContain("时长偏快");

    clickButton("应用建议");
    expect(app.textContent).not.toContain("时长偏快");
    // 切回属性 tab 查看时长
    clickButton("属性");
    expect(app.textContent).toContain("modal / medium / 250ms");
  });

  it("ignores a guideline suggestion without changing the document", () => {
    seedSampleWorkspace();
    const app = renderApp();

    clickButton("快速");
    clickButton("规范");
    expect(app.textContent).toContain("时长偏快");

    clickButton("忽略");
    expect(app.textContent).not.toContain("时长偏快");
    clickButton("属性");
    expect(app.textContent).toContain("modal / medium / 160ms");
  });

  it("downloads standalone HTML and keeps uploaded background in preview and export", async () => {
    renderApp();
    clickButton("开始使用");

    // 切换到规范 tab 查看下载链接
    clickButton("规范");

    const download = document.querySelector<HTMLAnchorElement>('a[download="motion-copilot-export.html"]');
    expect(download?.textContent).toContain("下载完整 HTML");
    expect(decodeURIComponent(download?.href ?? "")).toContain("<!doctype html>");

    // 切回属性 tab 上传背景
    clickButton("属性");
    const input = document.querySelector<HTMLInputElement>('input[aria-label="上传背景图"]');
    if (!input) throw new Error("Background upload input not found");

    await uploadFile(input, new File(["preview"], "preview.png", { type: "image/png" }));

    await waitFor(() => {
      const background = document.querySelector<HTMLImageElement>(".artboard-background-image");
      expect(background?.alt).toBe("preview.png");
      expect(background?.src).toContain("data:image/png;base64,");
    });

    // 切到规范 tab 验证导出内容
    clickButton("规范");
    await waitFor(() => {
      const exportText = document.querySelector<HTMLTextAreaElement>(".export-output")?.value ?? "";
      expect(exportText).toContain("data:image/png;base64,");
    });
  });

  it("applies mobile app motion presets and shows the motion stack", () => {
    seedSampleWorkspace();
    const app = renderApp();

    clickPresetApply("横向切换");

    expect(app.textContent).toContain("已应用动效");
    expect(app.textContent).toContain("图层：标题");
    expect(app.textContent).toContain("modal / medium / 280ms");
  });

  it("adds presets to the horizontal composition track and previews the track duration", () => {
    seedSampleWorkspace();
    const app = renderApp();

    addPresetToComposition("横向切换");

    expect(app.textContent).toContain("多图层时间轴");
    expect(app.textContent).toContain("应用到文档");
    expect(app.textContent).toContain("下载编排 JSON");
    expect(app.textContent).toContain("下载参数表 MD");
    expect(app.textContent).toContain("编排片段参数");
    expect(app.textContent).toContain("片段时长 ms");
    expect(app.textContent).toContain("modal / medium / 180ms");
    const jsonDownload = document.querySelector<HTMLAnchorElement>(
      'a[download="motion-composition-export.json"]'
    );
    const jsonHref = jsonDownload?.href ?? "";
    const jsonText = decodeURIComponent(jsonHref.slice(jsonHref.indexOf(",") + 1));
    const payload = JSON.parse(jsonText) as {
      schemaVersion: string;
      stage: { mode: string; width: number; height: number };
      timeline: { steps: Array<{ label: string; startMs: number; durationMs: number }> };
    };
    expect(payload.schemaVersion).toBe("motion-copilot.composition.v1");
    expect(payload.stage).toMatchObject({ mode: "mobile", width: 430, height: 720 });
    expect(payload.timeline.steps[0]).toMatchObject({ label: "横向切换", startMs: 0, durationMs: 180 });
    expect(jsonText).not.toContain("目标对象");
    const markdownDownload = document.querySelector<HTMLAnchorElement>(
      'a[download="motion-composition-handoff.md"]'
    );
    const markdownHref = markdownDownload?.href ?? "";
    const markdownText = decodeURIComponent(markdownHref.slice(markdownHref.indexOf(",") + 1));
    expect(markdownText).toContain("# Motion Copilot 编排参数表");
    expect(markdownText).toContain(
      "| 1 | 标题 | 横向切换 | horizontal-switch | scene | 串行 | 0ms | 180ms | 180ms |"
    );
    expect(markdownText).not.toContain("目标对象");
    expect(document.querySelector(".composition-resize-handle")).toBeTruthy();
    expect(document.querySelector(".composition-step")?.textContent).not.toContain("上移");
    expect(document.querySelector(".composition-step")?.textContent).not.toContain("下移");
    const laneText = Array.from(document.querySelectorAll(".composition-lane"))
      .map((lane) => lane.textContent ?? "")
      .join(" ");
    expect(laneText).toContain("标题");
    expect(laneText).toContain("正文");
    expect(laneText).toContain("图片位");
  });

  it("generates editable composition draft steps from the prompt", async () => {
    // 生成入口走 LLM client;无 server 时降级到确定性本地 mock。
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("no server in test");
      })
    );
    const app = renderApp();
    clickButton("开始使用");
    setPromptInput("做一个弹窗进场，标题先出现，按钮稍后轻弹");

    await clickButtonAsync("生成动效");

    await waitFor(() => expect(app.textContent).toContain("已生成 4 个结构化编排片段"));
    expect(app.textContent).toContain("弹窗反馈");
    expect(app.textContent).toContain("点赞弹跳");
    expect(app.textContent).toContain("本次编排解释");
    expect(app.textContent).toContain("图片位 · 弹窗反馈");
    expect(app.textContent).toContain("主体容器进场");
    expect(app.textContent).toContain("编排片段参数");

    const jsonDownload = document.querySelector<HTMLAnchorElement>(
      'a[download="motion-composition-export.json"]'
    );
    const jsonHref = jsonDownload?.href ?? "";
    const jsonText = decodeURIComponent(jsonHref.slice(jsonHref.indexOf(",") + 1));
    const payload = JSON.parse(jsonText) as {
      timeline: {
        steps: Array<{
          label: string;
          binding: { layerName?: string };
          timing: string;
          startMs: number;
          initial?: { y?: number; opacity?: number };
          easing?: { type: string };
        }>;
      };
    };

    expect(payload.timeline.steps.map((step) => step.label)).toEqual([
      "弹窗反馈",
      "进入屏幕",
      "进入屏幕",
      "点赞弹跳"
    ]);
    expect(payload.timeline.steps[0]).toMatchObject({
      binding: { layerName: "图片位" },
      timing: "sequential",
      startMs: 0,
      initial: { y: 24, opacity: 0 },
      easing: { type: "spring" }
    });
    expect(payload.timeline.steps[3]).toMatchObject({
      binding: { layerName: "主按钮" },
      timing: "parallel",
      startMs: 180,
      easing: { type: "spring" }
    });

    await clickButtonAsync("生成动效");

    await waitFor(() => expect(app.textContent).toContain("没有新增编排片段"));
    expect(app.textContent).toContain("已跳过「弹窗反馈」");
    expect(app.textContent).toContain("避免后续片段覆盖已有编排");
  });

  it("selects composition steps and shows step-specific controls in the inspector", () => {
    seedSampleWorkspace();
    renderApp();

    addPresetToComposition("进入屏幕");
    addPresetToComposition("容器变化");
    selectCompositionStep("进入屏幕");

    const inspectorText = document.querySelector(".inspector-shell")?.textContent ?? "";
    expect(inspectorText).toContain("编排片段参数");
    expect(inspectorText).toContain("进入屏幕");
    expect(inspectorText).toContain("开始时间 ms");
    expect(inspectorText).toContain("片段时长 ms");
    expect(inspectorText).not.toContain("片段延迟 ms");
    expect(inspectorText).toContain("起始 X");
    expect(inspectorText).toContain("结束 X");
    expect(inspectorText).toContain("片段缓动");
    expect(inspectorText).toContain("恢复预设默认值");

    changeInputByLabel("起始 X", "48");
    expect(document.querySelector<HTMLInputElement>('input[aria-label="起始 X"]')?.value).toBe("48");
  });

  it("keeps exit-final composition steps at their leaving state after playback ends", () => {
    seedSampleWorkspace();
    renderApp();

    addPresetToComposition("永久离开");
    const seek = document.querySelector<HTMLInputElement>(".seek-control input");
    if (!seek) throw new Error("Seek control not found");

    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(seek, "100");
      seek.dispatchEvent(new Event("input", { bubbles: true }));
      seek.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const title = document.querySelector<HTMLElement>(".modal-title");
    expect(title?.style.opacity).toBe("0");
    expect(title?.style.transform).toContain("translate(0px, 8px)");
  });

  it("shows timeline ticks and lets the inspector edit a step start time", () => {
    seedSampleWorkspace();
    renderApp();

    addPresetToComposition("进入屏幕");
    addPresetToComposition("容器变化");
    selectCompositionStep("容器变化");

    expect(document.querySelector(".timeline-scale")?.textContent).toContain("250ms");
    expect(Array.from(document.querySelectorAll(".step-window")).map((node) => node.textContent)).toContain(
      "240ms - 580ms"
    );

    changeInputByLabel("片段开始时间 ms", "120");

    expect(document.querySelector<HTMLInputElement>('input[aria-label="片段开始时间 ms"]')?.value).toBe(
      "120"
    );
    expect(Array.from(document.querySelectorAll(".step-window")).map((node) => node.textContent)).toContain(
      "120ms - 460ms"
    );
    expect(document.querySelector(".composition-track")?.textContent).toContain("并行于上一段");
  });

  it("drags a composition step horizontally to update its start time", () => {
    seedSampleWorkspace();
    renderApp();

    addPresetToComposition("进入屏幕");
    addPresetToComposition("容器变化");

    dragCompositionStep("容器变化", 160);

    expect(Array.from(document.querySelectorAll(".step-window")).map((node) => node.textContent)).toContain(
      "472ms - 812ms"
    );
    expect(document.querySelector(".composition-track")?.textContent).toContain("容器变化");
  });

  it("collapses timeline lanes and shows lane status", () => {
    seedSampleWorkspace();
    const app = renderApp();
    addPresetToComposition("进入屏幕");

    expect(app.textContent).toContain("显示 · 可编辑");
    clickByLabel("折叠轨道 标题");

    expect(document.querySelector(".composition-track")?.textContent).toContain("1 个片段");
    expect(document.querySelector(".composition-lane.is-collapsed")).toBeTruthy();
  });

  it("adds a combo preset to the composition timeline", () => {
    const app = renderApp();
    clickButton("开始使用");

    const combo = Array.from(document.querySelectorAll(".preset-item")).find((node) =>
      node.textContent?.includes("弹窗进场组合")
    );
    const comboButton = combo?.querySelector<HTMLButtonElement>(".preset-apply");
    if (!comboButton) throw new Error("Combo preset button not found");
    act(() => {
      comboButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(app.textContent).toContain("遮罩浮现");
    expect(app.textContent).toContain("弹窗反馈");
    expect(document.querySelectorAll(".composition-step")).toHaveLength(2);
  });

  it("shows atomic preset constraints and grouped guideline definitions", () => {
    const app = renderApp();
    clickButton("开始使用");

    clickPresetTab("转场");
    expect(app.textContent).toContain("页面转场");
    expect(app.textContent).toContain("trajectory · 300ms · 非弹性");
    clickPresetTab("底板");
    expect(app.textContent).toContain("底部面板");
    expect(app.textContent).toContain("scene · 320ms · 非弹性");

    clickButton("规范");
    expect(app.textContent).toContain("规范库");
    expect(app.textContent).toContain("不适用场景");
    const firstGuideline = document.querySelector<HTMLDetailsElement>(".guideline-card");
    expect(firstGuideline).toBeTruthy();
    const summary = firstGuideline?.querySelector("summary");
    expect(summary?.querySelector("strong")?.textContent?.trim()).toBeTruthy();
    expect(summary?.querySelector(".guideline-scene-tag")?.textContent?.trim()).toBeTruthy();
    expect(firstGuideline?.querySelector(".guideline-card-body")?.textContent).toContain("规范定义");
  });

  it("shows local project save status controls", () => {
    const app = renderApp();
    clickButton("开始使用");

    expect(app.textContent).toContain("本地自动保存");
    clickButton("清除自动保存");
    expect(app.textContent).toContain("已清除本地自动保存");
  });

  it("groups parallel steps with shared timeline color and combined labels", () => {
    seedSampleWorkspace();
    renderApp();
    addPresetToComposition("进入屏幕");
    selectLayer("正文");
    addPresetToComposition("容器变化");
    toggleCompositionStepTiming("容器变化");

    const segments = Array.from(document.querySelectorAll<HTMLElement>(".timeline-segment"));
    expect(segments).toHaveLength(2);
    expect(segments[0]?.textContent).toContain("进入屏幕+容器变化");
    expect(segments[1]?.textContent).toContain("进入屏幕+容器变化");
    expect(segments[0]?.style.backgroundColor).toBe(segments[1]?.style.backgroundColor);
    expect(document.querySelector(".composition-track")?.textContent).toContain("并行于上一段");
    expect(document.querySelectorAll(".composition-step.is-active")).toHaveLength(2);
    expect(document.querySelectorAll(".composition-lane").length).toBeGreaterThanOrEqual(6);
    const laneText = Array.from(document.querySelectorAll(".composition-lane"))
      .map((lane) => lane.textContent ?? "")
      .join(" ");
    expect(laneText).toContain("标题");
    expect(laneText).toContain("正文");
    expect(laneText).toContain("图片位");
    expect(laneText).toContain("图层轨道");
  });

  it("applies mobile app motion presets to the selected layer", () => {
    seedSampleWorkspace();
    const app = renderApp();

    clickPresetApply("横向切换");

    expect(app.textContent).toContain("已应用动效");
    expect(app.textContent).toContain("图层：标题");
    expect(app.textContent).toContain("modal / medium / 280ms");
  });

  it("applies exit-final as a fade-out when used directly on the selected layer", () => {
    seedSampleWorkspace();
    renderApp();

    clickPresetApply("永久离开");

    const title = document.querySelector<HTMLElement>(".modal-title");
    expect(title?.className).toContain("motion-fade");
    expect(title?.style.getPropertyValue("--mc-layer-opacity-from")).toBe("1");
    expect(title?.style.getPropertyValue("--mc-layer-opacity-to")).toBe("0");
  });

  it("does not load the sample card when applying motion before creating content", () => {
    const app = renderApp();
    clickButton("开始使用");

    clickPresetApply("横向切换");

    expect(app.textContent).not.toContain("从空白画布开始");
    expect(document.querySelector(".canvas-empty-state")).toBeNull();
    expect(document.querySelector(".motion-target")).toBeNull();
    expect(document.querySelectorAll(".free-layer")).toHaveLength(0);
    expect(app.textContent).not.toContain("新品上线提醒");
    expect(app.textContent).not.toContain("图片位");
    expect(app.textContent).toContain("未应用图层动效");
  });

  it("explains automatic corrections for conflicting app motion presets", () => {
    seedSampleWorkspace();
    const app = renderApp();

    clickPresetApply("容器变化");
    clickPresetApply("骨架屏加载");

    expect(app.textContent).toContain("规范修正");
    expect(app.textContent).toContain("已移除位移/回弹组合");
    expect(app.textContent).toContain("骨架屏加载只允许原位透明度变化");
  });

  it("reads Zero frame nodes and maps the generated morph onto editable layers and timeline", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? "{}")) as { nodeId?: string };
        const fixture = body.nodeId === "28:19" ? "info-collapsed" : "info-expanded";
        return new Response(JSON.stringify({ snapshot: JSON.parse(frameFixture(fixture)) }), { status: 200 });
      })
    );
    const app = renderApp();
    clickButton("开始使用");
    clickButton("帧间动效");
    clickButton("低保真调试");

    await clickButtonAsync("从 Zero 读取 legacy 低保真时间线");

    await waitFor(() => expect(app.textContent).toContain("帧间形变"));
    expect(app.textContent).toContain("多图层时间轴");
    expect(app.textContent).toContain("继续指派");
    expect(app.textContent).toContain("编排片段参数");
    expect(app.textContent).not.toContain("时长偏慢");
    expect(app.textContent).not.toContain("底层容器避免弹簧");
    expect(document.querySelector(".motion-target")).toBeFalsy();
    expect(document.querySelector(".canvas-hints")).toBeFalsy();
    expect(document.querySelector(".free-layer.is-selected")).toBeFalsy();
    expect(document.querySelector(".artboard-stage")?.className).toContain("artboard-custom");
    expect(document.querySelector<HTMLImageElement>(".artboard-background-image")).toBeFalsy();
    expect(document.querySelectorAll(".free-layer").length).toBeGreaterThan(0);
    expect(document.querySelectorAll(".composition-step").length).toBeGreaterThan(0);
    expect(document.querySelector<HTMLInputElement>('input[aria-label="结束 宽度"]')).toBeTruthy();

    const enteringLayer = Array.from(document.querySelectorAll<HTMLElement>(".free-layer")).find(
      (layer) => layer.textContent?.trim() === "待确认 2"
    );
    expect(enteringLayer?.style.display).toBe("none");

    const seek = document.querySelector<HTMLInputElement>(".seek-control input");
    if (!seek) throw new Error("Seek control not found");
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(seek, "100");
      seek.dispatchEvent(new Event("input", { bubbles: true }));
      seek.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(enteringLayer?.style.display).not.toBe("none");
  });

  it("reads Zero visual snapshots and renders high-fidelity iframe previews", async () => {
    const fetchSpy = vi.fn(async (url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { nodeId?: "28:19" | "28:2" };
      if (!String(url).includes("/api/zero/visual-snapshot")) {
        return new Response(JSON.stringify({ error: "unexpected endpoint" }), { status: 500 });
      }
      return new Response(
        JSON.stringify({
          snapshot: visualFixture(body.nodeId ?? "28:2"),
          source: "real-zero-mcp-http",
          bridge: "node scripts/zero-mcp-visual-bridge.mjs --node-id {nodeId}"
        }),
        {
          status: 200
        }
      );
    });
    vi.stubGlobal("fetch", fetchSpy);

    const app = renderApp();
    clickButton("开始使用");
    clickButton("帧间动效");
    clickButton("高保真预览");

    await clickButtonAsync("从 Zero 读取并生成高保真时间线");

    await waitFor(() => expect(app.textContent).toContain("当前节点：未选择"));
    expect(app.textContent).toContain("来源：real-zero-mcp-http");
    expect(app.textContent).toContain("首帧：信息收起状态");
    expect(app.textContent).toContain("尾帧：信息展开状态");
    expect(app.textContent).toContain("matched");
    expect(app.textContent).toContain("enter");
    expect(app.textContent).toContain("unresolved");
    expect(app.textContent).toContain("高保真形变");
    expect(app.textContent).toContain("多图层时间轴");
    expect(document.querySelectorAll(".composition-step").length).toBeGreaterThan(0);
    const htmlDownload = document.querySelector<HTMLAnchorElement>(
      'a[download="motion-composition-export.html"]'
    );
    const htmlHref = htmlDownload?.href ?? "";
    const htmlText = decodeURIComponent(htmlHref.slice(htmlHref.indexOf(",") + 1));
    expect(htmlText).toContain("mc-zero-stage");
    expect(htmlText).toContain('data-node-id="28:32"');
    expect(htmlText).not.toContain("mc-comp-target");
    expect(document.querySelector(".zero-visual-main-stage iframe.visual-stage")).toBeTruthy();
    clickButton("播放高保真预览");
    expect(app.textContent).toContain("暂停高保真预览");
    const iframe = document.querySelector<HTMLIFrameElement>("iframe.visual-stage");
    expect(iframe).toBeTruthy();
    expect(iframe?.title).toBe("信息收起状态");
    expect(iframe?.srcdoc).toContain('data-node-id="28:32"');
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "motion-copilot:zero-node-select", nodeId: "28:11" },
          source: iframe?.contentWindow ?? window
        })
      );
    });
    await waitFor(() => {
      expect(savedWorkspace().document.selectedLayerId).toBe("zero-visual-28-32");
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/zero/visual-snapshot",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("reads Zero layer snapshots through the independent layer entry and exports layer HTML", async () => {
    const fetchSpy = vi.fn(async (url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { nodeId?: "28:19" | "28:2" };
      if (!String(url).includes("/api/zero/layer-snapshot")) {
        return new Response(JSON.stringify({ error: "unexpected endpoint" }), { status: 500 });
      }
      return new Response(
        JSON.stringify({
          snapshot: layerFixture(body.nodeId ?? "28:2"),
          source: "real-zero-mcp-http",
          bridge: "node scripts/zero-mcp-layer-bridge.mjs --node-id {nodeId}"
        }),
        { status: 200 }
      );
    });
    vi.stubGlobal("fetch", fetchSpy);

    const app = renderApp();
    clickButton("开始使用");
    clickButton("帧间动效");
    useLegacyZeroLayerFixtureIds();

    await clickButtonAsync("从 Zero 原生图层生成动效");

    await waitFor(() => expect(app.textContent).toContain("Zero 图层形变"));
    expect(app.textContent).toContain("Zero 原生图层");
    expect(app.textContent).toContain("来源：real-zero-mcp-http");
    expect(app.textContent).toContain("首帧：信息收起状态");
    expect(app.textContent).toContain("尾帧：信息展开状态");
    expect(app.textContent).toContain("对象辅助");
    expect(app.textContent).toContain("Harness 诊断");
    expect(app.textContent).toContain("5→5 layers");
    expect(app.textContent).toContain("motion");
    expect(app.textContent).toContain("质量门禁");
    expect(app.textContent).toContain("降级生成");
    expect(app.textContent).toContain("safe-fade-unmatched");
    expect(app.textContent).toContain("DOWNGRADE_LOW_CONFIDENCE_TO_FADE");
    expect(app.textContent).toContain("MATCH_LOW_CONFIDENCE");
    expect(app.textContent).toContain("REVIEW_LOW_CONFIDENCE_MATCH");
    expect(app.textContent).toContain("方案采样");
    expect(app.textContent).toContain("9 recipes");
    expect(app.textContent).toContain("采样点 0 / 25 / 50 / 75 / 100%");
    await waitFor(() => {
      const source = savedWorkspace().document.visualSource;
      expect(source?.kind).toBe("zero-layer-morph");
      if (source?.kind !== "zero-layer-morph") return;
      expect(source.diagnosticReport?.schemaVersion).toBe("motion-copilot.zero-layer-diagnostic.v1");
      expect(source.diagnosticReport?.matching.unresolved).toBeGreaterThan(0);
      expect(source.diagnosticReport?.gate).toMatchObject({
        status: "degraded",
        pass: false,
        strategy: "safe-fade-unmatched"
      });
    });
    expect(document.querySelector(".zero-layer-main-stage")).toBeTruthy();
    expect(document.querySelector('[data-zero-layer-id="28:34"]')).toBeTruthy();
    expect(document.querySelector(".zero-visual-main-stage")).toBeFalsy();
    await waitFor(() => expect(savedWorkspace().document.visualSource?.kind).toBe("zero-layer-morph"));

    const htmlDownload = document.querySelector<HTMLAnchorElement>(
      'a[download="motion-composition-export.html"]'
    );
    const htmlHref = htmlDownload?.href ?? "";
    const htmlText = decodeURIComponent(htmlHref.slice(htmlHref.indexOf(",") + 1));
    expect(htmlText).toContain("mc-zero-layer-stage");
    expect(htmlText).toContain('data-zero-layer-id="28:34"');
    expect(htmlText).not.toContain("mc-zero-stage");
    expect(htmlText).not.toContain('data-node-id="28:34"');
    expect(htmlDownload?.textContent).toContain("下载 Zero 原生动效 HTML");
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/zero/layer-snapshot",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("shows harness auto-optimization after downgrading risky Zero layer morphs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? "{}")) as { nodeId?: "28:19" | "28:2" };
        if (!String(url).includes("/api/zero/layer-snapshot")) {
          return new Response(JSON.stringify({ error: "unexpected endpoint" }), { status: 500 });
        }
        return new Response(JSON.stringify({ snapshot: lowConfidenceLayerFixture(body.nodeId ?? "28:2") }), {
          status: 200
        });
      })
    );

    const app = renderApp();
    clickButton("开始使用");
    clickButton("帧间动效");
    useLegacyZeroLayerFixtureIds();

    await clickButtonAsync("从 Zero 原生图层生成动效");

    await waitFor(() => expect(app.textContent).toContain("自动优化"));
    expect(app.textContent).toContain("DOWNGRADE_LOW_CONFIDENCE_TO_FADE");
    await waitFor(() => {
      const source = savedWorkspace().document.visualSource;
      expect(source?.kind).toBe("zero-layer-morph");
      if (source?.kind !== "zero-layer-morph") return;
      expect(source.optimizerReport?.applied).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "DOWNGRADE_LOW_CONFIDENCE_TO_FADE"
          })
        ])
      );
      expect(source.bindingResult.bindings.some((binding) => binding.nodeId === "28:34")).toBe(false);
      expect(source.bindingResult.exit.map((node) => node.nodeId)).toContain("28:34");
      expect(source.bindingResult.enter.map((node) => node.nodeId)).toContain("28:99");
    });
  });

  it("applies Zero native motion recipes from the frame motion panel", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? "{}")) as { nodeId?: "28:19" | "28:2" };
        if (!String(url).includes("/api/zero/layer-snapshot")) {
          return new Response(JSON.stringify({ error: "unexpected endpoint" }), { status: 500 });
        }
        return new Response(JSON.stringify({ snapshot: layerFixture(body.nodeId ?? "28:2") }), {
          status: 200
        });
      })
    );

    const app = renderApp();
    clickButton("开始使用");
    clickButton("帧间动效");
    useLegacyZeroLayerFixtureIds();
    await clickButtonAsync("从 Zero 原生图层生成动效");

    expect(app.textContent).toContain("动效方案");
    expect(app.textContent).toContain("丝滑形变");
    expect(app.textContent).toContain("弹性展开");
    expect(app.textContent).toContain("状态切换");
    expect(app.textContent).toContain("容器优先");
    expect(app.textContent).toContain("内容错峰");
    expect(app.textContent).toContain("遮罩揭示");
    expect(app.textContent).toContain("焦点引导");
    expect(app.textContent).toContain("轴向展开");
    expect(app.textContent).toContain("列表重排");

    clickButton("展开");
    expect(app.textContent).toContain("弹性展开");
    expect(app.textContent).toContain("容器优先");
    expect(app.textContent).toContain("轴向展开");
    expect(app.textContent).not.toContain("内容错峰适合多文字");

    clickButton("全部");

    clickByLabel("弹性展开");

    await waitFor(() => {
      const workspace = savedWorkspace();
      expect(workspace.compositionSteps?.some((step) => step.label === "弹性主容器")).toBe(true);
      expect(
        workspace.compositionSteps
          ?.filter((step) => step.id.startsWith("zero-layer-match"))
          .every((step) => step.easing?.type === "classic" && step.initial?.scale === 1)
      ).toBe(true);
    });
    expect(app.textContent).toContain("弹性展开");

    clickByLabel("状态切换");

    await waitFor(() => {
      const textSteps = savedWorkspace().compositionSteps?.filter((step) => step.label === "状态文字切换");
      expect(textSteps).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            initial: expect.objectContaining({ opacity: 1 }),
            animate: expect.objectContaining({ opacity: 0 })
          }),
          expect.objectContaining({
            initial: expect.objectContaining({ opacity: 0.72 }),
            animate: expect.objectContaining({ opacity: 1 })
          })
        ])
      );
    });
  });

  it("selects Zero first and tail frames from derived node candidates", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? "{}")) as { nodeId?: "28:19" | "28:2" | "bg" };
        if (!String(url).includes("/api/zero/layer-snapshot")) {
          return new Response(JSON.stringify({ error: "unexpected endpoint" }), { status: 500 });
        }
        return new Response(JSON.stringify({ snapshot: layerFixture(body.nodeId === "28:2" ? "28:2" : "28:19") }), {
          status: 200
        });
      })
    );

    const app = renderApp();
    clickButton("开始使用");
    clickButton("帧间动效");
    useLegacyZeroLayerFixtureIds();
    await clickButtonAsync("从 Zero 原生图层生成动效");

    await waitFor(() => expect(app.textContent).toContain("首尾帧候选节点"));
    const candidatePanel = document.querySelector<HTMLElement>('[aria-label="Zero 首尾帧候选节点"]');
    expect(candidatePanel?.textContent).toContain("组件背景");
    expect(candidatePanel?.textContent).toContain("待确认文字");

    clickByLabel("设为首帧 组件背景");

    await waitFor(() => {
      expect(document.querySelector<HTMLInputElement>('input[aria-label="Zero 图层首帧 nodeId"]')?.value).toBe(
        "28:28"
      );
    });

    changeInputByLabel("搜索 Zero 候选节点", "待确认文字");
    await waitFor(() => {
      const nextCandidatePanel = document.querySelector<HTMLElement>('[aria-label="Zero 首尾帧候选节点"]');
      expect(nextCandidatePanel?.textContent).toContain("待确认文字");
      expect(nextCandidatePanel?.textContent).not.toContain("组件背景");
    });
  });

  it("edits selected Zero layer geometry through independent layer overrides", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? "{}")) as { nodeId?: "28:19" | "28:2" };
        if (!String(url).includes("/api/zero/layer-snapshot")) {
          return new Response(JSON.stringify({ error: "unexpected endpoint" }), { status: 500 });
        }
        return new Response(JSON.stringify({ snapshot: layerFixture(body.nodeId ?? "28:2") }), {
          status: 200
        });
      })
    );

    renderApp();
    clickButton("开始使用");
    clickButton("帧间动效");
    useLegacyZeroLayerFixtureIds();
    await clickButtonAsync("从 Zero 原生图层生成动效");

    const layerButton = document.querySelector<HTMLButtonElement>(
      '.zero-layer-preview-grid [data-zero-layer-id="28:34"]'
    );
    if (!layerButton) throw new Error("Zero preview layer button for 状态胶囊 not found");
    act(() => {
      layerButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(document.querySelector<HTMLInputElement>('input[aria-label="Zero 图层宽度"]')).toBeTruthy()
    );
    changeInputByLabel("Zero 图层宽度", "144");
    changeInputByLabel("Zero 图层圆角", "12");
    changeInputByLabel("Zero 图层透明度", "0.64");

    await waitFor(() => {
      const source = savedWorkspace().document.visualSource;
      expect(source?.kind).toBe("zero-layer-morph");
      if (source?.kind !== "zero-layer-morph") return;
      expect(source.nodeOverrides).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            frame: "from",
            nodeId: "28:34",
            width: 144,
            cornerRadius: 12,
            opacity: 0.64
          }),
          expect.objectContaining({
            frame: "to",
            nodeId: "28:12",
            width: 144,
            cornerRadius: 12,
            opacity: 0.64
          })
        ])
      );
      expect(JSON.stringify(source.nodeOverrides)).not.toContain('"radius"');
    });
  });

  it("keeps generic layer styling out of the property tab for Zero native frame motion", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? "{}")) as { nodeId?: "28:19" | "28:2" };
        if (!String(url).includes("/api/zero/layer-snapshot")) {
          return new Response(JSON.stringify({ error: "unexpected endpoint" }), { status: 500 });
        }
        return new Response(JSON.stringify({ snapshot: layerFixture(body.nodeId ?? "28:2") }), {
          status: 200
        });
      })
    );

    const app = renderApp();
    clickButton("开始使用");
    clickButton("帧间动效");
    useLegacyZeroLayerFixtureIds();
    await clickButtonAsync("从 Zero 原生图层生成动效");

    clickButton("属性");

    const inspectorText = document.querySelector(".inspector-shell")?.textContent ?? "";
    expect(inspectorText).toContain("帧间动效模式");
    expect(inspectorText).toContain("属性面板只保留动效片段参数");
    expect(inspectorText).toContain("编排片段参数");
    expect(inspectorText).not.toContain("画布与素材");
    expect(inspectorText).not.toContain("内容与动效");
    expect(inspectorText).not.toContain("图层圆角");
    expect(app.textContent).toContain("Zero 图层形变");
  });

  it("edits the Zero layer selected from the main canvas", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? "{}")) as { nodeId?: "28:19" | "28:2" };
        if (!String(url).includes("/api/zero/layer-snapshot")) {
          return new Response(JSON.stringify({ error: "unexpected endpoint" }), { status: 500 });
        }
        return new Response(JSON.stringify({ snapshot: layerFixture(body.nodeId ?? "28:2") }), {
          status: 200
        });
      })
    );

    renderApp();
    clickButton("开始使用");
    clickButton("帧间动效");
    useLegacyZeroLayerFixtureIds();
    await clickButtonAsync("从 Zero 原生图层生成动效");

    const canvasLayer = document.querySelector<HTMLButtonElement>(
      '.zero-layer-main-stage [data-zero-layer-id="28:34"]'
    );
    if (!canvasLayer) throw new Error("main Zero layer button for 状态胶囊 not found");
    act(() => {
      canvasLayer.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    changeInputByLabel("Zero 图层宽度", "144");

    await waitFor(() => {
      const source = savedWorkspace().document.visualSource;
      expect(source?.kind).toBe("zero-layer-morph");
      if (source?.kind !== "zero-layer-morph") return;
      expect(source.nodeOverrides).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ frame: "from", nodeId: "28:34", width: 144 }),
          expect.objectContaining({ frame: "to", nodeId: "28:12", width: 144 })
        ])
      );
    });
  });

  it("allows editing Zero layers that only exist in the tail frame", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? "{}")) as { nodeId?: "28:19" | "28:2" };
        if (!String(url).includes("/api/zero/layer-snapshot")) {
          return new Response(JSON.stringify({ error: "unexpected endpoint" }), { status: 500 });
        }
        return new Response(JSON.stringify({ snapshot: layerFixture(body.nodeId ?? "28:2") }), {
          status: 200
        });
      })
    );

    renderApp();
    clickButton("开始使用");
    clickButton("帧间动效");
    useLegacyZeroLayerFixtureIds();
    await clickButtonAsync("从 Zero 原生图层生成动效");

    const layerButton = document.querySelector<HTMLButtonElement>(
      '.zero-layer-preview-grid [data-zero-layer-id="28:41"]'
    );
    if (!layerButton) throw new Error("Zero preview layer button for 尾帧专有 not found");
    act(() => {
      layerButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    changeInputByLabel("Zero 图层宽度", "44");

    await waitFor(() => {
      const source = savedWorkspace().document.visualSource;
      expect(source?.kind).toBe("zero-layer-morph");
      if (source?.kind !== "zero-layer-morph") return;
      expect(source.nodeOverrides).toEqual(
        expect.arrayContaining([expect.objectContaining({ frame: "to", nodeId: "28:41", width: 44 })])
      );
    });
  });

  it("restores persisted Zero layer harness diagnostics from the saved workspace", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? "{}")) as { nodeId?: "28:19" | "28:2" };
        if (!String(url).includes("/api/zero/layer-snapshot")) {
          return new Response(JSON.stringify({ error: "unexpected endpoint" }), { status: 500 });
        }
        return new Response(JSON.stringify({ snapshot: layerFixture(body.nodeId ?? "28:2") }), {
          status: 200
        });
      })
    );

    const app = renderApp();
    clickButton("开始使用");
    clickButton("帧间动效");
    useLegacyZeroLayerFixtureIds();
    await clickButtonAsync("从 Zero 原生图层生成动效");
    await waitFor(() => expect(app.textContent).toContain("Harness 诊断"));
    await waitFor(() => {
      const source = savedWorkspace().document.visualSource;
      expect(source?.kind).toBe("zero-layer-morph");
      if (source?.kind !== "zero-layer-morph") return;
      expect(source.diagnosticReport?.risks.some((risk) => risk.code === "MATCH_LOW_CONFIDENCE")).toBe(true);
    });

    act(() => {
      root?.unmount();
    });
    host?.remove();
    root = undefined;
    host = undefined;

    const restored = renderApp();
    clickButton("帧间动效");

    expect(restored.textContent).toContain("已恢复上次自动保存的项目");
    expect(restored.textContent).toContain("Harness 诊断");
    expect(restored.textContent).toContain("MATCH_LOW_CONFIDENCE");
  });

  it("derives a quality gate when restoring an older Zero layer diagnostic report", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? "{}")) as { nodeId?: "28:19" | "28:2" };
        if (!String(url).includes("/api/zero/layer-snapshot")) {
          return new Response(JSON.stringify({ error: "unexpected endpoint" }), { status: 500 });
        }
        return new Response(JSON.stringify({ snapshot: layerFixture(body.nodeId ?? "28:2") }), {
          status: 200
        });
      })
    );

    const app = renderApp();
    clickButton("开始使用");
    clickButton("帧间动效");
    useLegacyZeroLayerFixtureIds();
    await clickButtonAsync("从 Zero 原生图层生成动效");
    await waitFor(() => expect(app.textContent).toContain("质量门禁"));
    await waitFor(() => expect(globalThis.localStorage?.getItem("motion-copilot-workspace")).toBeTruthy());

    const saved = savedWorkspace();
    const source = saved.document.visualSource;
    expect(source?.kind).toBe("zero-layer-morph");
    if (source?.kind !== "zero-layer-morph") throw new Error("expected Zero layer source");
    const legacyReport = { ...source.diagnosticReport };
    delete (legacyReport as { gate?: unknown }).gate;
    source.diagnosticReport = legacyReport as NonNullable<typeof source.diagnosticReport>;
    globalThis.localStorage?.setItem("motion-copilot-workspace", JSON.stringify(saved));

    act(() => {
      root?.unmount();
    });
    host?.remove();
    root = undefined;
    host = undefined;

    const restored = renderApp();
    clickButton("帧间动效");

    expect(restored.textContent).toContain("已恢复上次自动保存的项目");
    expect(restored.textContent).toContain("质量门禁");
    expect(restored.textContent).toContain("降级生成");
  });

  it("edits selected high-fidelity Zero node geometry through node overrides", async () => {
    await importVisualFrameMorphFixture();

    const bindingButton = Array.from(document.querySelectorAll<HTMLButtonElement>(".binding-main")).find(
      (button) => button.textContent?.includes("28:32")
    );
    if (!bindingButton) throw new Error("Binding button for 28:32 not found");
    act(() => {
      bindingButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(document.querySelector<HTMLInputElement>('input[aria-label="高保真节点宽度"]')).toBeTruthy()
    );
    changeInputByLabel("高保真节点宽度", "144");
    changeInputByLabel("高保真节点圆角", "12");

    await waitFor(() => {
      const source = savedWorkspace().document.visualSource;
      expect(source?.kind).toBe("zero-visual-morph");
      if (source?.kind !== "zero-visual-morph") return;
      expect(source.nodeOverrides).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            nodeId: "28:32",
            width: 144,
            radius: 12
          })
        ])
      );
      expect(source.restorationReportCache).toBeUndefined();
    });
  });

  it("passes high-fidelity node override CSS to visual preview", async () => {
    await importVisualFrameMorphFixture();

    const bindingButton = Array.from(document.querySelectorAll<HTMLButtonElement>(".binding-main")).find(
      (button) => button.textContent?.includes("28:32")
    );
    if (!bindingButton) throw new Error("Binding button for 28:32 not found");
    act(() => {
      bindingButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(document.querySelector<HTMLInputElement>('input[aria-label="高保真节点 X"]')).toBeTruthy()
    );
    changeInputByLabel("高保真节点 X", "33");

    await waitFor(() => {
      const iframes = Array.from(document.querySelectorAll<HTMLIFrameElement>("iframe.visual-stage"));
      expect(iframes.some((iframe) => iframe.srcdoc.includes("left:33px!important;"))).toBe(true);
    });
  });

  it("scales child nodes when editing a high-fidelity component object", async () => {
    await importVisualFrameMorphFixture();

    const objectButton = Array.from(document.querySelectorAll<HTMLButtonElement>(".object-row-main")).find(
      (button) => button.textContent?.includes("信息收起状态")
    );
    if (!objectButton) throw new Error("Object row for root component not found");
    act(() => {
      objectButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(document.querySelector<HTMLInputElement>('input[aria-label="高保真节点宽度"]')).toBeTruthy()
    );
    changeInputByLabel("高保真节点 X", "10");
    changeInputByLabel("高保真节点宽度", "1010");

    await waitFor(() => {
      const iframes = Array.from(document.querySelectorAll<HTMLIFrameElement>("iframe.visual-stage"));
      expect(
        iframes.some(
          (iframe) =>
            iframe.srcdoc.includes('[data-node-id="28:32"]') &&
            iframe.srcdoc.includes("left:428px!important;") &&
            iframe.srcdoc.includes("width:120px!important;")
        )
      ).toBe(true);
    });
  });

  it("persists high-fidelity node overrides across workspace restore", async () => {
    await importVisualFrameMorphFixture();

    const bindingButton = Array.from(document.querySelectorAll<HTMLButtonElement>(".binding-main")).find(
      (button) => button.textContent?.includes("28:32")
    );
    if (!bindingButton) throw new Error("Binding button for 28:32 not found");
    act(() => {
      bindingButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await waitFor(() =>
      expect(document.querySelector<HTMLInputElement>('input[aria-label="高保真节点宽度"]')).toBeTruthy()
    );
    changeInputByLabel("高保真节点宽度", "166");

    await waitFor(() => {
      const source = savedWorkspace().document.visualSource;
      expect(source?.kind).toBe("zero-visual-morph");
      if (source?.kind === "zero-visual-morph") {
        expect(source.nodeOverrides).toEqual(
          expect.arrayContaining([expect.objectContaining({ nodeId: "28:32", width: 166 })])
        );
      }
    });

    act(() => {
      root?.unmount();
    });
    host?.remove();
    root = undefined;
    host = undefined;

    renderApp();
    clickButton("帧间动效");
    await waitFor(() => expect(document.querySelector(".binding-main")).toBeTruthy());
    const restoredBindingButton = Array.from(
      document.querySelectorAll<HTMLButtonElement>(".binding-main")
    ).find((button) => button.textContent?.includes("28:32"));
    if (!restoredBindingButton) throw new Error("Restored binding button for 28:32 not found");
    act(() => {
      restoredBindingButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(document.querySelector<HTMLInputElement>('input[aria-label="高保真节点宽度"]')?.value).toBe(
        "166"
      )
    );
  });

  it("keeps manual enter overrides bound to the target frame and persists the report cache", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? "{}")) as { nodeId?: "28:19" | "28:2" };
        if (!String(url).includes("/api/zero/visual-snapshot")) {
          return new Response(JSON.stringify({ error: "unexpected endpoint" }), { status: 500 });
        }
        return new Response(JSON.stringify({ snapshot: visualFixture(body.nodeId ?? "28:2") }), {
          status: 200
        });
      })
    );

    const app = renderApp();
    clickButton("开始使用");
    clickButton("帧间动效");
    clickButton("高保真预览");

    await clickButtonAsync("从 Zero 读取并生成高保真时间线");
    await waitFor(() => expect(app.textContent).toContain("matched"));
    expect(app.textContent).toContain("刷新报告");

    clickButtonByTitle("设为 enter");
    await waitFor(() => {
      const source = savedWorkspace().document.visualSource;
      expect(source?.kind).toBe("zero-visual-morph");
      if (source?.kind !== "zero-visual-morph") throw new Error("expected zero visual source");
      expect(source?.userBindingOverrides).toEqual([{ fromNodeId: "28:32", action: "enter" }]);
      expect(source?.bindingResult.enter.map((node) => node.nodeId)).toContain("28:11");
      expect(source?.bindingResult.enter.map((node) => node.nodeId)).not.toContain("28:32");
    });

    clickButton("重新计算报告");
    await waitFor(() => expect(app.textContent).toContain("刷新报告"));
    clickButton("刷新报告");
    await waitFor(() => {
      const source = savedWorkspace().document.visualSource;
      expect(source?.kind).toBe("zero-visual-morph");
      if (source?.kind !== "zero-visual-morph") throw new Error("expected zero visual source");
      expect(source?.restorationReportCache?.report.bindingHash).toBeTruthy();
      expect(source?.restorationReportCache?.bindingHash).toBe(
        source?.restorationReportCache?.report.bindingHash
      );
    });
  });

  it("clears the high-fidelity Zero visual preview when the frame morph track is cleared", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? "{}")) as { nodeId?: "28:19" | "28:2" };
        if (!String(url).includes("/api/zero/visual-snapshot")) {
          return new Response(JSON.stringify({ error: "unexpected endpoint" }), { status: 500 });
        }
        return new Response(JSON.stringify({ snapshot: visualFixture(body.nodeId ?? "28:2") }), {
          status: 200
        });
      })
    );

    const app = renderApp();
    clickButton("开始使用");
    clickButton("帧间动效");
    clickButton("高保真预览");

    await clickButtonAsync("从 Zero 读取并生成高保真时间线");
    await waitFor(() =>
      expect(document.querySelector(".zero-visual-main-stage iframe.visual-stage")).toBeTruthy()
    );

    clickButton("清空轨道");

    await waitFor(() =>
      expect(document.querySelector(".zero-visual-main-stage iframe.visual-stage")).toBeFalsy()
    );
    expect(app.textContent).not.toContain("从空白画布开始");
    expect(document.querySelector(".canvas-empty-state")).toBeNull();
    expect(document.querySelector(".motion-target")).toBeNull();
    expect(document.querySelectorAll(".free-layer")).toHaveLength(0);
  });

  it("clears stale guideline hint overlays when restoring a saved Zero frame morph workspace", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? "{}")) as { nodeId?: string };
        const fixture = body.nodeId === "28:19" ? "info-collapsed" : "info-expanded";
        return new Response(JSON.stringify({ snapshot: JSON.parse(frameFixture(fixture)) }), { status: 200 });
      })
    );
    const app = renderApp();
    clickButton("开始使用");
    clickButton("帧间动效");
    clickButton("低保真调试");

    await clickButtonAsync("从 Zero 读取 legacy 低保真时间线");
    await waitFor(() => expect(app.textContent).toContain("帧间形变"));
    await waitFor(() => expect(globalThis.localStorage?.getItem("motion-copilot-workspace")).toBeTruthy());

    const saved = JSON.parse(globalThis.localStorage?.getItem("motion-copilot-workspace") ?? "{}") as {
      document: {
        guidelineSuggestions?: Array<Record<string, unknown>>;
        layers?: Array<unknown>;
      };
    };
    expect(saved.document.layers?.some((layer) => (layer as { id?: string }).id?.startsWith("zero-"))).toBe(
      true
    );
    saved.document.guidelineSuggestions = [
      {
        id: "bottom-level-no-spring",
        target: { elementId: "primary", field: "timeline.easing" },
        severity: "suggestion",
        title: "底层容器避免弹簧",
        reason: "旧缓存残留",
        status: "open"
      }
    ];
    globalThis.localStorage?.setItem("motion-copilot-workspace", JSON.stringify(saved));

    act(() => {
      root?.unmount();
    });
    host?.remove();
    root = undefined;
    host = undefined;

    const restored = renderApp();

    expect(restored.textContent).toContain("已恢复上次自动保存的项目");
    expect(restored.textContent).not.toContain("底层容器避免弹簧");
    expect(document.querySelector(".canvas-hints")).toBeFalsy();
    expect(restored.textContent).not.toContain("还没有可编辑图层");
    expect(document.querySelector<HTMLImageElement>(".artboard-background-image")).toBeFalsy();
  });

  it("hides stale guideline overlays for old saved frame morph workspaces that lost Zero layers", () => {
    const collapsed = JSON.parse(frameFixture("info-collapsed")) as {
      screenshotUrl: string;
      width: number;
      height: number;
    };
    globalThis.localStorage?.setItem(
      "motion-copilot-workspace",
      JSON.stringify({
        schemaVersion: "0.2",
        hasStarted: true,
        prompt: "生成一个入场和退场的动效",
        presetTarget: "selected-layer",
        compositionSteps: [],
        document: {
          version: "0.1",
          stage: {
            mode: "custom",
            width: collapsed.width,
            height: collapsed.height,
            background: "#ffffff",
            backgroundImage: collapsed.screenshotUrl,
            backgroundAlt: "信息收起状态",
            backgroundFit: "contain",
            backgroundPosition: "left"
          },
          elements: [
            {
              id: "primary",
              name: "信息收起状态 → 信息展开状态",
              role: "background",
              size: "medium",
              initial: { opacity: 0 },
              animate: { opacity: 0 }
            }
          ],
          layers: [],
          appliedPresets: [],
          presetResolutions: [],
          timeline: {
            trigger: "load",
            direction: "move-inside",
            durationMs: 590,
            delayMs: 0,
            easing: {
              type: "spring",
              stiffness: 240,
              damping: 18,
              mass: 1,
              cssFallback: "cubic-bezier(0.34, 1.56, 0.64, 1)"
            },
            repeat: "none"
          },
          guidelineSuggestions: [
            {
              id: "bottom-level-no-spring",
              target: { elementId: "primary", field: "timeline.easing" },
              severity: "suggestion",
              title: "底层容器避免弹簧",
              reason: "旧缓存残留",
              status: "open"
            }
          ]
        }
      })
    );

    const restored = renderApp();

    expect(restored.textContent).toContain("已恢复上次自动保存的项目");
    expect(restored.textContent).not.toContain("底层容器避免弹簧");
    expect(document.querySelector(".canvas-hints")).toBeFalsy();
    expect(document.querySelector<HTMLImageElement>(".artboard-background-image")).toBeFalsy();
  });
});
