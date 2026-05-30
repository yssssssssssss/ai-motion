import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
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
});
