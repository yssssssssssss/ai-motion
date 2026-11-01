import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createZeroFrameSnapshotHandler } from "./zeroFrameSnapshot";
import { createZeroVisualSnapshotHandler } from "./zeroVisualSnapshot";

describe("Zero fixture provenance", () => {
  it("marks the legacy frame fixture in its existing name field", async () => {
    const handler = createZeroFrameSnapshotHandler({
      snapshotCommand: process.execPath,
      snapshotArgs: [
        fileURLToPath(new URL("../../../../scripts/zero-frame-snapshot-fixture.mjs", import.meta.url)),
        "--node-id",
        "{nodeId}"
      ]
    });
    let body = "";
    const res = {
      statusCode: 0,
      setHeader() {},
      end(value: string) {
        body = value;
      }
    };
    await handler(
      Object.assign(Readable.from([JSON.stringify({ nodeId: "28:19" })]), { method: "POST" }),
      res
    );
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(body).snapshot.name).toBe("示例数据 · 信息收起状态");
  });

  it("does not label an explicit visual fixture as real MCP when a URL is configured", async () => {
    const handler = createZeroVisualSnapshotHandler({
      visualCommand: process.execPath,
      visualArgs: [
        fileURLToPath(new URL("../../../../scripts/zero-visual-snapshot-fixture.mjs", import.meta.url)),
        "--node-id",
        "{nodeId}"
      ],
      commandEnv: { ZERO_MCP_HTTP_URL: "http://unused.test/mcp" }
    });
    let body = "";
    const res = {
      statusCode: 0,
      setHeader() {},
      end(value: string) {
        body = value;
      }
    };
    await handler(
      Object.assign(Readable.from([JSON.stringify({ nodeId: "28:19" })]), { method: "POST" }),
      res
    );
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(body).source).toBe("fixture");
  });
});
