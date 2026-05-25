import { describe, expect, it } from "vitest";
import { generatedWorkEasyRecords } from "./workeasyComponents.generated";
import { workEasyComponentCount, workEasyComponents, workEasySkippedComponents } from "./workeasyComponents";

function visibleLetters(value: string): boolean {
  return /[A-Za-z]/.test(value.replace(/&[a-z]+;/gi, ""));
}

describe("workEasyComponents", () => {
  it("loads every WorkEasy source record and exposes every previewable component", () => {
    expect(generatedWorkEasyRecords).toHaveLength(120);
    expect(workEasyComponentCount).toBe(116);
    expect(workEasySkippedComponents).toEqual([
      { id: "10-button", category: "buttons", issue: "unsupported-type", message: expect.any(String) },
      { id: "4-button", category: "buttons", issue: "unsupported-type", message: expect.any(String) },
      { id: "5-button", category: "buttons", issue: "unsupported-type", message: expect.any(String) },
      { id: "7-cards", category: "cards", issue: "missing-html", message: expect.any(String) }
    ]);
  });

  it("allows previewable components even when no editable params are detected", () => {
    expect(workEasyComponents.some((component) => component.manifest.params.length === 0)).toBe(true);
    expect(
      workEasyComponents.every((component) => component.source.files.some((file) => file.kind === "html"))
    ).toBe(true);
    expect(
      workEasyComponents.every((component) => component.source.files.some((file) => file.kind === "css"))
    ).toBe(true);
  });

  it("does not expose global css-property targets as confirmed params", () => {
    const cssTargets = workEasyComponents.flatMap((component) =>
      component.manifest.params.flatMap((param) =>
        param.targets.filter((target) => target.kind === "css-property")
      )
    );

    expect(cssTargets.length).toBeGreaterThan(0);
    expect(cssTargets.every((target) => /^[.#[]/.test(target.selector))).toBe(true);
    expect(
      cssTargets.every((target) => !target.selector.includes(":") && !target.selector.includes(","))
    ).toBe(true);
  });

  it("localizes visible generated sample copy while preserving component names", () => {
    const leaks: string[] = [];

    for (const component of workEasyComponents) {
      const html = component.source.files.find((file) => file.path === "source/index.html")?.content ?? "";
      const css = component.source.files.find((file) => file.path === "source/style.css")?.content ?? "";
      const bodyHtml = html.replace(/<title>[\s\S]*?<\/title>/gi, "");

      for (const match of bodyHtml.matchAll(/>([^<>]*[A-Za-z][^<>]*)</g)) {
        const value = match[1]?.trim() ?? "";
        if (visibleLetters(value)) leaks.push(`${component.name} html text: ${value}`);
      }

      for (const match of bodyHtml.matchAll(
        /\b(?:aria-label|alt|data-label|data-text|title)="([^"]*[A-Za-z][^"]*)"/g
      )) {
        const value = match[1]?.trim() ?? "";
        if (visibleLetters(value)) leaks.push(`${component.name} html attribute: ${value}`);
      }

      for (const match of css.matchAll(/content:\s*(["'])(.*?)\1/g)) {
        const value = match[2] ?? "";
        if (visibleLetters(value)) leaks.push(`${component.name} css content: ${value}`);
      }
    }

    expect(leaks).toEqual([]);
  });
});
