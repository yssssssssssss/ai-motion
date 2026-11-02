import { describe, expect, it } from "vitest";
import { createDefaultDocument, evaluateComposition, type MotionDocument } from "../src";
import { exportFrameMorphCompositionHtml } from "../src/composition/exportFrameMorphCompositionHtml";

function documentWithLayers(): MotionDocument {
  const document = createDefaultDocument("modal");
  document.layers = [
    { id: "text", name: "文本", kind: "text", editable: true, content: { text: "A & B < C" } },
    {
      id: "image",
      name: "图片",
      kind: "image",
      editable: true,
      content: { src: "https://example.test/image.png?a=1&b=2", alt: "A & B < C" },
      style: { fit: "contain", position: "center" }
    }
  ];
  document.composition = evaluateComposition([
    {
      id: "morph",
      presetId: "frame-morph-layout",
      label: "帧间动效",
      target: "selected-layer",
      layerId: "text",
      timing: "sequential",
      delayMs: 0,
      durationMs: 240,
      slot: "trajectory"
    }
  ]);
  return document;
}

describe("exportFrameMorphCompositionHtml", () => {
  it("renders text and image layers with literal special characters", () => {
    const document = documentWithLayers();
    const html = exportFrameMorphCompositionHtml(document, document.composition!);
    expect(html).toContain(">A &amp; B &lt; C</div>");
    expect(html).toContain('src="https://example.test/image.png?a=1&amp;b=2"');
    expect(html).toContain('alt="A &amp; B &lt; C"');
    expect(html).toContain("object-fit:contain;object-position:center");
    expect(html).not.toContain("&amp;amp;");
    expect(html).not.toContain("&amp;lt;");
  });

  it("keeps design-file text from becoming live markup", () => {
    const document = documentWithLayers();
    document.layers[0]!.content!.text = "<img src=x onerror=alert(1)>";
    const html = exportFrameMorphCompositionHtml(document, document.composition!);
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<img src=x");
  });

  it.each(["src", "alt", "fit", "position", "id", "background", "fontFamily"])(
    "keeps %s from breaking out of an attribute",
    (field) => {
      const document = documentWithLayers();
      const layer = document.layers[1]!;
      const payload = 'x" onerror="alert(1)';
      if (field === "src" || field === "alt") Object.assign(layer.content!, { [field]: payload });
      else if (field === "id") layer.id = payload;
      else Object.assign(layer.style!, { [field]: payload });
      const html = exportFrameMorphCompositionHtml(document, document.composition!);
      expect(html).toContain("x&quot; onerror=&quot;alert(1)");
      expect(html).not.toContain(payload);
    }
  );

  it("keeps the stage background inside the style element", () => {
    const document = documentWithLayers();
    document.stage.background = "</style><img src=x onerror=alert(1)>";
    const html = exportFrameMorphCompositionHtml(document, document.composition!);
    expect(html).not.toContain("</style><img");
    expect(html).toContain("\\3c /style>");
  });
});
