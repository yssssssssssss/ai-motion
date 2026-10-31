import { afterEach, expect, it, vi } from "vitest";
import { createReferenceGuidedComponent } from "./referenceGuidedGeneration";
import * as motionRecipe from "./motionRecipe";
import type { MotionTarget } from "../manifest/types";

const applyMotionRecipe = motionRecipe.applyMotionRecipe;
afterEach(() => vi.restoreAllMocks());

it.each([false, true])("preserves recipe-applied source bytes (model draft: %s)", (useDraft) => {
  const brief = "从左到右滑动的按钮";
  const base = createReferenceGuidedComponent({ brief, references: [] }).component;
  const spy = vi.spyOn(motionRecipe, "applyMotionRecipe");
  const result = createReferenceGuidedComponent({
    brief,
    references: [],
    ...(useDraft
      ? {
          sourceDraft: {
            html: base.source.files.find((file) => file.kind === "html")!.content,
            css: base.source.files.find((file) => file.kind === "css")!.content,
            js: base.source.files.find((file) => file.kind === "js")!.content
          }
        }
      : {})
  });
  expect(result.validation.valid).toBe(true);
  expect(spy).toHaveBeenCalledTimes(1);
  expect(result.component.source.files).toEqual(spy.mock.results[0]!.value.files);
});

it("cleans groups, recipe ids and layer links while retaining mixed and partially consumed targets", () => {
  const unused: MotionTarget = {
    kind: "css-variable",
    file: "source/style.css",
    selector: ":root",
    name: "--unused"
  };
  const spy = vi.spyOn(motionRecipe, "applyMotionRecipe").mockImplementationOnce((input) => {
    const applied = applyMotionRecipe(input);
    const label = applied.params.find((param) => param.id === "buttonLabel")!;
    applied.params = applied.params.map((param) =>
      param.id === label.id ? { ...param, targets: [unused] } : param
    );
    applied.params.push(
      { ...label, id: "mixed", targets: [unused, ...label.targets] },
      {
        ...label,
        id: "partlyConsumed",
        targets: [unused, { ...unused, name: "--motion-duration" }]
      }
    );
    applied.binding.paramIds.push(label.id);
    return applied;
  });
  const { component, validation } = createReferenceGuidedComponent({
    brief: "从左到右滑动的按钮",
    references: []
  });
  expect(validation.valid).toBe(true);
  expect(component.source.files).toEqual(spy.mock.results[0]!.value.files);
  expect(component.manifest.params.map((param) => param.id)).toEqual(
    expect.arrayContaining(["mixed", "partlyConsumed"])
  );
  expect(component.manifest.params.some((param) => param.id === "buttonLabel")).toBe(false);
  expect(component.manifest.groups!.flatMap((group) => group.params)).not.toContain("buttonLabel");
  expect(component.manifest.motionRecipes![0]!.paramIds).not.toContain("buttonLabel");
  expect(component.manifest.layers!.find((layer) => layer.id === "buttonLabel")).not.toHaveProperty(
    "paramId"
  );
});
