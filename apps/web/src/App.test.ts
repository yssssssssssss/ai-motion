import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");

describe("App bundle boundaries", () => {
  it("does not statically import heavy component libraries into the entry chunk", () => {
    expect(appSource).not.toMatch(
      /import\s+\{[^}]*builtinComponents[^}]*\}\s+from\s+["']@motion-tool\/components-builtin["']/
    );
    expect(appSource).not.toMatch(
      /import\s+\{[^}]*workEasyComponents[^}]*\}\s+from\s+["']\.\/data\/workeasyComponents["']/
    );
    expect(appSource).toContain("@motion-tool/components-builtin/src/lazy");
    expect(appSource).toContain("loadInitialComponents");
  });

  it("keeps user-added components when the async library load finishes later", () => {
    expect(appSource).toContain("setComponents((current) => mergeComponents(initialComponents, current))");
  });
});
