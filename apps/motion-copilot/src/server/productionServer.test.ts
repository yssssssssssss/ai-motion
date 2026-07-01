import { createServer } from "node:http";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMotionCopilotProductionServer } from "./productionServer";

const tempDirs: string[] = [];

async function createDist() {
  const dir = await mkdtemp(join(tmpdir(), "copilot-dist-"));
  tempDirs.push(dir);
  await writeFile(join(dir, "index.html"), '<!doctype html><div id="root">copilot</div>');
  await writeFile(join(dir, "app.js"), "console.log('copilot');");
  return dir;
}

async function listen(server: ReturnType<typeof createMotionCopilotProductionServer>) {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  return `http://127.0.0.1:${address.port}`;
}

async function close(server: ReturnType<typeof createMotionCopilotProductionServer>) {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

async function closeServer(server: { close(callback: (error?: Error) => void): void }) {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

function rootPath(...parts: string[]): string {
  return resolve(fileURLToPath(new URL("../../../..", import.meta.url)), ...parts);
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("motion-copilot production server", () => {
  it("serves the built app and falls back to index for SPA routes", async () => {
    const server = createMotionCopilotProductionServer({ distDir: await createDist() });
    try {
      const baseUrl = await listen(server);
      await expect(fetch(`${baseUrl}/`).then((r) => r.text())).resolves.toContain("copilot");
      await expect(fetch(`${baseUrl}/editor/anything`).then((r) => r.text())).resolves.toContain("copilot");
      await expect(fetch(`${baseUrl}/app.js`).then((r) => r.text())).resolves.toContain("console.log");
    } finally {
      await close(server);
    }
  });

  it("exposes model config without leaking the api key", async () => {
    const server = createMotionCopilotProductionServer({
      distDir: await createDist(),
      modelConfig: { apiKey: "secret-key", model: "gpt-5.5" }
    });
    try {
      const baseUrl = await listen(server);
      const response = await fetch(`${baseUrl}/api/copilot/config`);
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body).toMatchObject({ hasApiKey: true, mode: "llm-ready", model: "gpt-5.5" });
      expect(JSON.stringify(body)).not.toContain("secret-key");
    } finally {
      await close(server);
    }
  });

  it("routes generate requests through the injected model config", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            steps: [
              { presetId: "enter-screen", layerId: null, timing: "sequential", delayMs: 0, reason: "进场" }
            ]
          })
        }),
        { status: 200 }
      )
    );
    const server = createMotionCopilotProductionServer({
      distDir: await createDist(),
      modelConfig: { apiKey: "test-key", fetchImpl }
    });
    try {
      const baseUrl = await listen(server);
      const response = await fetch(`${baseUrl}/api/copilot/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "进场", document: { layers: [] } })
      });
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.mode).toBe("llm");
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    } finally {
      await close(server);
    }
  });

  it("routes Zero visual snapshot requests through the configured high-fidelity bridge", async () => {
    const server = createMotionCopilotProductionServer({
      distDir: await createDist(),
      zeroVisualConfig: {
        visualCommand: process.execPath,
        visualArgs: [rootPath("scripts/zero-visual-snapshot-fixture.mjs"), "--node-id", "{nodeId}"]
      }
    });
    try {
      const baseUrl = await listen(server);
      const response = await fetch(`${baseUrl}/api/zero/visual-snapshot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId: "28:2" })
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.snapshot).toMatchObject({
        schemaVersion: "motion-copilot.zero-visual-snapshot.v1",
        frameId: "28:2",
        nodeId: "28:2",
        name: "信息展开状态"
      });
      expect(body.snapshot.html).toContain('data-node-id="28:11"');
    } finally {
      await close(server);
    }
  });

  it("routes Zero layer snapshot requests through the configured layer bridge", async () => {
    const server = createMotionCopilotProductionServer({
      distDir: await createDist(),
      zeroLayerConfig: {
        layerCommand: process.execPath,
        layerArgs: [rootPath("scripts/zero-layer-snapshot-fixture.mjs"), "--node-id", "{nodeId}"]
      }
    });
    try {
      const baseUrl = await listen(server);
      const response = await fetch(`${baseUrl}/api/zero/layer-snapshot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId: "28:2" })
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.snapshot).toMatchObject({
        schemaVersion: "motion-copilot.zero-layer-snapshot.v1",
        frameId: "28:2",
        nodeId: "28:2",
        name: "信息展开状态"
      });
      expect(body.snapshot.layers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            nodeId: "28:12",
            name: "状态胶囊",
            cornerRadius: 999,
            fills: [{ type: "solid", color: "#f3f3f3" }]
          })
        ])
      );
    } finally {
      await close(server);
    }
  });

  it("does not label fixture layer responses as real Zero MCP even when an MCP URL is present", async () => {
    const server = createMotionCopilotProductionServer({
      distDir: await createDist(),
      zeroLayerConfig: {
        layerCommand: process.execPath,
        layerArgs: [rootPath("scripts/zero-layer-snapshot-fixture.mjs"), "--node-id", "{nodeId}"]
      }
    });
    const previousUrl = process.env.ZERO_MCP_HTTP_URL;
    process.env.ZERO_MCP_HTTP_URL = "http://127.0.0.1:27618/mcp";
    try {
      const baseUrl = await listen(server);
      const response = await fetch(`${baseUrl}/api/zero/layer-snapshot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId: "28:2" })
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.source).toBe("fixture");
      expect(body.bridge).toContain("zero-layer-snapshot-fixture.mjs");
    } finally {
      if (previousUrl == null) delete process.env.ZERO_MCP_HTTP_URL;
      else process.env.ZERO_MCP_HTTP_URL = previousUrl;
      await close(server);
    }
  });

  it("accepts raw Zero MCP visual bundles from the configured bridge command", async () => {
    const scriptDir = await mkdtemp(join(tmpdir(), "copilot-zero-bridge-"));
    tempDirs.push(scriptDir);
    const bridgeScript = join(scriptDir, "bridge.mjs");
    await writeFile(
      bridgeScript,
      `const payload = {
  nodeId: "1:1",
  designContext: 'const imgAsset1 = "http://localhost:27618/assets/card.svg";\\nexport default function Component() {\\n  return (\\n    <div className="contents relative size-full" data-node-id="1:1" data-name="Frame">\\n      <div className="absolute left-[4px] top-[5px] w-[10px] h-[11px]" data-node-id="1:2"><img className="block size-full" alt="" src={imgAsset1} /></div>\\n      <p className="absolute left-[20px] top-[6px] w-[24px] h-[12px] text-black text-[12px]" data-node-id="1:3">OK</p>\\n    </div>\\n  );\\n}',
  designMetadata: '<group id="1:1" name="Frame" x="0" y="0" width="80" height="32">\\n  <vector id="1:2" name="Card" x="4" y="5" width="10" height="11" />\\n  <text id="1:3" name="Label" x="20" y="6" width="24" height="12" />\\n</group>',
  screenshot: { image_url: "http://localhost:27618/assets/frame.png" }
};
process.stdout.write(JSON.stringify(payload));`
    );

    const server = createMotionCopilotProductionServer({
      distDir: await createDist(),
      zeroVisualConfig: {
        visualCommand: process.execPath,
        visualArgs: [bridgeScript]
      }
    });
    try {
      const baseUrl = await listen(server);
      const response = await fetch(`${baseUrl}/api/zero/visual-snapshot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId: "1:1" })
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.snapshot).toMatchObject({
        schemaVersion: "motion-copilot.zero-visual-snapshot.v1",
        nodeId: "1:1",
        width: 80,
        height: 32
      });
      expect(body.snapshot.nodes).toHaveLength(3);
      expect(body.snapshot.assets).toEqual([
        expect.objectContaining({
          id: "asset-1:2",
          nodeId: "1:2",
          url: expect.stringContaining(`${baseUrl}/api/zero/asset?url=`)
        })
      ]);
      expect(body.snapshot.html).toContain(`${baseUrl}/api/zero/asset?url=`);
      expect(body.snapshot.html).not.toContain('src="http://localhost:27618/assets/card.svg"');
      expect(body.snapshot.screenshotUrl).toContain(`${baseUrl}/api/zero/asset?url=`);
    } finally {
      await close(server);
    }
  });

  it("proxies Zero assets through the app origin", async () => {
    const assetServer = createServer((_req, res) => {
      res.statusCode = 200;
      res.setHeader("Content-Type", "image/svg+xml");
      res.end('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>');
    });
    await new Promise<void>((resolve) => assetServer.listen(0, "127.0.0.1", resolve));
    const address = assetServer.address();
    if (!address || typeof address === "string") throw new Error("no asset port");

    const server = createMotionCopilotProductionServer({ distDir: await createDist() });
    try {
      const baseUrl = await listen(server);
      const sourceUrl = `http://127.0.0.1:${address.port}/card.svg`;
      const response = await fetch(`${baseUrl}/api/zero/asset?url=${encodeURIComponent(sourceUrl)}`);

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("image/svg+xml");
      await expect(response.text()).resolves.toContain("<svg");
    } finally {
      await close(server);
      await closeServer(assetServer);
    }
  });
});
