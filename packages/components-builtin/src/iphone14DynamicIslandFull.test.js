import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const currentDir = dirname(fileURLToPath(import.meta.url));
const componentDir = resolve(currentDir, "../iphone-14-w-dynamic-island");

function readComponentFile(path) {
  return readFileSync(resolve(componentDir, path), "utf8");
}

describe("iphone 14 dynamic island full component", () => {
  it("removes the trimmed dynamic island only component", () => {
    expect(existsSync(resolve(currentDir, "../iphone-dynamic-island-only/metadata.json"))).toBe(false);
    expect(existsSync(resolve(currentDir, "../iphone-dynamic-island-only/motion.manifest.json"))).toBe(false);
    expect(existsSync(resolve(currentDir, "../iphone-dynamic-island-only/source/index.html"))).toBe(false);
  });

  it("registers the complete zip component as a builtin feed item", () => {
    const metadata = JSON.parse(readComponentFile("metadata.json"));
    const manifest = JSON.parse(readComponentFile("motion.manifest.json"));

    expect(metadata.id).toBe("iphone-14-w-dynamic-island");
    expect(metadata.name).toBe("iPhone 14 灵动岛完整手机");
    expect(manifest.id).toBe(metadata.id);
    expect(manifest.runtime.entry).toBe("source/index.html");
    expect(manifest.layers.map((layer) => layer.id)).toEqual([
      "phone",
      "dynamic-island",
      "screen",
      "palette"
    ]);
  });

  it("preserves the complete phone demo structure from the zip", () => {
    const html = readComponentFile("source/index.html");
    const style = readComponentFile("source/style.css");
    const script = readComponentFile("source/script.js");

    expect(html).toContain('class="scene" data-motion-root');
    expect(html).toContain('id="deep-purple"');
    expect(html).toContain('id="gold"');
    expect(html).toContain('id="space-black"');
    expect(html).toContain('id="silver"');
    expect(html).toContain('id="random"');
    expect(html).toContain('id="zoom"');
    expect(html).toContain('class="pallette"');
    expect(html).toContain('class="phone"');
    expect(html).toContain('class="buttons"');
    expect(html).toContain('class="camera"');
    expect(html).toContain('class="screen-container"');
    expect(html).toContain('class="notch-container"');
    expect(html).toContain('class="screen"');
    expect(html).toContain('class="app"');
    expect(html).toContain('class="random canvas"');
    expect(style).toContain("--size: max(7px, 1.2vmin);");
    expect(style).toContain("--height: 80em;");
    expect(style).toContain("--notch-width: 33.3%;");
    expect(style).toContain("--notch-duration:");
    expect(style).toContain("max-width: var(--notch-width);");
    expect(style).toContain("max-height: var(--notch-height);");
    expect(style).not.toContain("transform: scale3d(0.375, 0.4, 1);");
    expect(style).toContain(".random {");
    expect(style).toContain("animation-play-state: var(--motion-play-state, running);");
    expect(style).toContain("#zoom:checked");
    expect(script).toContain("generateGradient");
    expect(script).toContain("window.motionReplay");
    expect(script).toContain("window.motionPause");
    expect(script).toContain("window.motionSeek");
  });

  it("keeps preview self-contained for the project iframe sandbox", () => {
    const html = readComponentFile("source/index.html");
    const style = readComponentFile("source/style.css");
    const script = readComponentFile("source/script.js");

    expect(html).not.toContain("public.codepenassets.com");
    expect(html).not.toContain("cdnjs.cloudflare.com");
    expect(style).not.toContain("@import url(");
    expect(script).toContain("window.domtoimage");
  });
});
