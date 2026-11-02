import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createReferenceGuidedComponent } from "./referenceGuidedGeneration";
import { applyPatchToFiles } from "../patch/applyPatch";
import {
  applyMotionRecipeToComponent,
  extractMotionRecipeFromComponent,
  validateRecipeApplication
} from "./motionRecipe";
import type { MotionComponent } from "../library/componentLibrary";

const roles = [
  ["按钮", "button"],
  ["卡片", "card"],
  ["徽章", "badge"],
  ["标题文字", "text"],
  ["加载动画", "loader"],
  ["移动端页面", "mobile-page"],
  ["页面转场", "page-transition"]
] as const;
const directions = [
  { label: "从左到右", direction: "left-to-right", axis: "x", start: "calc(var(--travel-distance) * -1)" },
  { label: "从右到左", direction: "right-to-left", axis: "x", start: "var(--travel-distance)" },
  { label: "从上到下", direction: "top-to-bottom", axis: "y", start: "calc(var(--travel-distance) * -1)" },
  { label: "从下到上", direction: "bottom-to-top", axis: "y", start: "var(--travel-distance)" }
] as const;
const motions = ["从左到右滑动", "弹跳", "缩放", "滑动弹跳", "旋转", "淡入", "发光", "呼吸", "漂浮"];
const briefs = roles.flatMap(([label, role]) => {
  const supported =
    role === "page-transition"
      ? ["从左到右滑动", "缩放", "淡入"]
      : role === "loader" || role === "mobile-page"
        ? ["从左到右滑动", "弹跳", "缩放", "淡入", "呼吸", "漂浮"]
        : motions;
  return supported.map((motion) => ({ brief: `${label}，${motion}`, role }));
});

function unconsumedParams(component: MotionComponent): string[] {
  const text = component.source.files.map((file) => file.content).join("\n");
  return component.manifest.params.flatMap((param) =>
    param.targets.flatMap((target) => {
      if (target.kind !== "css-variable") return [];
      const name = target.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`var\\(\\s*${name}\\s*[,)]|getPropertyValue\\(\\s*["']${name}["']\\s*\\)`).test(text)
        ? []
        : [`${param.id}:${target.name}`];
    })
  );
}

function declarations(css: string, selector: string): Record<string, string> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const block = css.match(new RegExp(`(?:^|[}\\s])${escaped}\\s*\\{([^{}]*)\\}`))?.[1] ?? "";
  return Object.fromEntries(
    block
      .split(";")
      .filter((entry) => entry.includes(":"))
      .map((entry) => {
        const colon = entry.indexOf(":");
        return [entry.slice(0, colon).trim(), entry.slice(colon + 1).trim()];
      })
  );
}

describe("generated editing controls", () => {
  it("covers a non-empty matrix of all supported roles", () => {
    expect(briefs).toHaveLength(51);
    expect(new Set(briefs.map(({ role }) => role))).toEqual(new Set(roles.map(([, role]) => role)));
  });

  it.each(briefs)("only exposes consumed variables: $brief", ({ brief, role }) => {
    const result = createReferenceGuidedComponent({ brief, references: [] });
    expect(result.intent.role).toBe(role);
    expect(result.component.manifest.params.length).toBeGreaterThan(0);
    expect(
      result.component.manifest.params.filter((param) =>
        param.targets.some((target) => target.kind === "css-variable")
      ).length
    ).toBeGreaterThan(0);
    expect(result.component.manifest.motionRecipes?.length).toBeGreaterThan(0);
    expect(result.validation.valid, JSON.stringify(result.validation.checks)).toBe(true);
    expect(unconsumedParams(result.component)).toEqual([]);
    const paramIds = result.component.manifest.params.map((param) => param.id);
    for (const binding of result.component.manifest.motionRecipes ?? []) {
      expect(binding.paramIds.every((id) => paramIds.includes(id))).toBe(true);
    }
  });

  it.each(directions)("honours $direction in local button slides", ({ label, direction, axis, start }) => {
    const result = createReferenceGuidedComponent({ brief: `${label}滑动的按钮`, references: [] });
    const css = result.component.source.files.find((file) => file.kind === "css")!.content;
    const end =
      start === "var(--travel-distance)" ? "calc(var(--travel-distance) * -1)" : "var(--travel-distance)";

    expect(result.intent.role).toBe("button");
    expect(result.intent.direction).toBe(direction);
    expect(result.validation.valid).toBe(true);
    expect(result.coverage.missing).toEqual([]);
    const vars = declarations(css, ":root");
    expect(vars["--travel-direction"]).toBe(direction);
    expect(vars["--slide-direction"]).toBe(direction);
    expect(vars[`--travel-${axis}-start`]).toBe(start);
    expect(vars[`--travel-${axis}-end`]).toBe(end);
    const inactiveAxis = axis === "x" ? "y" : "x";
    expect(vars[`--travel-${inactiveAxis}-start`]).toBe("0");
    expect(vars[`--travel-${inactiveAxis}-end`]).toBe("0");
  });

  it.each([
    { forward: "从左到右", reverse: "从右到左", axis: "x" },
    { forward: "从上到下", reverse: "从下到上", axis: "y" }
  ])("reverses $axis travel endpoints for opposite directions", ({ forward, reverse, axis }) => {
    const endpoints = [forward, reverse].map((direction) => {
      const result = createReferenceGuidedComponent({ brief: `${direction}滑动的按钮`, references: [] });
      const css = result.component.source.files.find((file) => file.kind === "css")!.content;
      return ["start", "end"].map(
        (endpoint) => css.match(new RegExp(`--travel-${axis}-${endpoint}: ([^;]+);`))![1]
      );
    });
    const forwardEndpoints = endpoints[0]!;
    const reverseEndpoints = endpoints[1]!;
    expect(forwardEndpoints[0]).not.toBe(reverseEndpoints[0]);
    expect(forwardEndpoints[1]).not.toBe(reverseEndpoints[1]);
    expect(forwardEndpoints).toEqual([...reverseEndpoints].reverse());
  });

  it.each(
    roles.flatMap(([label, role]) =>
      directions.map((direction) => ({ roleLabel: label, role, ...direction }))
    )
  )("validates $role slides in $direction", ({ roleLabel, role, label, direction }) => {
    const result = createReferenceGuidedComponent({ brief: `${roleLabel}，${label}滑动`, references: [] });
    expect(result.intent.role).toBe(role);
    expect(result.intent.direction).toBe(direction);
    expect(result.validation.valid, JSON.stringify(result.coverage)).toBe(true);
    expect(result.coverage.missing).toEqual([]);
    expect(unconsumedParams(result.component)).toEqual([]);
  });

  it.each(roles.filter(([, role]) => !["button", "page-transition"].includes(role)))(
    "changes %s source for both pairs of opposite directions",
    (label) => {
      const sources = directions.map(
        ({ label: direction }) =>
          createReferenceGuidedComponent({ brief: `${label}，${direction}滑动`, references: [] }).component
            .source.files
      );
      expect(sources[0]).not.toEqual(sources[1]);
      expect(sources[2]).not.toEqual(sources[3]);
    }
  );

  it.each(
    roles
      .filter(([, role]) => ["card", "badge", "text", "mobile-page"].includes(role))
      .flatMap(([label, role]) =>
        directions.flatMap((direction) =>
          ["滑动", "滑动弹跳"].map((motion) => ({
            roleLabel: label,
            role,
            ...direction,
            motion
          }))
        )
      )
  )(
    "settles $role $motion from $direction on the correct axis",
    ({ roleLabel, role, label, direction, axis, start, motion }) => {
      const { component } = createReferenceGuidedComponent({
        brief: `${roleLabel}，${label}${motion}`,
        references: []
      });
      const css = component.source.files.find((file) => file.kind === "css")!.content;
      const vars = declarations(css, ":root");
      expect(vars["--travel-direction"]).toBe(direction);
      expect(vars["--slide-direction"]).toBe(direction);
      expect(vars[`--travel-${axis}-start`]).toBe(start);
      expect(vars[`--travel-${axis === "x" ? "y" : "x"}-start`]).toBe("0");
      expect(vars["--travel-x-end"]).toBe("0");
      expect(vars["--travel-y-end"]).toBe("0");
      expect(vars["--travel-distance"]).toMatch(/^\d+px$/);
      expect(declarations(css, "0%")["transform"]).toContain(
        "translate(var(--travel-x-start), var(--travel-y-start))"
      );
      const end = declarations(css, "100%")["transform"];
      expect(end).toContain(
        role === "mobile-page" ? "translate(0, 0)" : "translate(var(--travel-x-end), var(--travel-y-end))"
      );
    }
  );

  it.each(directions)("flows loader dots in $direction", ({ label, direction, axis }) => {
    const { component } = createReferenceGuidedComponent({ brief: `加载动画，${label}滑动`, references: [] });
    const css = component.source.files.find((file) => file.kind === "css")!.content;
    const vars = declarations(css, ":root");
    expect(vars["--travel-direction"]).toBe(direction);
    expect(vars["--slide-direction"]).toBe(direction);
    const layout = declarations(css, ".semantic-loader");
    expect(layout["flex-direction"] ?? "row").toBe(axis === "y" ? "column" : "row");
    const base = declarations(css, ".semantic-loader-dot");
    const delays = [1, 2, 3].map(
      (index) =>
        declarations(css, `.semantic-loader-dot:nth-child(${index})`)["animation-delay"] ??
        base["animation-delay"] ??
        "0s"
    );
    const increasing = ["0s", "calc(var(--motion-duration) * 0.16)", "calc(var(--motion-duration) * 0.32)"];
    expect(delays).toEqual(
      ["right-to-left", "bottom-to-top"].includes(direction) ? [...increasing].reverse() : increasing
    );
    expect(base["animation"]).toBe(
      "generated-loop-dots var(--motion-duration) var(--motion-easing) infinite"
    );
    expect(vars["--motion-duration"]).toBe("620ms");
    expect(declarations(css, "40%")["transform"]).toBe("translateY(-14px) scale(1.08)");
  });

  it.each(["从右到左滑动的移动端页面", "从下到上滑动弹跳的移动端页面"])(
    "keeps the directional entrance winning the cascade: %s",
    (brief) => {
      const { component } = createReferenceGuidedComponent({ brief, references: [] });
      const css = component.source.files.find((file) => file.path === "source/style.css")?.content ?? "";
      const winner = css.match(/\.is-playing \.foreground-layer\s*\{\s*animation:\s*([\w-]+)/)?.[1];
      expect(winner).toBeTruthy();
      expect(css.slice(css.indexOf(`@keyframes ${winner}`))).toContain("var(--travel-x-start)");
      expect(css).not.toContain(".is-playing [data-motion=foregroundLayer]");
    }
  );

  it("preserves all null-direction source bytes", () => {
    const hashes = Object.fromEntries(
      roles.map(([label, role]) => {
        const sources = motions
          .filter((motion) => !motion.includes("从"))
          .map((motion) => {
            const result = createReferenceGuidedComponent({
              brief: `${label}，${motion}`,
              references: [],
              now: 1
            });
            expect(result.intent.direction).toBeNull();
            // Preserve the button's existing null-direction marker for byte compatibility.
            if (role !== "button") {
              expect(result.component.source.files.map((file) => file.content).join("\n")).not.toContain(
                "--travel-direction"
              );
            }
            return result.component.source.files;
          });
        return [role, createHash("sha256").update(JSON.stringify(sources)).digest("hex")];
      })
    );
    expect(hashes).toMatchInlineSnapshot(`
      {
        "badge": "3258120773dbccf4558e36c348b2a480eeead6c2282314ac846c1a2826892b13",
        "button": "967ca7d304023e4e2a19ef558c79b1e4ceaf7ebc1af0d5f0a880522d393a170a",
        "card": "6cc51aed54de451fc931b1470863d44609198ff5dfa0a6988c77b8394d33695c",
        "loader": "b3efd349dbe50aa6e57f2ba08366d7f278bc379da665960faf0909448d97de01",
        "mobile-page": "3aaaabfce4c7e41159ed470951684200736460f8ef8d6549d4907afad1dae3ad",
        "page-transition": "9f3cfcfd8ebb3450f499df2611fff10ed94873cc23f6ae5598f13c603f3db50f",
        "text": "5dbb2b7d3af9f910959140b04577c0eeeeadb05e598d26175dc201fae4eedcbe",
      }
    `);
  });

  it.each(roles.filter(([, role]) => role !== "page-transition"))(
    "rejects a %s model draft without direction evidence and falls back to local source",
    (label) => {
      const brief = `从右到左滑动的${label}`;
      const local = createReferenceGuidedComponent({ brief, references: [] });
      const sourceDraft = {
        html: local.component.source.files.find((file) => file.kind === "html")!.content,
        css: local.component.source.files
          .find((file) => file.kind === "css")!
          .content.replaceAll("right-to-left", "left-to-right"),
        js:
          local.component.source.files.find((file) => file.kind === "js")!.content +
          "\nwindow.modelDraftMarker = true;"
      };
      expect(Object.values(sourceDraft).join("\n")).not.toContain("right-to-left");

      const result = createReferenceGuidedComponent({ brief, references: [], sourceDraft });
      expect(result.component.source.files.map((file) => file.content).join("\n")).not.toContain(
        "modelDraftMarker"
      );
      expect(result.component.source.files).toEqual(local.component.source.files);
      expect(result.validation.valid).toBe(true);
      expect(result.coverage.missing).toEqual([]);
    }
  );

  it("filters inert manifest params and keeps travelDistance and the brief's direction in source", () => {
    const { component, validation } = createReferenceGuidedComponent({
      brief: "从右到左滑动的按钮",
      references: []
    });
    const files = Object.fromEntries(component.source.files.map((file) => [file.path, file.content]));
    const css = files["source/style.css"];
    expect(component.manifest.params.find((param) => param.id === "travelDistance")).toBeDefined();
    expect(css).toContain("--travel-x-start: var(--travel-distance)");
    expect(css).toContain("--travel-x-end: calc(var(--travel-distance) * -1)");
    for (const name of ["--slide-distance", "--slide-direction", "--opacity-start", "--opacity-end"]) {
      expect(css).toContain(`${name}:`);
      expect(
        component.manifest.params.some((param) =>
          param.targets.some((target) => target.kind === "css-variable" && target.name === name)
        )
      ).toBe(false);
    }
    expect(validation.valid, JSON.stringify(validation.checks)).toBe(true);
    expect(Object.values(files).join("\n")).toContain("right-to-left");
    const patched = applyPatchToFiles({
      files,
      manifest: component.manifest,
      patch: { id: "edit", sourceManifestId: component.manifest.id, values: { travelDistance: 60 } }
    });
    expect(patched["source/style.css"]).toContain("--travel-distance: 60vw");
    expect(patched["source/style.css"]).not.toBe(css);
  });

  it("filters model drafts while retaining variables read by JavaScript", () => {
    const brief = "从左到右滑动的按钮";
    const base = createReferenceGuidedComponent({ brief, references: [] }).component;
    const result = createReferenceGuidedComponent({
      brief,
      references: [],
      sourceDraft: {
        html: base.source.files.find((file) => file.kind === "html")!.content,
        css: base.source.files.find((file) => file.kind === "css")!.content,
        js:
          base.source.files.find((file) => file.kind === "js")!.content +
          '\nwindow.modelDraftMarker = getComputedStyle(document.body).getPropertyValue("--bounce-scale");'
      }
    });
    expect(result.validation.valid).toBe(true);
    expect(result.component.source.files.map((file) => file.content).join("\n")).toContain(
      "modelDraftMarker"
    );
    expect(result.component.manifest.params.some((param) => param.id === "bounceIntensity")).toBe(true);
    expect(unconsumedParams(result.component)).toEqual([]);
  });

  it("still migrates the generated slide recipe onto another component", () => {
    const generated = createReferenceGuidedComponent({ brief: "从左到右滑动的按钮", references: [] });
    const extracted = extractMotionRecipeFromComponent(generated.component);
    expect(extracted).not.toBeNull();
    const target: MotionComponent = {
      ...generated.component,
      id: "target",
      manifest: {
        ...generated.component.manifest,
        id: "target",
        params: [],
        layers: [
          {
            id: "target",
            label: "目标",
            kind: "structure",
            replaceable: true,
            targets: [
              { kind: "html-attribute", file: "source/index.html", selector: ".target", attribute: "class" }
            ]
          }
        ],
        motionRecipes: []
      },
      source: {
        ...generated.component.source,
        files: [
          {
            path: "source/index.html",
            kind: "html",
            content: '<main data-motion-root><button class="target">目标</button></main>'
          },
          { path: "source/style.css", kind: "css", content: "button { color: red; }" },
          { path: "source/script.js", kind: "js", content: "" }
        ]
      }
    };
    const migrated = applyMotionRecipeToComponent({
      sourceComponent: generated.component,
      targetComponent: target,
      targetLayerId: "target"
    });
    expect(
      validateRecipeApplication({
        binding: migrated.manifest.motionRecipes![0]!,
        params: migrated.manifest.params,
        layers: migrated.manifest.layers!,
        sourceText: migrated.source.files.map((file) => file.content).join("\n")
      }).valid
    ).toBe(true);
    expect(migrated.manifest.params.length).toBeGreaterThan(0);
    expect(migrated.source.files.find((file) => file.kind === "css")?.content).toContain(
      "var(--slide-distance, 80px)"
    );
  });
});
