import { expect, it } from "vitest";
import { builtinComponents } from "@motion-tool/components-builtin";
import { validateGeneratedComponent } from "@motion-tool/core";

it("keeps every loaded builtin preview playable under the syntax gate", () => {
  expect(builtinComponents.length).toBeGreaterThan(0);
  expect(
    builtinComponents.some((component) => component.source.files.some((file) => file.kind === "js"))
  ).toBe(true);
  for (const component of builtinComponents) {
    const result = validateGeneratedComponent({
      component,
      allowed: { paramIds: [], layerIds: [], sourceFiles: [] }
    });
    expect(
      result.checks.find((check) => check.id === "preview-playable"),
      component.id
    ).toMatchObject({
      status: "pass"
    });
  }
});
