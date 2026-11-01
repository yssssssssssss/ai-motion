import { get } from "node:http";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createMotionLensProductionServer } from "./productionServer";

describe("motion-lens production server", () => {
  it("rejects malformed URLs and keeps serving valid requests", async () => {
    const distDir = await mkdtemp(join(tmpdir(), "motion-lens-dist-"));
    await writeFile(join(distDir, "index.html"), '<!doctype html><div id="root">motion lens</div>');
    const server = createMotionLensProductionServer({ distDir });
    try {
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
      });
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("no port");
      const baseUrl = `http://127.0.0.1:${address.port}`;
      const response = await new Promise<{ status: number | undefined; body: string }>((resolve, reject) => {
        const request = get(baseUrl, { path: "/%" }, (res) => {
          let body = "";
          res.setEncoding("utf8");
          res.on("data", (chunk) => (body += chunk));
          res.on("end", () => resolve({ status: res.statusCode, body }));
          res.on("error", reject);
        });
        request.on("error", reject);
        request.setTimeout(1000, () => request.destroy(new Error("request timed out")));
      });
      expect(response.status).toBe(400);
      expect(JSON.parse(response.body)).toEqual({ error: "请求路径无效" });
      const validResponse = await fetch(`${baseUrl}/`);
      expect(validResponse.status).toBe(200);
      await expect(validResponse.text()).resolves.toContain("motion lens");
    } finally {
      if (server.listening) {
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve()))
        );
      }
      await rm(distDir, { recursive: true, force: true });
    }
  });
});
