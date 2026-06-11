import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("builtin playback protocol", () => {
  it("exposes replay, pause, and seek hooks for every coded builtin component", () => {
    const root = resolve(__dirname, "..");
    const missing: string[] = [];

    for (const componentId of readdirSync(root)) {
      const componentPath = resolve(root, componentId);
      if (!statSync(componentPath).isDirectory() || componentId === "src") continue;
      if (!existsSync(resolve(componentPath, "motion.manifest.json"))) continue;
      const scriptPath = resolve(componentPath, "source/script.js");
      const script = readFileSync(scriptPath, "utf8");

      for (const hook of ["motionReplay", "motionPause", "motionSeek"]) {
        if (!script.includes(`window.${hook}`)) missing.push(`${componentId}:${hook}`);
      }
    }

    expect(missing).toEqual([]);
  });
});
