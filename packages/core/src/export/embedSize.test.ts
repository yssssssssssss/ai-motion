import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { composeEmbedPackageFiles } from "./exportPackage";

type Bounds = { left: number; top: number; right: number; bottom: number };
class Box {
  constructor(
    readonly bounds: Bounds,
    readonly parentElement: Box | null = null,
    readonly overflowX = "visible",
    readonly overflowY = "visible"
  ) {}

  getBoundingClientRect() {
    return {
      ...this.bounds,
      width: this.bounds.right - this.bounds.left,
      height: this.bounds.bottom - this.bounds.top
    };
  }
}

type SizeMessage = {
  type: string;
  width: number;
  height: number;
  responsive?: boolean;
  fills?: boolean;
};

function embedFiles() {
  return composeEmbedPackageFiles({
    sourceFiles: { "source/index.html": "<main data-motion-root></main>" },
    manifest: {
      version: "1.0",
      id: "size",
      name: "Size fixture",
      sourceKind: "html-package",
      runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
      params: []
    },
    metadata: { id: "size" },
    patch: { id: "patch", sourceManifestId: "size", values: {} }
  });
}

function frameHarness(root: Box, descendants: Box[], viewportWidth = 100) {
  const messages: SizeMessage[] = [];
  const observed: unknown[] = [];
  let notifyResize = () => {};
  class ResizeObserver {
    constructor(callback: () => void) {
      notifyResize = callback;
    }
    observe(element: unknown) {
      observed.push(element);
    }
  }
  Object.assign(root, {
    querySelectorAll: () =>
      descendants.filter((child) => {
        for (let parent = child.parentElement; parent; parent = parent.parentElement) {
          if (parent === root) return true;
        }
        return false;
      })
  });
  const document = {
    querySelector: () => root,
    body: {
      firstElementChild: root,
      querySelectorAll: () => [root, ...descendants],
      scrollWidth: Math.max(viewportWidth, root.bounds.right),
      scrollHeight: root.bounds.bottom
    },
    documentElement: {
      scrollWidth: Math.max(viewportWidth, root.bounds.right),
      scrollHeight: root.bounds.bottom
    }
  };
  const window = {
    innerWidth: viewportWidth,
    parent: { postMessage: (message: SizeMessage) => messages.push(message) },
    addEventListener: () => {},
    requestAnimationFrame: () => {},
    setTimeout: () => {},
    ResizeObserver
  };
  runInNewContext(String(embedFiles()["dist/iframe.js"]), {
    document,
    Element: Box,
    getComputedStyle: (element: Box) => element,
    ResizeObserver,
    window
  });
  expect(messages).toHaveLength(1);
  expect(messages[0]!.type).toBe("ai-motion:ready");
  return { messages, window, document, observed, resize: () => notifyResize() };
}

function reportedSize(children: (root: Box) => Box[]) {
  const root = new Box({ left: 0, top: 0, right: 100, bottom: 80 });
  const { messages } = frameHarness(root, children(root));
  return { width: messages[0]!.width, height: messages[0]!.height };
}

function hostHarness() {
  let onMessage = (_event: { source: unknown; data: SizeMessage }) => {};
  const iframe = {
    style: {} as Record<string, string>,
    contentWindow: { postMessage() {} },
    setAttribute() {},
    addEventListener() {}
  };
  const target = { classList: { add() {} }, append() {} };
  const context = {
    URL,
    Element: Object,
    document: {
      baseURI: "https://example.com/",
      querySelector: () => target,
      createElement: () => iframe
    },
    window: {
      addEventListener: (_type: string, listener: typeof onMessage) => {
        onMessage = listener;
      }
    },
    AiMotionWidget: {} as { mountMotionWidget: (container: string) => unknown }
  };
  runInNewContext(String(embedFiles()["dist/index.umd.js"]), context);
  context.AiMotionWidget.mountMotionWidget("#slot");
  return {
    style: iframe.style,
    receive: (data: SizeMessage) => onMessage({ source: iframe.contentWindow, data })
  };
}

describe("embed reported content size", () => {
  it("excludes off-screen descendants hidden by an ancestor", () => {
    expect(
      reportedSize((root) => {
        const clip = new Box({ left: 10, top: 10, right: 60, bottom: 50 }, root, "hidden", "hidden");
        return [clip, new Box({ left: 2000, top: 3000, right: 2200, bottom: 3300 }, clip)];
      })
    ).toEqual({ width: 100, height: 80 });
  });

  it("intersects partially clipped descendants on each axis through nested ancestors", () => {
    expect(
      reportedSize((root) => {
        const outer = new Box({ left: 0, top: 0, right: 140, bottom: 80 }, root, "visible", "clip");
        const inner = new Box({ left: 100, top: 0, right: 120, bottom: 60 }, outer, "auto", "visible");
        return [outer, inner, new Box({ left: 110, top: 70, right: 900, bottom: 900 }, inner)];
      })
    ).toEqual({ width: 140, height: 80 });
  });

  it("includes descendants overflowing visible ancestors", () => {
    expect(
      reportedSize((root) => {
        const parent = new Box({ left: 80, top: 60, right: 100, bottom: 80 }, root);
        return [parent, new Box({ left: 110, top: 90, right: 140, bottom: 110 }, parent)];
      })
    ).toEqual({ width: 140, height: 110 });
  });

  it("latches responsive sizing at 1px and remeasures a capped root through ResizeObserver", () => {
    const wrapper = new Box({ left: 0, top: 0, right: 1, bottom: 1.85 });
    const root = new Box({ left: 0, top: 0, right: 1, bottom: 1.85 }, wrapper, "hidden", "hidden");
    const frame = frameHarness(
      root,
      [wrapper, new Box({ left: 2000, top: 3000, right: 3346, bottom: 4000 }, root)],
      1
    );
    expect(frame.messages[0]).toEqual({
      type: "ai-motion:ready",
      width: 1,
      height: 2,
      responsive: true,
      fills: true
    });
    expect(frame.observed).toContain(root);
    expect(frame.observed).toContain(frame.document.documentElement);

    frame.window.innerWidth = 2048;
    Object.assign(wrapper.bounds, { right: 2048, bottom: 2868 });
    Object.assign(root.bounds, { left: 251.5, right: 1796.5, bottom: 2868 });
    for (const page of [frame.document.body, frame.document.documentElement]) {
      page.scrollWidth = 2048;
      page.scrollHeight = 2868;
    }
    frame.resize();
    expect(frame.messages.at(-1)).toEqual({
      type: "ai-motion:resize",
      width: 1545,
      height: 2868,
      responsive: true,
      fills: false
    });

    frame.window.innerWidth = 800;
    Object.assign(root.bounds, { left: 0, top: 691, right: 800, bottom: 2177 });
    frame.document.body.scrollWidth = frame.document.documentElement.scrollWidth = 800;
    frame.resize();
    expect(frame.messages.at(-1)).toEqual({
      type: "ai-motion:resize",
      width: 800,
      height: 1486,
      responsive: true,
      fills: true
    });
  });

  it("keeps a fixed root in pixels even when it later fills its viewport", () => {
    const root = new Box({ left: 0, top: 0, right: 400, bottom: 80 });
    const frame = frameHarness(root, [], 1);
    expect(frame.messages[0]).toMatchObject({ width: 400, height: 80, fills: true });
    expect(frame.messages[0]!.responsive).not.toBe(true);
    frame.window.innerWidth = 400;
    frame.resize();
    expect(frame.messages.at(-1)).toMatchObject({ width: 400, fills: true });
    expect(frame.messages.at(-1)!.responsive).not.toBe(true);
    frame.window.innerWidth = 800;
    frame.document.body.scrollWidth = frame.document.documentElement.scrollWidth = 800;
    frame.resize();
    expect(frame.messages.at(-1)).toMatchObject({ width: 800, fills: false });
  });

  it("does not classify a viewport-filling block with visible fixed overflow as responsive", () => {
    const root = new Box({ left: 0, top: 0, right: 1, bottom: 80 });
    const frame = frameHarness(root, [new Box({ left: 0, top: 0, right: 400, bottom: 80 }, root)], 1);
    expect(frame.messages[0]).toMatchObject({ width: 400, height: 80, fills: true });
    expect(frame.messages[0]!.responsive).not.toBe(true);
    frame.window.innerWidth = 400;
    root.bounds.right = 400;
    frame.resize();
    expect(frame.messages.at(-1)!.responsive).not.toBe(true);
  });

  it("does not classify a root first measured at a real viewport width as responsive", () => {
    const root = new Box({ left: 0, top: 0, right: 800, bottom: 80 });
    const frame = frameHarness(root, [], 800);
    expect(frame.messages[0]).toMatchObject({ fills: true });
    expect(frame.messages[0]!.responsive).not.toBe(true);
  });
});

describe("embed host sizing", () => {
  it("uses fluid width and retains the natural cap when the root fills again", () => {
    const host = hostHarness();
    host.receive({ type: "ai-motion:ready", width: 1, height: 2, responsive: true, fills: true });
    expect(host.style.width).toBe("100%");
    expect(host.style.height).toBe("2px");
    expect(host.style.maxWidth).toBeUndefined();
    host.receive({ type: "ai-motion:resize", width: 1545, height: 2868, responsive: true, fills: false });
    expect(host.style.maxWidth).toBe("1545px");
    expect(host.style.height).toBe("2868px");
    host.receive({ type: "ai-motion:resize", width: 1545, height: 2868, responsive: true, fills: true });
    expect(host.style.maxWidth).toBe("1545px");
    host.receive({ type: "ai-motion:resize", width: 800, height: 1486, responsive: true, fills: true });
    expect(host.style.width).toBe("100%");
    expect(host.style.maxWidth).toBe("1545px");
    expect(host.style.height).toBe("1486px");
  });

  it("keeps exact pixel sizing for fixed and legacy messages", () => {
    const host = hostHarness();
    host.receive({ type: "ai-motion:ready", width: 400, height: 220 });
    expect(host.style.width).toBe("400px");
    expect(host.style.height).toBe("220px");
    expect(host.style.maxWidth).toBeUndefined();
    host.receive({ type: "ai-motion:resize", width: 400, height: 220, fills: true });
    expect(host.style.width).toBe("400px");
  });
});
