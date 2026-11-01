import { describe, expect, it } from "vitest";
import {
  compileVisualMotionBindings,
  compileVisualMotionComposition,
  compileVisualMotionIntent,
  createDefaultDocument,
  evaluateComposition,
  exportCompositionHtml,
  exportHtmlCss,
  type ZeroVisualSnapshot
} from "../src";
import { exportVisualCompositionHtml } from "../src/composition/exportVisualCompositionHtml";

describe("HTML exporter safety", () => {
  it.each(["modal", "free"])("escapes the %s image style attribute", (kind) => {
    const document = createDefaultDocument("modal");
    const image = document.layers.find((layer) => layer.id === "modal-image")!;
    image.content = { src: "https://example.test/image.png", alt: "A & B < C" };
    image.style = { fontFamily: 'Arial" autofocus' };
    if (kind === "free") image.layout = { x: 0, y: 0, width: 20, height: 20 };
    const { html } = exportHtmlCss(document);
    expect(html).toContain("font-family:Arial&quot; autofocus");
    expect(html).not.toContain('Arial" autofocus');
    expect(html).toContain('alt="A &amp; B &lt; C"');
  });

  it("preserves literal ampersands in image URLs", () => {
    const document = createDefaultDocument("modal");
    const src = "https://example.test/image.png?a=1&copy=2";
    document.stage.backgroundImage = src;
    const image = document.layers.find((layer) => layer.id === "modal-image")!;
    image.content = { src };
    image.layout = { x: 0, y: 0, width: 20, height: 20 };
    const { html } = exportHtmlCss(document);
    expect(html.match(/src="https:\/\/example.test\/image.png\?a=1&amp;copy=2"/g) ?? []).toHaveLength(3);
    expect(html).not.toContain("&amp;amp;");
  });

  it("escapes composition labels and bound layer names", () => {
    const payload = "<img src=x onerror=alert(1)>";
    const track = evaluateComposition([
      {
        id: "step",
        presetId: "enter-screen",
        label: payload,
        target: "selected-layer",
        layerName: payload,
        timing: "sequential",
        delayMs: 0,
        durationMs: 240,
        slot: "trajectory"
      }
    ]);
    const html = exportCompositionHtml(track);
    expect(html.match(/&lt;img src=x onerror=alert\(1\)&gt;/g) ?? []).toHaveLength(2);
    expect(html).not.toContain(payload);
  });

  it("keeps a composition preset ID inside its HTML attribute and CSS identifier", () => {
    const track = evaluateComposition([
      {
        id: "step",
        presetId: 'x" onmouseover="alert(1)</style><img src=x>',
        label: "Motion",
        target: "target",
        timing: "sequential",
        delayMs: 0,
        durationMs: 240,
        slot: "trajectory"
      }
    ]);
    const html = exportCompositionHtml(track);
    expect(html).toContain('data-preset="x&quot; onmouseover=&quot;alert(1)&lt;/style&gt;&lt;img src=x&gt;"');
    expect(html).not.toContain(' onmouseover="');
    expect(html).not.toContain("</style><img");
  });

  it.each(["css", "nodeId"])("keeps visual %s strings inside the style element", (field) => {
    const snapshot = (id: string): ZeroVisualSnapshot => ({
      schemaVersion: "motion-copilot.zero-visual-snapshot.v1",
      frameId: id,
      nodeId: id,
      name: "Frame",
      width: 100,
      height: 100,
      screenshotUrl: "",
      html: '<div data-node-id="box"></div>',
      css: "",
      assets: [],
      nodes: [{ nodeId: "box", name: "Box", kind: "rect", bounds: { x: 0, y: 0, w: 20, h: 20 } }]
    });
    const from = snapshot("from");
    const to = snapshot("to");
    const { document } = compileVisualMotionComposition({
      from,
      to,
      bindingResult: compileVisualMotionBindings(from, to),
      intent: compileVisualMotionIntent("淡入")
    });
    const source = document.visualSource;
    if (!source || source.kind !== "zero-visual-morph") throw new Error("Expected visual source");
    const payload = "</style><img src=x onerror=alert(1)>";
    if (field === "css") source.from.css = `@media (width < 600px){.box{font-family:"${payload}"}}`;
    else source.bindingResult.bindings[0]!.toNodeId = payload;
    const html = exportVisualCompositionHtml(document, document.composition!);
    expect(html).not.toContain(payload);
    expect(html).toContain("\\3c /style>");
    if (field === "css") expect(html).toContain("@media (width < 600px)");
    expect(html).toContain('<div data-node-id="box"></div>');
  });
});
