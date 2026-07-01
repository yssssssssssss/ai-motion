// @vitest-environment happy-dom
import { act } from "react";
import type { ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ZeroVisualSnapshot } from "@motion-copilot/core";
import { buildVisualStageSrcDoc, VisualStage } from "./VisualStage";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let host: HTMLDivElement | undefined;

const snapshot: ZeroVisualSnapshot = {
  schemaVersion: "motion-copilot.zero-visual-snapshot.v1",
  frameId: "28:2",
  nodeId: "28:2",
  name: "信息展开状态",
  width: 583,
  height: 38,
  screenshotUrl: "http://localhost:27618/assets/img_28-2.png",
  html: '<div class="zero-frame" data-node-id="28:2"><span data-node-id="28:11">继续指派 &gt;</span></div>',
  css: ".zero-frame{position:relative;width:583px;height:38px}",
  assets: [],
  nodes: [
    { nodeId: "28:2", name: "信息展开状态", kind: "group", bounds: { x: 0, y: 0, w: 583, h: 38 } },
    {
      nodeId: "28:11",
      name: "继续指派",
      kind: "text",
      bounds: { x: 287, y: 10, w: 60, h: 17 },
      text: "继续指派 >"
    }
  ]
};

function render(element: ReactElement) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root?.render(element);
  });
  return host;
}

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = undefined;
  host = undefined;
});

describe("VisualStage", () => {
  it("builds isolated iframe content from a ZeroVisualSnapshot", () => {
    const srcDoc = buildVisualStageSrcDoc(snapshot, "28:11");

    expect(srcDoc).toContain("<!doctype html>");
    expect(srcDoc).toContain(snapshot.css);
    expect(srcDoc).toContain('data-node-id="28:11"');
    expect(srcDoc).toContain('[data-node-id="28:11"]');
    expect(srcDoc).toContain("motion-copilot:zero-node-select");
  });

  it("renders with snapshot dimensions and reports selected node ids", () => {
    const onNodeSelect = vi.fn();
    render(<VisualStage snapshot={snapshot} highlightedNodeId="28:11" onNodeSelect={onNodeSelect} />);

    const iframe = document.querySelector<HTMLIFrameElement>("iframe.visual-stage");
    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute("sandbox")).toBe("allow-scripts");
    expect(iframe?.style.width).toBe("583px");
    expect(iframe?.style.height).toBe("38px");
    expect(iframe?.srcdoc).toContain('data-node-id="28:11"');

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "motion-copilot:zero-node-select", nodeId: "28:11" },
          source: iframe?.contentWindow ?? window
        })
      );
    });

    expect(onNodeSelect).toHaveBeenCalledWith("28:11");
  });

  it("injects high-fidelity override CSS into the iframe preview", () => {
    render(<VisualStage snapshot={snapshot} overrideCss={'[data-node-id="28:11"]{left:12px!important;}'} />);

    const iframe = document.querySelector<HTMLIFrameElement>("iframe.visual-stage");
    expect(iframe?.srcdoc).toContain('[data-node-id="28:11"]{left:12px!important;}');
  });
});
