import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createProductionServer } from "./productionServer";

const tempDirs: string[] = [];

async function createDist() {
  const dir = await mkdtemp(join(tmpdir(), "ai-motion-dist-"));
  tempDirs.push(dir);
  await writeFile(join(dir, "index.html"), '<!doctype html><div id="root">app</div>');
  await writeFile(join(dir, "app.js"), "console.log('app');");
  return dir;
}

async function listen(server: ReturnType<typeof createProductionServer>) {
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server did not listen on a port");
  return `http://127.0.0.1:${address.port}`;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("productionServer", () => {
  it("serves the built app and handles video analysis API requests", async () => {
    const server = createProductionServer({
      distDir: await createDist(),
      analyze: async () => ({
        width: 64,
        height: 96,
        durationMs: 120,
        fps: 25,
        posterDataUrl: "data:image/png;base64,POSTER",
        frames: [{ id: "start", timestampMs: 0, dataUrl: "data:image/png;base64,POSTER" }],
        contactSheetDataUrl: "data:image/png;base64,SHEET",
        motionHints: {
          direction: "none",
          confidence: 0,
          startX: 0,
          startY: 0,
          endX: 0,
          endY: 0
        }
      })
    });

    try {
      const baseUrl = await listen(server);

      await expect(fetch(`${baseUrl}/`).then((response) => response.text())).resolves.toContain("app");
      await expect(
        fetch(`${baseUrl}/editor/uploaded-demo`).then((response) => response.text())
      ).resolves.toContain("app");

      const apiResponse = await fetch(`${baseUrl}/api/video/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: "demo.mp4", dataUrl: "data:video/mp4;base64,AAAA" })
      });

      expect(apiResponse.status).toBe(200);
      await expect(apiResponse.json()).resolves.toMatchObject({
        width: 64,
        motionHints: { direction: "none" }
      });
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("passes generation model options to the reference-guided API handler", async () => {
    const modelSemanticIntentV2 = {
      version: 2,
      target: { kind: "button", label: "按钮" },
      layers: [{ role: "button", label: "按钮" }],
      motions: [
        {
          type: "bounce",
          target: "button",
          trigger: "load",
          direction: "left-to-right",
          speed: "normal",
          description: "从左到右弹动进入"
        },
        {
          type: "slide",
          target: "button",
          trigger: "load",
          direction: "left-to-right",
          speed: "normal",
          description: "从屏幕左侧移动到右侧"
        }
      ],
      colors: [{ target: "background", label: "红色", value: "#ef4444" }],
      text: null,
      trigger: "load",
      speed: "normal",
      motionCategory: "feedback",
      targetRoles: ["button"],
      composition: "sequence",
      migrationIntent: false,
      referenceRecipeHints: [],
      negativeConstraints: [],
      referenceHints: [],
      source: "model",
      confidence: 0.92,
      raw: "创建一个按钮颜色为红色，带有弹动效果，从屏幕左侧移动到右侧"
    };
    const modelDraft = {
      html: `<!doctype html><html><head><link rel="stylesheet" href="./style.css" /></head><body><main data-motion-root><button data-motion="buttonLabel">立即行动</button></main><script src="./script.js"></script></body></html>`,
      css: `.ai-red-button { background: #ef4444; animation: ai-left-to-right-slide-bounce 900ms cubic-bezier(0.34, 1.56, 0.64, 1) both; } @keyframes ai-left-to-right-slide-bounce { from { transform: translateX(-42vw); } to { transform: translateX(42vw); } }`,
      js: `window.motionReplay = function motionReplay() {}; window.motionPause = function motionPause() {}; window.motionSeek = function motionSeek() {};`
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ output_text: JSON.stringify(modelSemanticIntentV2) })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ output_text: JSON.stringify(modelDraft) })));
    const server = createProductionServer({
      distDir: await createDist(),
      generation: { apiKey: "test-key", fetchImpl }
    });

    try {
      const baseUrl = await listen(server);
      const apiResponse = await fetch(`${baseUrl}/api/generation/reference-guided`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: "创建一个按钮颜色为红色，带有弹动效果，从屏幕左侧移动到右侧",
          components: [
            {
              id: "reference-button",
              name: "参考按钮",
              category: "interaction",
              tags: ["button"],
              useCases: ["button-motion"],
              moods: ["clean"],
              manifest: {
                version: "1.0",
                id: "reference-button-manifest",
                name: "参考按钮",
                sourceKind: "builtin-component",
                runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
                capabilities: ["builtin", "editable", "export-html"],
                params: [],
                layers: []
              },
              source: {
                id: "reference-button",
                origin: "builtin",
                kind: "builtin-component",
                entry: "source/index.html",
                files: [{ path: "source/index.html", kind: "html", content: "<main data-motion-root></main>" }]
              }
            }
          ]
        })
      });
      const body = await apiResponse.json();
      const css = body.component.source.files.find((file: { path: string }) => file.path === "source/style.css").content;

      expect(apiResponse.status).toBe(200);
      expect(fetchImpl).toHaveBeenCalledTimes(2);
      const firstCallBody = JSON.parse(fetchImpl.mock.calls[0]?.[1]?.body as string);
      const secondCallBody = JSON.parse(fetchImpl.mock.calls[1]?.[1]?.body as string);
      expect(firstCallBody.text.format.name).toBe("semantic_intent_v2");
      expect(secondCallBody.text.format.name).toBe("reference_guided_source_draft");
      expect(css).toContain("ai-left-to-right-slide-bounce");
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
