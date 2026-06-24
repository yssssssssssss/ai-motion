// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
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
    document: {
      layers: Array<{
        name: string;
        content?: { src?: string };
        style?: Record<string, unknown>;
        layout?: { x: number; y: number; width: number; height: number; aspectLocked?: boolean };
      }>;
    };
  };
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

function setPresetSearch(value: string) {
  const input = document.querySelector<HTMLInputElement>(".preset-search");
  if (!input) throw new Error("Preset search not found");
  act(() => {
    input.value = value;
    input.dispatchEvent(new InputEvent("input", { bubbles: true, data: value }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function findPresetItem(name: string) {
  const items = Array.from(document.querySelectorAll(".preset-item"));
  return items.find((node) => {
    const strong = node.querySelector("strong");
    return strong?.textContent?.trim() === name;
  });
}

const presetTabHints: Partial<Record<string, string>> = {
  "进入屏幕": "转场",
  "容器变化": "转场",
  "横向切换": "横向",
  "骨架屏加载": "骨架"
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
});

describe("Motion Copilot app", () => {
  it("renders the independent workspace and Phase 1 controls", () => {
    const app = renderApp();

    // 先关闭 onboarding
    clickButton("开始使用");
    const text = app.textContent ?? "";

    expect(text).toContain("Motion Copilot");
    expect(text).toContain("实时画布");
    expect(text).toContain("从空白画布开始");
    expect(text).toContain("新建空白");
    expect(text).toContain("加载示例");
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

  it("loads the sample only after the user asks for it", () => {
    const app = renderApp();
    clickButton("开始使用");

    expect(app.textContent).toContain("从空白画布开始");
    expect(app.textContent).not.toContain("新品上线提醒");

    clickButton("加载示例");

    expect(app.textContent).toContain("新品上线提醒");
    expect(app.textContent).not.toContain("从空白画布开始");
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
    const forwardButton = document.querySelector<HTMLButtonElement>(
      'button[aria-label="图层上移 自定义文本 副本"]'
    );
    expect(forwardButton?.disabled).toBe(true);
    clickByLabel("解锁图层 自定义文本 副本");

    clickByLabel("图层置底 自定义文本 副本");
    clickByLabel("图层置顶 自定义文本 副本");

    clickByLabel("删除图层 自定义文本");
    await waitFor(() => {
      expect(app.textContent).not.toContain("自定义文本\n");
      expect(document.querySelector(".composition-track")?.textContent ?? "").not.toContain("自定义文本");
      expect(document.querySelectorAll(".free-layer-text")).toHaveLength(1);
    });
  });

  it("keeps project actions visible in the left rail", () => {
    const app = renderApp();
    clickButton("开始使用");

    const text = app.textContent ?? "";
    expect(text).toContain("项目");
    expect(text).toContain("新建空白");
    expect(text).toContain("加载示例");
  });

  it("changes canvas size from the inspector dropdown", () => {
    renderApp();
    clickButton("开始使用");

    selectValueByLabel("画布尺寸", "web-1440");

    expect(document.querySelector<HTMLInputElement>('input[value="1440"]')).toBeTruthy();
    expect(document.querySelector<HTMLInputElement>('input[value="900"]')).toBeTruthy();
  });

  it("applies a guideline suggestion generated by a style token", () => {
    const app = renderApp();
    clickButton("开始使用");

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
    const app = renderApp();
    clickButton("开始使用");

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
    const app = renderApp();
    clickButton("开始使用");

    clickPresetApply("横向切换");

    expect(app.textContent).toContain("已应用动效");
    expect(app.textContent).toContain("图层：标题");
    expect(app.textContent).toContain("modal / medium / 280ms");
  });

  it("adds presets to the horizontal composition track and previews the track duration", () => {
    const app = renderApp();
    clickButton("开始使用");

    addPresetToComposition("横向切换");

    expect(app.textContent).toContain("多图层时间轴");
    expect(app.textContent).toContain("应用到文档");
    expect(app.textContent).toContain("编排片段参数");
    expect(app.textContent).toContain("片段时长 ms");
    expect(app.textContent).toContain("modal / medium / 180ms");
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

  it("selects composition steps and shows step-specific controls in the inspector", () => {
    renderApp();
    clickButton("开始使用");

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

  it("shows timeline ticks and lets the inspector edit a step start time", () => {
    renderApp();
    clickButton("开始使用");

    addPresetToComposition("进入屏幕");
    addPresetToComposition("容器变化");
    selectCompositionStep("容器变化");

    expect(document.querySelector(".timeline-scale")?.textContent).toContain("250ms");
    expect(Array.from(document.querySelectorAll(".step-window")).map((node) => node.textContent)).toContain(
      "240ms - 580ms"
    );

    changeInputByLabel("片段开始时间 ms", "120");

    expect(document.querySelector<HTMLInputElement>('input[aria-label="片段开始时间 ms"]')?.value).toBe("120");
    expect(Array.from(document.querySelectorAll(".step-window")).map((node) => node.textContent)).toContain(
      "120ms - 460ms"
    );
    expect(document.querySelector(".composition-track")?.textContent).toContain("并行于上一段");
  });

  it("drags a composition step horizontally to update its start time", () => {
    renderApp();
    clickButton("开始使用");

    addPresetToComposition("进入屏幕");
    addPresetToComposition("容器变化");

    dragCompositionStep("容器变化", 160);

    expect(Array.from(document.querySelectorAll(".step-window")).map((node) => node.textContent)).toContain(
      "472ms - 812ms"
    );
    expect(document.querySelector(".composition-track")?.textContent).toContain("容器变化");
  });

  it("collapses timeline lanes and shows lane status", () => {
    const app = renderApp();
    clickButton("开始使用");
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
  });

  it("shows local project save status controls", () => {
    const app = renderApp();
    clickButton("开始使用");

    expect(app.textContent).toContain("本地自动保存");
    clickButton("清除自动保存");
    expect(app.textContent).toContain("已清除本地自动保存");
  });

  it("groups parallel steps with shared timeline color and combined labels", () => {
    renderApp();
    clickButton("开始使用");
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
    const app = renderApp();
    clickButton("开始使用");

    clickPresetApply("横向切换");

    expect(app.textContent).toContain("已应用动效");
    expect(app.textContent).toContain("图层：标题");
    expect(app.textContent).toContain("modal / medium / 280ms");
  });

  it("explains automatic corrections for conflicting app motion presets", () => {
    const app = renderApp();
    clickButton("开始使用");

    clickPresetApply("容器变化");
    clickPresetApply("骨架屏加载");

    expect(app.textContent).toContain("规范修正");
    expect(app.textContent).toContain("已移除位移/回弹组合");
    expect(app.textContent).toContain("骨架屏加载只允许原位透明度变化");
  });
});
