import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { MotionComponent, MotionManifest } from "@motion-tool/core";
import { MotionRecipePanel } from "./MotionRecipePanel";

const manifest: MotionManifest = {
  version: "1.0",
  id: "recipe-panel",
  name: "Recipe Panel",
  sourceKind: "builtin-component",
  runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
  params: [
    { id: "floatDuration", label: "漂浮周期", type: "duration", default: 3200, status: "confirmed", targets: [] }
  ],
  layers: [
    {
      id: "backgroundLayer",
      label: "背景图层",
      kind: "structure",
      replaceable: true,
      targets: [{ kind: "html-attribute", file: "source/index.html", selector: "[data-motion=backgroundLayer]", attribute: "class" }]
    }
  ],
  motionRecipes: [
    {
      recipeId: "float-loop",
      recipeName: "漂浮循环",
      category: "loop",
      targetLayerIds: ["backgroundLayer"],
      targetRoles: ["background"],
      paramIds: ["floatDuration"],
      trigger: "loop",
      source: "builtin"
    }
  ]
};

const targetComponent: MotionComponent = {
  id: "target-card",
  name: "目标卡片",
  category: "layout",
  tags: [],
  useCases: [],
  moods: [],
  manifest: {
    version: "1.0",
    id: "target-card-manifest",
    name: "目标卡片",
    sourceKind: "builtin-component",
    runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
    params: [],
    layers: [
      {
        id: "cardRoot",
        label: "卡片层",
        kind: "structure",
        replaceable: true,
        targets: [{ kind: "html-attribute", file: "source/index.html", selector: "[data-motion=cardRoot]", attribute: "class" }]
      }
    ]
  },
  source: {
    id: "target-card",
    origin: "builtin",
    kind: "builtin-component",
    entry: "source/index.html",
    files: [{ path: "source/index.html", kind: "html", content: '<main data-motion-root><article data-motion="cardRoot"></article></main>' }]
  }
};

const atomicTargetComponent: MotionComponent = {
  ...targetComponent,
  id: "atomic-target",
  name: "原子频道Tab",
  tags: ["generated", "atomic-motion"],
  useCases: ["atomic-motion"],
  manifest: {
    ...targetComponent.manifest,
    id: "atomic-target-manifest",
    motionSkill: {
      source: "designer-csv",
      element: "horizontal-switch",
      variant: "频道Tab",
      family: "horizontal-switch",
      version: "1.0",
      recipeId: "horizontal-switch.channel-tab",
      tokenIds: []
    }
  }
};

describe("MotionRecipePanel", () => {
  it("renders recipe category, trigger, target layers, and params", () => {
    const html = renderToStaticMarkup(<MotionRecipePanel manifest={manifest} />);

    expect(html).toContain("可迁移动效");
    expect(html).toContain("漂浮循环");
    expect(html).toContain("循环");
    expect(html).toContain("背景图层");
    expect(html).toContain("1 个");
  });

  it("renders a real apply-to-component entry when target components exist", () => {
    const html = renderToStaticMarkup(
      <MotionRecipePanel
        manifest={manifest}
        targetComponents={[targetComponent]}
        onApplyToTarget={vi.fn()}
      />
    );

    expect(html).toContain("将此动效应用到其他组件");
    expect(html).toContain("目标卡片");
    expect(html).toContain("卡片层");
    expect(html).toContain("应用动效");
  });

  it("excludes atomic motion components from apply-to-component targets", () => {
    const html = renderToStaticMarkup(
      <MotionRecipePanel
        manifest={manifest}
        targetComponents={[atomicTargetComponent, targetComponent]}
        onApplyToTarget={vi.fn()}
      />
    );

    expect(html).toContain("目标卡片");
    expect(html).not.toContain("原子频道Tab");
  });

  it("renders nothing when no recipe binding exists", () => {
    expect(renderToStaticMarkup(<MotionRecipePanel manifest={{ ...manifest, motionRecipes: [] }} />)).toBe("");
  });
});
