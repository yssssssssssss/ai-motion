import { expect, it, vi } from "vitest";
import { createReferenceGuidedComponent } from "./referenceGuidedGeneration";
import { validateGeneratedComponent } from "./sandbox";
import type { SourceFile } from "../library/componentLibrary";

function previewCheck(file: SourceFile) {
  const { component } = createReferenceGuidedComponent({ brief: "红色按钮", now: 1 });
  component.source.files = [...component.source.files.filter((item) => item.path !== file.path), file];
  return validateGeneratedComponent({
    component,
    allowed: { paramIds: [], layerIds: [], sourceFiles: [] }
  }).checks.find((check) => check.id === "preview-playable");
}

it.each([
  { path: "broken.js", kind: "js" as const, content: "const = ;" },
  { path: "broken.html", kind: "html" as const, content: "<script>const = ;</script>" }
])("rejects syntax errors and names $path", (file) => {
  expect(previewCheck(file)).toMatchObject({ status: "fail", message: expect.stringContaining(file.path) });
});

it.each([
  "throw new Error('must not execute');",
  "const text = 'export const = ;';",
  "import value from './dependency.js'; export default value;",
  "// comment\nexport const value = 1;"
])("accepts valid classic code or skips a module: %s", (content) => {
  expect(previewCheck({ path: "script.js", kind: "js", content })).toMatchObject({ status: "pass" });
});

it("skips explicit modules and non-JavaScript script data", () => {
  expect(
    previewCheck({
      path: "scripts.html",
      kind: "html",
      content: '<script type="module">const = ;</script><script type="application/json">{"value": 1}</script>'
    })
  ).toMatchObject({ status: "pass" });
});

it("does not reject code when the parser is unavailable", () => {
  vi.stubGlobal("Function", function () {
    throw new EvalError("disabled");
  });
  try {
    expect(previewCheck({ path: "script.js", kind: "js", content: "const value = 1;" })).toMatchObject({
      status: "pass"
    });
  } finally {
    vi.unstubAllGlobals();
  }
});
