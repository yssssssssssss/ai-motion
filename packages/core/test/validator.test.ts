import { describe, expect, it } from "vitest";
import { confirmValidParams } from "../src/analyze/validator";
import type { MotionParam } from "../src/manifest/types";
import type { MotionSource } from "../src/library/componentLibrary";

const source: MotionSource = {
  id: "source",
  origin: "imported",
  kind: "single-html",
  entry: "index.html",
  files: [{ path: "index.html", kind: "html", content: '<h1 data-motion="headline">Hello</h1>' }]
};

describe("confirmValidParams", () => {
  it("confirms params whose targets exist", () => {
    const params: MotionParam[] = [
      {
        id: "headline",
        label: "Headline",
        type: "text",
        default: "Hello",
        status: "suggested",
        targets: [{ kind: "html-text", file: "index.html", selector: "[data-motion=headline]" }]
      }
    ];

    const result = confirmValidParams({ source, params });
    expect(result.confirmed[0]?.status).toBe("confirmed");
    expect(result.rejected).toHaveLength(0);
  });

  it("rejects params whose targets are missing", () => {
    const params: MotionParam[] = [
      {
        id: "missing",
        label: "Missing",
        type: "text",
        default: "Nope",
        status: "suggested",
        targets: [{ kind: "html-text", file: "index.html", selector: "[data-motion=missing]" }]
      }
    ];

    const result = confirmValidParams({ source, params });
    expect(result.confirmed).toHaveLength(0);
    expect(result.rejected[0]?.status).toBe("rejected");
  });
});
