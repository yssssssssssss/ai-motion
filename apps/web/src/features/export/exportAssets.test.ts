import { afterEach, describe, expect, it, vi } from "vitest";
import type { MotionProject } from "../../state/projectStore";
import { sourceFilesForExport } from "./exportAssets";

const project = {
  id: "product-project",
  manifest: {
    version: "1.0",
    id: "product",
    name: "Product",
    sourceKind: "builtin-component",
    runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
    params: []
  },
  patch: { id: "patch", sourceManifestId: "product", values: {} },
  source: {
    id: "product",
    origin: "builtin",
    kind: "builtin-component",
    entry: "source/index.html",
    files: [
      {
        path: "source/index.html",
        kind: "html",
        content: '<link rel="stylesheet" href="./assets.css" />'
      },
      {
        path: "source/assets.css",
        kind: "css",
        content: "/assets/product-assets.css"
      }
    ]
  }
} satisfies MotionProject;

describe("sourceFilesForExport", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves externalized same-origin assets before export", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(":root { --hero-image: url(data:image/png;base64,abc); }"))
    );

    await expect(sourceFilesForExport(project)).resolves.toMatchObject({
      "source/assets.css": ":root { --hero-image: url(data:image/png;base64,abc); }",
      "source/index.html": '<link rel="stylesheet" href="./assets.css" />'
    });
    expect(fetch).toHaveBeenCalledWith("/assets/product-assets.css");
  });

  it("fails loudly when an external asset cannot be fetched", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 404 }))
    );

    await expect(sourceFilesForExport(project)).rejects.toThrow(
      "Failed to load external asset: source/assets.css"
    );
  });

  it("keeps local CSS content that starts with a comment", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);

    await expect(
      sourceFilesForExport({
        ...project,
        source: {
          ...project.source,
          files: [{ path: "source/style.css", kind: "css", content: "/* local */ .card { color: red; }" }]
        }
      })
    ).resolves.toEqual({
      "source/style.css": "/* local */ .card { color: red; }"
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});
