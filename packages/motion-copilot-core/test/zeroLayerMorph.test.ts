import { execFile, execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  compileZeroLayerMotionBindings,
  compileZeroLayerMotionComposition,
  classifyZeroLayerSnapshotRoles,
  createZeroMotionOrderPlan,
  createZeroLayerDiagnosticReport,
  createZeroLayerRecipeSampleReport,
  buildZeroMotionSpec,
  classifyZeroMotionInteractionPattern,
  createZeroMotionRepairAdvice,
  adaptZeroLayerRecipeParameters,
  deriveZeroLayerFramePairs,
  deriveZeroLayerNodeCandidates,
  deriveZeroLayerObjects,
  evaluateZeroMotionSalience,
  exportCompositionHtml,
  normalizeZeroLayerSnapshot,
  parseZeroLayerFrameRole,
  applyZeroLayerMotionRecipe,
  recommendZeroLayerRecipes,
  getZeroLayerRecipeManifest,
  validateZeroLayerRecipeManifestRegistry,
  zeroLayerExpressionStrategyForStep,
  zeroLayerExpressionStrategies,
  zeroLayerRecipeManifests,
  zeroLayerMotionRecipes,
  type ZeroLayerSnapshot
} from "../src";

function rootPath(...parts: string[]): string {
  return resolve(fileURLToPath(new URL("../../..", import.meta.url)), ...parts);
}

function execFileText(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolveText, reject) => {
    execFile(
      command,
      args,
      { encoding: "utf8", env, maxBuffer: 16 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr.trim() || error.message));
          return;
        }
        resolveText(stdout);
      }
    );
  });
}

function makeLayerSnapshot(kind: "from" | "to"): ZeroLayerSnapshot {
  const isTo = kind === "to";
  return normalizeZeroLayerSnapshot({
    schemaVersion: "motion-copilot.zero-layer-snapshot.v1",
    frameId: isTo ? "28:2" : "28:19",
    nodeId: isTo ? "28:2" : "28:19",
    name: isTo ? "展开态" : "收起态",
    width: isTo ? 260 : 180,
    height: 72,
    screenshotUrl: `data:image/png;base64,${isTo ? "TO" : "FROM"}`,
    assets: [],
    layers: [
      {
        nodeId: isTo ? "28:2" : "28:19",
        name: isTo ? "展开态" : "收起态",
        kind: "frame",
        bounds: { x: 0, y: 0, w: isTo ? 260 : 180, h: 72 },
        opacity: 1,
        visible: true,
        fills: [{ type: "solid", color: "#ffffff" }],
        children: ["bg", "pill", "label"]
      },
      {
        nodeId: "bg",
        parentId: isTo ? "28:2" : "28:19",
        name: "组件背景",
        kind: "rect",
        bounds: { x: 0, y: 0, w: isTo ? 260 : 180, h: 72 },
        opacity: 1,
        visible: true,
        cornerRadius: 18,
        fills: [{ type: "solid", color: "#ffffff" }]
      },
      {
        nodeId: "pill",
        parentId: isTo ? "28:2" : "28:19",
        name: "状态胶囊",
        kind: "rect",
        bounds: { x: 24, y: 20, w: isTo ? 168 : 88, h: 28 },
        opacity: 1,
        visible: true,
        cornerRadius: 999,
        fills: [{ type: "solid", color: "#f3f3f3" }]
      },
      {
        nodeId: "label",
        parentId: isTo ? "28:2" : "28:19",
        name: "状态文字",
        kind: "text",
        bounds: { x: 36, y: 26, w: isTo ? 96 : 48, h: 16 },
        opacity: 1,
        visible: true,
        text: isTo ? "待确认 2" : "2",
        fills: [{ type: "solid", color: "#cdab18" }],
        textStyle: { fontSize: 12, fontWeight: 500, lineHeight: 16 }
      }
    ]
  });
}

function makeDropdownLayerSnapshot(kind: "from" | "to"): ZeroLayerSnapshot {
  const isTo = kind === "to";
  const rootId = isTo ? "33:35" : "33:36";
  return normalizeZeroLayerSnapshot({
    schemaVersion: "motion-copilot.zero-layer-snapshot.v1",
    frameId: rootId,
    nodeId: rootId,
    name: isTo ? "多选项-尾帧" : "多选项-首帧",
    width: 220,
    height: isTo ? 142 : 44,
    screenshotUrl: `data:image/png;base64,${isTo ? "TO" : "FROM"}`,
    assets: [],
    layers: [
      {
        nodeId: rootId,
        name: isTo ? "多选项-尾帧" : "多选项-首帧",
        kind: "group",
        bounds: { x: 0, y: 0, w: 220, h: isTo ? 142 : 44 },
        opacity: 1,
        visible: true,
        children: isTo ? ["tabs", "menu", "item-1", "item-2", "item-3"] : ["tabs"]
      },
      {
        nodeId: "tabs",
        parentId: rootId,
        name: "Tabs 标签页",
        kind: "frame",
        bounds: { x: 0, y: 0, w: 220, h: 44 },
        opacity: 1,
        visible: true,
        cornerRadius: 12,
        fills: [{ type: "solid", color: "#ffffff" }]
      },
      {
        nodeId: "tab-label",
        parentId: "tabs",
        name: "当前标签",
        kind: "text",
        bounds: { x: 24, y: 11, w: 70, h: 22 },
        opacity: 1,
        visible: true,
        text: "业务流程图",
        fills: [{ type: "solid", color: "#11141a" }],
        textStyle: { fontSize: 14, fontWeight: 600, lineHeight: 22 }
      },
      ...(isTo
        ? [
            {
              nodeId: "menu",
              parentId: rootId,
              name: "下拉菜单",
              kind: "frame" as const,
              bounds: { x: 0, y: 50, w: 124, h: 92 },
              opacity: 1,
              visible: true,
              cornerRadius: 12,
              fills: [{ type: "solid" as const, color: "#ffffff" }]
            },
            ...[0, 1, 2].map((index) => ({
              nodeId: `item-${index + 1}`,
              parentId: "menu",
              name: `Action item ${index + 1}`,
              kind: "frame" as const,
              bounds: { x: 4, y: 54 + index * 28, w: 116, h: 28 },
              opacity: 1,
              visible: true,
              cornerRadius: 8,
              fills: [{ type: "solid" as const, color: index === 0 ? "#f3f5f7" : "#ffffff" }]
            }))
          ]
        : [])
    ]
  });
}

describe("ZeroLayerSnapshot morph", () => {
  it("normalizes Relay layer snapshots without losing background, radius, or opacity", () => {
    const snapshot = makeLayerSnapshot("from");

    expect(snapshot.layers.find((layer) => layer.nodeId === "bg")).toMatchObject({
      name: "组件背景",
      kind: "rect",
      cornerRadius: 18,
      fills: [{ type: "solid", color: "#ffffff" }]
    });
    expect(snapshot.layers.find((layer) => layer.nodeId === "pill")).toMatchObject({
      bounds: { x: 24, y: 20, w: 88, h: 28 },
      cornerRadius: 999,
      opacity: 1
    });
  });

  it("exports a zero-layer morph without using the legacy ZeroVisualSnapshot renderer", () => {
    const from = makeLayerSnapshot("from");
    const to = makeLayerSnapshot("to");
    const bindings = compileZeroLayerMotionBindings(from, to);
    const result = compileZeroLayerMotionComposition({ from, to, bindingResult: bindings });

    expect(result.document.visualSource?.kind).toBe("zero-layer-morph");
    const html = exportCompositionHtml(result.document.composition!, result.document);

    expect(html).toContain("mc-zero-layer-stage");
    expect(html).toContain('data-zero-layer-id="pill"');
    expect(html).toContain("border-radius:999px");
    expect(html).toContain("background:#f3f3f3");
    expect(html).toContain("@keyframes mc-zero-layer-match");
    expect(html).not.toContain("mc-zero-from");
  });

  it("keeps the root background layer in the exported zero-layer HTML", () => {
    const from = makeLayerSnapshot("from");
    const to = makeLayerSnapshot("to");
    const bindings = compileZeroLayerMotionBindings(from, to);
    const result = compileZeroLayerMotionComposition({ from, to, bindingResult: bindings });

    const html = exportCompositionHtml(result.document.composition!, result.document);

    expect(html).toContain('data-zero-layer-id="28:19"');
    expect(html).toContain('data-zero-layer-id="28:2"');
    expect(html).toContain("background:transparent");
  });

  it("does not add synthetic Y motion to entering or exiting layers", () => {
    const from = makeLayerSnapshot("from");
    const to = makeLayerSnapshot("to");
    const exitNode = from.layers.find((layer) => layer.nodeId === "label");
    const enterNode = to.layers.find((layer) => layer.nodeId === "pill");
    if (!exitNode || !enterNode) throw new Error("expected test layers");

    const result = compileZeroLayerMotionComposition({
      from,
      to,
      bindingResult: {
        bindings: [],
        exit: [exitNode],
        enter: [enterNode],
        unresolved: []
      }
    });

    const enterStep = result.steps.find((step) => step.id.startsWith("zero-layer-enter"));
    const exitStep = result.steps.find((step) => step.id.startsWith("zero-layer-exit"));
    expect(enterStep?.initial?.y).toBe(0);
    expect(enterStep?.animate?.y).toBe(0);
    expect(exitStep?.initial?.y).toBe(0);
    expect(exitStep?.animate?.y).toBe(0);

    const html = exportCompositionHtml(result.document.composition!, result.document);
    expect(html).not.toContain("translate(0px,8px)");
    expect(html).not.toContain("translate(0px,-8px)");
  });

  it("applies high-fidelity layer overrides to geometry, radius, and opacity", () => {
    const from = makeLayerSnapshot("from");
    const to = makeLayerSnapshot("to");
    const bindings = compileZeroLayerMotionBindings(from, to);
    const result = compileZeroLayerMotionComposition({ from, to, bindingResult: bindings });

    if (result.document.visualSource?.kind !== "zero-layer-morph") {
      throw new Error("expected zero-layer-morph source");
    }
    result.document.visualSource.nodeOverrides = [
      { frame: "both", nodeId: "pill", x: 32, y: 18, width: 188, height: 32, cornerRadius: 16, opacity: 0.64 }
    ];

    const html = exportCompositionHtml(result.document.composition!, result.document);
    expect(html).toContain("left:32px");
    expect(html).toContain("top:18px");
    expect(html).toContain("width:188px");
    expect(html).toContain("height:32px");
    expect(html).toContain("border-radius:16px");
    expect(html).toContain("opacity:0.64");
  });

  it("derives Zero object guidance without replacing raw source layers", () => {
    const from = makeLayerSnapshot("from");
    const to = makeLayerSnapshot("to");
    const objects = deriveZeroLayerObjects(from);

    expect(objects.find((object) => object.kind === "status-pill")).toMatchObject({
      name: "状态胶囊",
      nodeIds: ["pill"]
    });

    const bindings = compileZeroLayerMotionBindings(from, to);
    const result = compileZeroLayerMotionComposition({ from, to, bindingResult: bindings });

    if (result.document.visualSource?.kind !== "zero-layer-morph") {
      throw new Error("expected zero-layer-morph source");
    }
    expect(result.document.visualSource.objects?.from.some((object) => object.kind === "status-pill")).toBe(
      true
    );
    expect(result.document.visualSource.from.layers.map((layer) => layer.nodeId)).toEqual(
      from.layers.map((layer) => layer.nodeId)
    );
  });

  it("derives selectable Zero node candidates with stable paths", () => {
    const snapshot = normalizeZeroLayerSnapshot({
      ...makeLayerSnapshot("from"),
      layers: [
        ...makeLayerSnapshot("from").layers,
        {
          nodeId: "hidden",
          parentId: "28:19",
          name: "隐藏节点",
          kind: "rect",
          bounds: { x: 1, y: 1, w: 10, h: 10 },
          opacity: 1,
          visible: false
        },
        {
          nodeId: "zero-size",
          parentId: "28:19",
          name: "零尺寸",
          kind: "rect",
          bounds: { x: 1, y: 1, w: 0, h: 10 },
          opacity: 1,
          visible: true
        }
      ]
    });

    const candidates = deriveZeroLayerNodeCandidates(snapshot);

    expect(candidates.map((candidate) => candidate.nodeId)).toEqual(["28:19", "bg", "pill", "label"]);
    expect(candidates[0]).toMatchObject({
      nodeId: "28:19",
      name: "收起态",
      kind: "frame",
      bounds: { x: 0, y: 0, w: 180, h: 72 }
    });
    expect(candidates.find((candidate) => candidate.nodeId === "label")?.path).toEqual([
      "收起态",
      "状态文字 · 2"
    ]);
  });

  it("parses Zero first and tail frame naming suffixes only at the end", () => {
    expect(parseZeroLayerFrameRole("信息卡片-首帧")).toMatchObject({
      role: "from",
      baseName: "信息卡片"
    });
    expect(parseZeroLayerFrameRole("信息卡片-尾帧")).toMatchObject({
      role: "to",
      baseName: "信息卡片"
    });
    expect(parseZeroLayerFrameRole("信息卡片_尾帧")).toBeUndefined();
    expect(parseZeroLayerFrameRole("首帧说明文本")).toBeUndefined();
  });

  it("derives named first-tail frame pairs from Zero layer candidates", () => {
    const from = normalizeZeroLayerSnapshot({
      ...makeLayerSnapshot("from"),
      layers: [
        ...makeLayerSnapshot("from").layers,
        {
          nodeId: "named-from",
          parentId: "28:19",
          name: "信息卡片-首帧",
          kind: "frame",
          bounds: { x: 0, y: 0, w: 180, h: 72 },
          opacity: 1,
          visible: true
        }
      ]
    });
    const to = normalizeZeroLayerSnapshot({
      ...makeLayerSnapshot("to"),
      layers: [
        ...makeLayerSnapshot("to").layers,
        {
          nodeId: "named-to",
          parentId: "28:2",
          name: "信息卡片-尾帧",
          kind: "frame",
          bounds: { x: 0, y: 0, w: 260, h: 72 },
          opacity: 1,
          visible: true
        }
      ]
    });

    const pairs = deriveZeroLayerFramePairs(from, to);

    expect(pairs[0]).toMatchObject({
      label: "信息卡片",
      fromNodeId: "named-from",
      toNodeId: "named-to",
      confidence: 96
    });
  });

  it("pairs first-tail frames after normalizing common state words", () => {
    const from = normalizeZeroLayerSnapshot({
      ...makeLayerSnapshot("from"),
      layers: [
        ...makeLayerSnapshot("from").layers,
        {
          nodeId: "collapsed-from",
          parentId: "28:19",
          name: "信息收起状态-首帧",
          kind: "frame",
          bounds: { x: 0, y: 0, w: 180, h: 72 },
          opacity: 1,
          visible: true
        }
      ]
    });
    const to = normalizeZeroLayerSnapshot({
      ...makeLayerSnapshot("to"),
      layers: [
        ...makeLayerSnapshot("to").layers,
        {
          nodeId: "expanded-to",
          parentId: "28:2",
          name: "信息展开状态-尾帧",
          kind: "frame",
          bounds: { x: 0, y: 0, w: 260, h: 72 },
          opacity: 1,
          visible: true
        }
      ]
    });

    const pairs = deriveZeroLayerFramePairs(from, to);

    expect(pairs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "信息",
          fromNodeId: "collapsed-from",
          toNodeId: "expanded-to",
          confidence: 84,
          reasons: expect.arrayContaining(["状态词归一化匹配"])
        })
      ])
    );
  });

  it("prioritizes named and structural Zero node candidates before small leaf layers", () => {
    const snapshot = normalizeZeroLayerSnapshot({
      ...makeLayerSnapshot("from"),
      layers: [
        ...makeLayerSnapshot("from").layers,
        {
          nodeId: "named-from",
          parentId: "28:19",
          name: "信息卡片-首帧",
          kind: "group",
          bounds: { x: 20, y: 20, w: 60, h: 20 },
          opacity: 1,
          visible: true
        }
      ]
    });

    const candidates = deriveZeroLayerNodeCandidates(snapshot);

    expect(candidates.map((candidate) => candidate.nodeId).slice(0, 3)).toEqual([
      "28:19",
      "named-from",
      "bg"
    ]);
    expect(candidates.find((candidate) => candidate.nodeId === "named-from")).toMatchObject({
      role: "from",
      baseName: "信息卡片"
    });
  });

  it("only treats dash-suffixed Chinese first-tail names as frame-pair candidates", () => {
    const snapshot = normalizeZeroLayerSnapshot({
      ...makeLayerSnapshot("from"),
      layers: [
        ...makeLayerSnapshot("from").layers,
        {
          nodeId: "strict-from",
          parentId: "28:19",
          name: "信息卡片-首帧",
          kind: "group",
          bounds: { x: 20, y: 20, w: 160, h: 40 },
          opacity: 1,
          visible: true
        },
        {
          nodeId: "loose-from",
          parentId: "28:19",
          name: "信息卡片_首帧",
          kind: "group",
          bounds: { x: 20, y: 70, w: 160, h: 40 },
          opacity: 1,
          visible: true
        },
        {
          nodeId: "english-from",
          parentId: "28:19",
          name: "信息卡片-from",
          kind: "group",
          bounds: { x: 20, y: 120, w: 160, h: 40 },
          opacity: 1,
          visible: true
        }
      ]
    });

    const candidates = deriveZeroLayerNodeCandidates(snapshot);

    expect(candidates.find((candidate) => candidate.nodeId === "strict-from")).toMatchObject({
      role: "from",
      baseName: "信息卡片"
    });
    expect(candidates.find((candidate) => candidate.nodeId === "loose-from")?.role).toBeUndefined();
    expect(candidates.find((candidate) => candidate.nodeId === "english-from")?.role).toBeUndefined();
  });

  it("classifies Zero layer roles from names, kinds, and geometry", () => {
    const snapshot = makeLayerSnapshot("from");
    const roles = classifyZeroLayerSnapshotRoles(snapshot);

    expect(roles.find((role) => role.nodeId === "28:19")).toMatchObject({
      role: "root-container",
      confidence: expect.any(Number)
    });
    expect(roles.find((role) => role.nodeId === "bg")).toMatchObject({
      role: "background"
    });
    expect(roles.find((role) => role.nodeId === "pill")).toMatchObject({
      role: "badge"
    });
    expect(roles.find((role) => role.nodeId === "label")).toMatchObject({
      role: "content-text"
    });
  });

  it("builds semantic order plans with containers before content and exits before enters", () => {
    const from = makeDropdownLayerSnapshot("from");
    const to = makeDropdownLayerSnapshot("to");
    const bindingResult = compileZeroLayerMotionBindings(from, to);
    const source = { kind: "zero-layer-morph" as const, from, to, bindingResult };
    const result = applyZeroLayerMotionRecipe(source, "content-stagger");
    const orderPlan = createZeroMotionOrderPlan(source, result.steps, buildZeroMotionSpec(source));
    const firstStructure = Math.min(...orderPlan.groups.structure.map((item) => item.delayMs));
    const firstEnter = Math.min(...orderPlan.groups["enter-content"].map((item) => item.delayMs));

    expect(orderPlan.schemaVersion).toBe("motion-copilot.zero-motion-order-plan.v1");
    expect(orderPlan.groups.foundation.length + orderPlan.groups.structure.length).toBeGreaterThan(0);
    expect(firstStructure).toBeLessThan(firstEnter);
    expect(orderPlan.items.map((item) => item.layerId)).toEqual([
      ...new Set(orderPlan.items.map((item) => item.layerId))
    ]);
  });

  it("adapts recipe parameters by scene axis and applies them without changing tail bounds", () => {
    const from = makeLayerSnapshot("from");
    const to = makeLayerSnapshot("to");
    const bindingResult = compileZeroLayerMotionBindings(from, to);
    const source = { kind: "zero-layer-morph" as const, from, to, bindingResult };
    const spec = buildZeroMotionSpec(source);
    const params = adaptZeroLayerRecipeParameters(spec, "axis-expand");
    const result = applyZeroLayerMotionRecipe(source, "axis-expand", { spec });

    expect(params.maskAxis).toBe("x");
    expect(params.durationMs).toBeGreaterThan(300);
    expect(result.summary).toContain(params.summary);
    const pillBinding = bindingResult.bindings.find((binding) => binding.nodeId === "pill");
    const pillStep = result.steps.find((step) => step.layerId === pillBinding?.layerId);
    expect(pillStep?.animate).toMatchObject({
      x: pillBinding ? pillBinding.toBounds.x - pillBinding.fromBounds.x : expect.any(Number),
      y: pillBinding ? pillBinding.toBounds.y - pillBinding.fromBounds.y : expect.any(Number),
      width: pillBinding?.toBounds.w,
      height: pillBinding?.toBounds.h
    });
  });

  it("adapts recipe parameters for vertical expansion", () => {
    const from = makeLayerSnapshot("from");
    const baseTo = makeLayerSnapshot("to");
    const to = normalizeZeroLayerSnapshot({
      ...baseTo,
      height: 148,
      layers: baseTo.layers.map((layer) =>
        layer.nodeId === baseTo.nodeId || layer.nodeId === "bg"
          ? { ...layer, bounds: { ...layer.bounds, h: 148 } }
          : { ...layer, bounds: { ...layer.bounds, y: layer.bounds.y + 48 } }
      )
    });
    const bindingResult = compileZeroLayerMotionBindings(from, to);
    const spec = buildZeroMotionSpec({ kind: "zero-layer-morph", from, to, bindingResult });
    const params = adaptZeroLayerRecipeParameters(spec, "mask-reveal");

    expect(params.maskAxis).toBe("y");
    expect(params.summary).toContain("Y 轴");
  });

  it("keeps subtle state-change recipe parameters shorter and restrained", () => {
    const from = makeLayerSnapshot("from");
    const to = normalizeZeroLayerSnapshot({
      ...from,
      frameId: "28:2",
      nodeId: "28:2",
      name: "轻状态变化",
      layers: from.layers.map((layer) =>
        layer.nodeId === from.nodeId
          ? { ...layer, nodeId: "28:2", name: "轻状态变化" }
          : { ...layer, parentId: layer.parentId === from.nodeId ? "28:2" : layer.parentId }
      )
    });
    const bindingResult = compileZeroLayerMotionBindings(from, to);
    const spec = buildZeroMotionSpec({ kind: "zero-layer-morph", from, to, bindingResult });
    const params = adaptZeroLayerRecipeParameters(spec, "status-switch");

    expect(params.emphasisLevel).toBe("subtle");
    expect(params.offsetPx).toBeLessThanOrEqual(8);
    expect(params.durationMs).toBeLessThanOrEqual(300);
  });

  it("creates a deterministic harness diagnostic report for Zero native layer morphs", () => {
    const from = makeLayerSnapshot("from");
    const baseTo = makeLayerSnapshot("to");
    const to = normalizeZeroLayerSnapshot({
      ...baseTo,
      layers: [
        ...baseTo.layers,
        {
          nodeId: "tail-only",
          parentId: baseTo.nodeId,
          name: "尾帧专有",
          kind: "rect",
          bounds: { x: 210, y: 20, w: 24, h: 20 },
          opacity: 1,
          visible: true,
          cornerRadius: 8,
          fills: [{ type: "solid", color: "#111111" }]
        }
      ]
    });
    const report = createZeroLayerDiagnosticReport({
      from,
      to,
      source: "fixture",
      bridge: "node scripts/zero-layer-snapshot-fixture.mjs --node-id {nodeId}"
    });

    expect(report.schemaVersion).toBe("motion-copilot.zero-layer-diagnostic.v1");
    expect(report.read).toMatchObject({
      source: "fixture",
      fromLayerCount: from.layers.length,
      toLayerCount: to.layers.length,
      fromNodeId: "28:19",
      toNodeId: "28:2"
    });
    expect(report.matching.matched).toBeGreaterThan(0);
    expect(report.matching.enter).toBeGreaterThan(0);
    expect(report.motion.durationMs).toBe(420);
    expect(report.motion.matched).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "matched",
          durationMs: 360,
          easing: "decelerate"
        })
      ])
    );
    expect(report.styleCapabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ capability: "solid-fill", status: "supported" }),
        expect.objectContaining({ capability: "corner-radius", status: "supported" }),
        expect.objectContaining({ capability: "text-style", status: "supported" })
      ])
    );
  });

  it("turns diagnostic risks into a project quality gate and generation strategy", () => {
    const from = makeLayerSnapshot("from");
    const to = normalizeZeroLayerSnapshot({
      ...makeLayerSnapshot("to"),
      layers: [
        ...makeLayerSnapshot("to").layers,
        {
          nodeId: "tail-vector",
          parentId: "28:2",
          name: "复杂矢量",
          kind: "vector",
          bounds: { x: 200, y: 20, w: 28, h: 28 },
          opacity: 1,
          visible: true,
          fills: [{ type: "solid", color: "#111111" }]
        }
      ]
    });
    const bindingResult = {
      ...compileZeroLayerMotionBindings(from, to),
      unresolved: [
        {
          fromNodeId: "label",
          toNodeId: "tail-vector",
          reason: "low confidence 35"
        }
      ]
    };
    const report = createZeroLayerDiagnosticReport({ from, to, bindingResult });

    expect(report.gate).toMatchObject({
      status: "degraded",
      pass: false,
      strategy: "safe-fade-unmatched"
    });
    expect(report.gate.reasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining("low-confidence"),
        expect.stringContaining("unsupported-style")
      ])
    );
    expect(report.gate.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "DOWNGRADE_LOW_CONFIDENCE_TO_FADE",
          targetNodeIds: expect.arrayContaining(["tail-vector"])
        }),
        expect.objectContaining({
          code: "USE_ASSET_FALLBACK_FOR_VECTOR",
          targetNodeIds: expect.arrayContaining(["tail-vector"])
        })
      ])
    );
  });

  it("uses the harness gate to downgrade low-confidence matched morphs into safe fades", () => {
    const from = makeLayerSnapshot("from");
    const baseTo = makeLayerSnapshot("to");
    const to = normalizeZeroLayerSnapshot({
      ...baseTo,
      layers: baseTo.layers.map((node) =>
        node.nodeId === "pill" ? { ...node, nodeId: "pill-tail", name: "状态胶囊尾帧" } : node
      )
    });
    const fromPill = from.layers.find((node) => node.nodeId === "pill");
    const toPill = to.layers.find((node) => node.nodeId === "pill-tail");
    if (!fromPill || !toPill) throw new Error("expected pill layers");
    const bindingResult = {
      bindings: [
        {
          layerId: "zero-layer-pill",
          nodeId: "pill",
          toNodeId: "pill-tail",
          fromBounds: fromPill.bounds,
          toBounds: toPill.bounds,
          confidence: 58,
          reasons: ["same-kind"]
        }
      ],
      enter: [],
      exit: [],
      unresolved: []
    };
    const report = createZeroLayerDiagnosticReport({ from, to, bindingResult });
    const result = compileZeroLayerMotionComposition({
      from,
      to,
      bindingResult,
      diagnosticReport: report
    });

    expect(report.risks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "MATCH_LOW_CONFIDENCE",
          nodeId: "pill",
          relatedNodeIds: ["pill-tail"]
        })
      ])
    );
    expect(result.bindingResult.bindings).toHaveLength(0);
    expect(result.bindingResult.exit.map((node) => node.nodeId)).toContain("pill");
    expect(result.bindingResult.enter.map((node) => node.nodeId)).toContain("pill-tail");
    expect(result.steps.some((step) => step.id.startsWith("zero-layer-match"))).toBe(false);
    expect(result.steps.some((step) => step.id.startsWith("zero-layer-exit"))).toBe(true);
    expect(result.steps.some((step) => step.id.startsWith("zero-layer-enter"))).toBe(true);
    expect(result.document.visualSource?.kind).toBe("zero-layer-morph");
    if (result.document.visualSource?.kind !== "zero-layer-morph") return;
    expect(result.document.visualSource.optimizerReport).toEqual(
      expect.objectContaining({
        strategy: "safe-fade-unmatched",
        applied: expect.arrayContaining([
          expect.objectContaining({
            code: "DOWNGRADE_LOW_CONFIDENCE_TO_FADE",
            nodeIds: ["pill", "pill-tail"]
          })
        ])
      })
    );
  });

  it("keeps harness optimization when applying Zero native motion recipes", () => {
    const from = makeLayerSnapshot("from");
    const baseTo = makeLayerSnapshot("to");
    const to = normalizeZeroLayerSnapshot({
      ...baseTo,
      layers: baseTo.layers.map((node) =>
        node.nodeId === "pill" ? { ...node, nodeId: "pill-tail", name: "状态胶囊尾帧" } : node
      )
    });
    const fromPill = from.layers.find((node) => node.nodeId === "pill");
    const toPill = to.layers.find((node) => node.nodeId === "pill-tail");
    if (!fromPill || !toPill) throw new Error("expected pill layers");
    const bindingResult = {
      bindings: [
        {
          layerId: "zero-layer-pill",
          nodeId: "pill",
          toNodeId: "pill-tail",
          fromBounds: fromPill.bounds,
          toBounds: toPill.bounds,
          confidence: 58,
          reasons: ["same-kind"]
        }
      ],
      enter: [],
      exit: [],
      unresolved: []
    };
    const diagnosticReport = createZeroLayerDiagnosticReport({ from, to, bindingResult });
    const result = applyZeroLayerMotionRecipe(
      {
        kind: "zero-layer-morph",
        from,
        to,
        bindingResult,
        diagnosticReport
      },
      "smooth-morph"
    );

    expect(result.bindingResult.bindings).toHaveLength(0);
    expect(result.steps.some((step) => step.id.startsWith("zero-layer-match"))).toBe(false);
    expect(result.document.visualSource?.kind).toBe("zero-layer-morph");
    if (result.document.visualSource?.kind !== "zero-layer-morph") return;
    expect(result.document.visualSource.optimizerReport?.applied).toHaveLength(1);
  });

  it("applies deterministic Zero native motion recipes with distinct motion choices", () => {
    const from = makeLayerSnapshot("from");
    const to = makeLayerSnapshot("to");
    const bindingResult = compileZeroLayerMotionBindings(from, to);
    const source = {
      kind: "zero-layer-morph" as const,
      from,
      to,
      bindingResult
    };

    expect(zeroLayerMotionRecipes.map((recipe) => recipe.id)).toEqual([
      "smooth-morph",
      "spring-expand",
      "status-switch",
      "container-first",
      "content-stagger",
      "mask-reveal",
      "dropdown-reveal",
      "anchored-popover",
      "focus-guide",
      "axis-expand",
      "list-reorder",
      "tab-indicator-slide",
      "card-expand-reveal",
      "list-insert-push",
      "bottom-sheet-rise",
      "content-replace"
    ]);
    expect(zeroLayerMotionRecipes.every((recipe) => recipe.category && recipe.summary)).toBe(true);

    const smooth = applyZeroLayerMotionRecipe(source, "smooth-morph");
    const spring = applyZeroLayerMotionRecipe(source, "spring-expand");
    const status = applyZeroLayerMotionRecipe(source, "status-switch");
    const container = applyZeroLayerMotionRecipe(source, "container-first");
    const stagger = applyZeroLayerMotionRecipe(source, "content-stagger");
    const reveal = applyZeroLayerMotionRecipe(source, "mask-reveal");
    const focus = applyZeroLayerMotionRecipe(source, "focus-guide");
    const axis = applyZeroLayerMotionRecipe(source, "axis-expand");
    const list = applyZeroLayerMotionRecipe(source, "list-reorder");
    const tab = applyZeroLayerMotionRecipe(source, "tab-indicator-slide");
    const card = applyZeroLayerMotionRecipe(source, "card-expand-reveal");
    const insert = applyZeroLayerMotionRecipe(source, "list-insert-push");
    const sheet = applyZeroLayerMotionRecipe(source, "bottom-sheet-rise");
    const replace = applyZeroLayerMotionRecipe(source, "content-replace");
    const dropdown = applyZeroLayerMotionRecipe(source, "dropdown-reveal");
    const popover = applyZeroLayerMotionRecipe(source, "anchored-popover");

    expect(smooth.summary).toContain("丝滑形变");
    expect(spring.summary).toContain("弹性展开");
    expect(status.summary).toContain("状态切换");
    expect(container.steps.some((step) => step.label === "容器优先形变")).toBe(true);
    expect(stagger.steps.some((step) => step.label === "内容错峰形变")).toBe(true);
    expect(reveal.steps.some((step) => step.label === "遮罩范围形变")).toBe(true);
    expect(focus.steps.some((step) => step.label === "焦点主对象")).toBe(true);
    expect(axis.steps.some((step) => step.label.includes("轴向展开"))).toBe(true);
    expect(list.steps.some((step) => step.label === "列表顺序重排")).toBe(true);
    expect(tab.steps.some((step) => step.label.includes("指示器"))).toBe(true);
    expect(card.steps.some((step) => step.label.includes("卡片"))).toBe(true);
    expect(insert.steps.some((step) => step.label.includes("列表项"))).toBe(true);
    expect(sheet.steps.some((step) => step.label.includes("面板"))).toBe(true);
    expect(replace.steps.some((step) => step.label.includes("内容替换") || step.label.includes("文案"))).toBe(
      true
    );
    expect(dropdown.summary).toContain("下拉展开");
    expect(popover.steps.some((step) => step.label.includes("锚点"))).toBe(true);
    expect(smooth.steps.every((step) => step.easing?.type === "classic")).toBe(true);
    expect(
      spring.steps
        .filter((step) => step.id.startsWith("zero-layer-match"))
        .every((step) => step.easing?.type === "classic")
    ).toBe(true);
    expect(spring.steps.some((step) => step.label === "弹性主容器" && step.easing?.type === "classic")).toBe(
      true
    );
    expect(status.steps.filter((step) => step.label.includes("文字"))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          initial: expect.objectContaining({ opacity: 0.72 }),
          animate: expect.objectContaining({ opacity: 1 })
        })
      ])
    );
    expect(status.document.visualSource?.kind).toBe("zero-layer-morph");
    expect(status.document.composition?.steps).toHaveLength(status.steps.length);
  });

  it("keeps Zero native recipe manifests complete and safe", () => {
    expect(zeroLayerRecipeManifests.map((manifest) => manifest.id)).toEqual(
      zeroLayerMotionRecipes.map((recipe) => recipe.id)
    );
    expect(validateZeroLayerRecipeManifestRegistry()).toEqual([]);
  });

  it("binds each Zero native recipe manifest to known expression strategies", () => {
    const strategyIds = new Set(zeroLayerExpressionStrategies.map((strategy) => strategy.id));
    for (const manifest of zeroLayerRecipeManifests) {
      expect(manifest.expressionStrategies.length).toBeGreaterThan(0);
      for (const strategyId of manifest.expressionStrategies) {
        expect(strategyIds.has(strategyId)).toBe(true);
      }
    }
  });

  it("exposes a lookup helper for Zero native recipe manifests", () => {
    expect(getZeroLayerRecipeManifest("dropdown-reveal")?.mobileGuidance.expectedFeel).toContain("下拉");
  });

  it("samples Zero native recipes and gates corridor and tail-frame geometry", () => {
    const from = makeLayerSnapshot("from");
    const to = makeLayerSnapshot("to");
    const bindingResult = compileZeroLayerMotionBindings(from, to);
    const report = createZeroLayerRecipeSampleReport({
      kind: "zero-layer-morph",
      from,
      to,
      bindingResult
    });

    expect(report.schemaVersion).toBe("motion-copilot.zero-layer-recipe-samples.v1");
    expect(report.samplePoints).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(report.recipes).toHaveLength(zeroLayerMotionRecipes.length);
    expect(report.comparison.distinctSignatures).toBeGreaterThan(3);
    expect(report.risks.filter((risk) => risk.severity === "error")).toHaveLength(0);
    expect(report.risks.some((risk) => risk.code.startsWith("RECIPE_MANIFEST"))).toBe(false);
    for (const recipe of report.recipes) {
      expect(recipe.adaptedParameters?.summary).toContain("ms");
      expect(recipe.signature.signatureKey).toContain("g");
      expect(recipe.signature.expressionStrategies.length).toBeGreaterThan(0);
      expect(recipe.salienceScore).toBeGreaterThanOrEqual(0);
      expect(recipe.samples).toHaveLength(5);
      expect(recipe.samples.at(-1)?.progress).toBe(1);
    }
  });

  it("recommends visibly different recipes for dropdown reveal scenes", () => {
    const from = makeDropdownLayerSnapshot("from");
    const to = makeDropdownLayerSnapshot("to");
    const bindingResult = compileZeroLayerMotionBindings(from, to);
    const source = { kind: "zero-layer-morph" as const, from, to, bindingResult };
    const spec = buildZeroMotionSpec(source);
    const recommendation = recommendZeroLayerRecipes(spec, { limit: 5 });
    const sampleReport = createZeroLayerRecipeSampleReport(source, {
      recipeIds: recommendation.candidates.slice(0, 5).map((item) => item.recipeId)
    });

    expect(["card-enter", "modal-enter"]).toContain(spec.scene.type);
    expect(classifyZeroMotionInteractionPattern(spec)).toMatchObject({
      type: "dropdown-reveal",
      label: "下拉展开"
    });
    expect(recommendation.interactionPattern.type).toBe("dropdown-reveal");
    expect(recommendation.candidates.map((item) => item.recipeId)).toEqual(
      expect.arrayContaining(["dropdown-reveal", "anchored-popover", "container-first"])
    );
    expect(recommendation.selectedRecipeId).toBe("dropdown-reveal");

    const dropdown = applyZeroLayerMotionRecipe(source, "dropdown-reveal", { spec });
    const container = applyZeroLayerMotionRecipe(source, "container-first", { spec });
    const stagger = applyZeroLayerMotionRecipe(source, "content-stagger", { spec });
    const dropdownHtml = exportCompositionHtml(dropdown.document.composition!, dropdown.document);
    const dropdownEnter = dropdown.steps.filter((step) => step.id.startsWith("zero-layer-enter"));
    const containerEnter = container.steps.filter((step) => step.id.startsWith("zero-layer-enter"));
    const staggerEnter = stagger.steps.filter((step) => step.id.startsWith("zero-layer-enter"));

    expect(dropdownEnter.some((step) => (step.initial?.height ?? 0) < (step.animate?.height ?? 0))).toBe(
      true
    );
    expect(dropdownEnter.some((step) => (step.initial?.y ?? 0) < (step.animate?.y ?? 0))).toBe(true);
    expect(container.summary).not.toContain("下拉展开");
    expect(containerEnter.some((step) => (step.initial?.height ?? 0) < (step.animate?.height ?? 0))).toBe(
      false
    );
    expect(staggerEnter.some((step) => (step.initial?.height ?? 0) < (step.animate?.height ?? 0))).toBe(
      false
    );
    expect(dropdownHtml).toContain("transform-origin:top center");
    expect(new Set(staggerEnter.map((step) => step.delayMs ?? 0)).size).toBeGreaterThan(1);
    expect(sampleReport.comparison.distinctSignatures).toBeGreaterThanOrEqual(3);
    expect(
      sampleReport.recipes.filter((recipe) => recipe.signature.enterTransformCount > 0).length
    ).toBeGreaterThanOrEqual(2);
  });

  it("builds a Zero motion spec and recommends recipes for horizontal expansion", () => {
    const from = makeLayerSnapshot("from");
    const to = makeLayerSnapshot("to");
    const bindingResult = compileZeroLayerMotionBindings(from, to);
    const source = { kind: "zero-layer-morph" as const, from, to, bindingResult };
    const spec = buildZeroMotionSpec(source);
    const recommendation = recommendZeroLayerRecipes(spec);
    const result = applyZeroLayerMotionRecipe(source, recommendation.selectedRecipeId ?? "smooth-morph");
    const salience = evaluateZeroMotionSalience({ spec, steps: result.steps });
    const advice = createZeroMotionRepairAdvice({ spec, recommendation, salience });

    expect(spec.schemaVersion).toBe("motion-copilot.zero-motion-spec.v1");
    expect(spec.scene.type).toBe("horizontal-expand");
    expect(spec.topology.matchedCount).toBeGreaterThan(0);
    expect(spec.deltas.dominantWidthDelta).toBeGreaterThan(0);
    expect(recommendation.candidates.map((item) => item.recipeId)).toEqual(
      expect.arrayContaining(["container-first", "axis-expand", "content-stagger"])
    );
    expect(recommendation.selectedRecipeId).toBe("container-first");
    expect(recommendation.candidates[0]?.reasons.join(" ")).toContain("适合");
    expect(recommendation.candidates[0]?.warnings).toEqual(expect.any(Array));
    expect(salience.schemaVersion).toBe("motion-copilot.zero-motion-salience.v1");
    expect(salience.score).toBeGreaterThan(0);
    expect(advice.actions.length).toBeGreaterThan(0);
  });

  it("classifies vertical expansion and list reorder scenes from Zero layer topology", () => {
    const from = makeLayerSnapshot("from");
    const verticalTo = normalizeZeroLayerSnapshot({
      ...makeLayerSnapshot("to"),
      height: 180,
      layers: makeLayerSnapshot("to").layers.map((layer) =>
        layer.nodeId === "28:2" || layer.nodeId === "bg"
          ? { ...layer, bounds: { ...layer.bounds, h: 180 } }
          : layer.nodeId === "pill"
            ? { ...layer, bounds: { ...layer.bounds, y: 92 } }
            : layer.nodeId === "label"
              ? { ...layer, bounds: { ...layer.bounds, y: 98 } }
              : layer
      )
    });
    const verticalSource = {
      kind: "zero-layer-morph" as const,
      from,
      to: verticalTo,
      bindingResult: compileZeroLayerMotionBindings(from, verticalTo)
    };
    const verticalSpec = buildZeroMotionSpec(verticalSource);
    expect(verticalSpec.scene.type).toBe("vertical-expand");
    expect(recommendZeroLayerRecipes(verticalSpec).candidates.map((item) => item.recipeId)).toEqual(
      expect.arrayContaining(["axis-expand", "container-first"])
    );

    const listFrom = normalizeZeroLayerSnapshot({
      ...from,
      layers: [
        ...from.layers,
        ...[0, 1, 2, 3].map((index) => ({
          nodeId: `item-${index}`,
          parentId: from.nodeId,
          name: `列表项 ${index}`,
          kind: "rect" as const,
          bounds: { x: 12, y: 92 + index * 28, w: 120, h: 20 },
          opacity: 1,
          visible: true,
          cornerRadius: 6,
          fills: [{ type: "solid" as const, color: "#eeeeee" }]
        }))
      ]
    });
    const listTo = normalizeZeroLayerSnapshot({
      ...listFrom,
      frameId: "list-to",
      nodeId: "list-to",
      name: "列表重排态",
      layers: listFrom.layers.map((layer) =>
        layer.nodeId.startsWith("item-")
          ? { ...layer, parentId: "list-to", bounds: { ...layer.bounds, y: layer.bounds.y + 20 } }
          : layer.nodeId === listFrom.nodeId
            ? { ...layer, nodeId: "list-to", name: "列表重排态" }
            : { ...layer, parentId: layer.parentId === listFrom.nodeId ? "list-to" : layer.parentId }
      )
    });
    const listSource = {
      kind: "zero-layer-morph" as const,
      from: listFrom,
      to: listTo,
      bindingResult: compileZeroLayerMotionBindings(listFrom, listTo)
    };
    const listSpec = buildZeroMotionSpec(listSource);
    expect(listSpec.scene.type).toBe("list-reorder");
    expect(recommendZeroLayerRecipes(listSpec).selectedRecipeId).toBe("list-insert-push");
  });

  it("classifies tab switching and card entering scenes from Zero layer topology", () => {
    const from = makeLayerSnapshot("from");
    const tabTo = normalizeZeroLayerSnapshot({
      ...from,
      frameId: "tab-to",
      nodeId: "tab-to",
      name: "Tab 切换态",
      layers: from.layers.map((layer) =>
        layer.nodeId === from.nodeId
          ? { ...layer, nodeId: "tab-to", name: "Tab 切换态" }
          : layer.nodeId === "label"
            ? { ...layer, parentId: "tab-to", text: "已完成", bounds: { ...layer.bounds, w: 48 } }
            : { ...layer, parentId: layer.parentId === from.nodeId ? "tab-to" : layer.parentId }
      )
    });
    const tabSource = {
      kind: "zero-layer-morph" as const,
      from,
      to: tabTo,
      bindingResult: compileZeroLayerMotionBindings(from, tabTo)
    };
    const tabSpec = buildZeroMotionSpec(tabSource);
    expect(tabSpec.scene.type).toBe("tab-switch");
    expect(recommendZeroLayerRecipes(tabSpec).candidates.map((item) => item.recipeId)).toEqual(
      expect.arrayContaining(["content-replace", "tab-indicator-slide", "content-stagger"])
    );

    const cardTo = normalizeZeroLayerSnapshot({
      ...from,
      frameId: "card-to",
      nodeId: "card-to",
      name: "卡片入场态",
      width: 260,
      height: 180,
      layers: [
        ...from.layers.map((layer) =>
          layer.nodeId === from.nodeId
            ? { ...layer, nodeId: "card-to", name: "卡片入场态", bounds: { ...layer.bounds, w: 260, h: 180 } }
            : { ...layer, parentId: layer.parentId === from.nodeId ? "card-to" : layer.parentId }
        ),
        {
          nodeId: "card-panel",
          parentId: "card-to",
          name: "新增卡片",
          kind: "rect",
          bounds: { x: 12, y: 82, w: 220, h: 86 },
          opacity: 1,
          visible: true,
          cornerRadius: 12,
          fills: [{ type: "solid", color: "#ffffff" }]
        }
      ]
    });
    const cardSource = {
      kind: "zero-layer-morph" as const,
      from,
      to: cardTo,
      bindingResult: {
        ...compileZeroLayerMotionBindings(from, cardTo),
        enter: cardTo.layers.filter((layer) => layer.nodeId === "card-panel")
      }
    };
    const cardSpec = buildZeroMotionSpec(cardSource);
    expect(["card-enter", "modal-enter"]).toContain(cardSpec.scene.type);
    expect(recommendZeroLayerRecipes(cardSpec).candidates.map((item) => item.recipeId)).toEqual(
      expect.arrayContaining(["card-expand-reveal", "mask-reveal"])
    );
  });

  it("explains subtle motion and low-confidence matching with repair advice", () => {
    const from = makeLayerSnapshot("from");
    const to = normalizeZeroLayerSnapshot({
      ...from,
      frameId: "subtle-to",
      nodeId: "subtle-to",
      name: "轻微变化",
      layers: from.layers.map((layer) =>
        layer.nodeId === from.nodeId
          ? { ...layer, nodeId: "subtle-to", name: "轻微变化" }
          : { ...layer, parentId: layer.parentId === from.nodeId ? "subtle-to" : layer.parentId }
      )
    });
    const pill = from.layers.find((layer) => layer.nodeId === "pill");
    if (!pill) throw new Error("expected pill");
    const bindingResult = {
      bindings: [
        {
          layerId: "zero-layer-pill",
          nodeId: "pill",
          toNodeId: "pill",
          fromBounds: pill.bounds,
          toBounds: pill.bounds,
          confidence: 52,
          reasons: ["same-kind"]
        }
      ],
      enter: [],
      exit: [],
      unresolved: [{ fromNodeId: "label", toNodeId: "label", reason: "low confidence 52" }]
    };
    const diagnosticReport = createZeroLayerDiagnosticReport({ from, to, bindingResult });
    const source = { kind: "zero-layer-morph" as const, from, to, bindingResult, diagnosticReport };
    const spec = buildZeroMotionSpec(source);
    const recommendation = recommendZeroLayerRecipes(spec);
    const salience = evaluateZeroMotionSalience({ spec, steps: [] });
    const advice = createZeroMotionRepairAdvice({ spec, recommendation, salience, diagnosticReport });

    expect(spec.risks).toEqual(expect.arrayContaining(["low-confidence-match", "under-motion"]));
    expect(recommendation.selectedRecipeId).toBe("smooth-morph");
    expect(salience.diagnosis).toBe("too-subtle");
    expect(advice.failures).toEqual(expect.arrayContaining(["under-motion", "low-confidence-match"]));
    expect(advice.actions.map((action) => action.type)).toEqual(
      expect.arrayContaining(["increase-salience", "confirm-binding"])
    );
    expect(advice.userFacingMessage.length).toBeGreaterThan(0);
  });

  it("warns when recipe sampling finds indistinguishable recipes", () => {
    const from = makeLayerSnapshot("from");
    const to = makeLayerSnapshot("to");
    const bindingResult = compileZeroLayerMotionBindings(from, to);
    const report = createZeroLayerRecipeSampleReport(
      {
        kind: "zero-layer-morph",
        from,
        to,
        bindingResult
      },
      { recipeIds: ["smooth-morph", "smooth-morph"] }
    );

    expect(report.risks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "RECIPE_DIFF_TOO_SMALL",
          severity: "warning"
        })
      ])
    );
  });

  it("samples expression strategy curves when comparing the expanded Zero recipe library", () => {
    const from = normalizeZeroLayerSnapshot(
      JSON.parse(
        execFileSync(
          process.execPath,
          [rootPath("scripts/zero-layer-snapshot-fixture.mjs"), "--node-id", "28:19"],
          {
            encoding: "utf8"
          }
        )
      )
    );
    const to = normalizeZeroLayerSnapshot(
      JSON.parse(
        execFileSync(
          process.execPath,
          [rootPath("scripts/zero-layer-snapshot-fixture.mjs"), "--node-id", "28:2"],
          {
            encoding: "utf8"
          }
        )
      )
    );
    const bindingResult = compileZeroLayerMotionBindings(from, to);
    const report = createZeroLayerRecipeSampleReport({
      kind: "zero-layer-morph",
      from,
      to,
      bindingResult
    });

    expect(report.comparison.distinctSignatures).toBe(report.comparison.recipeCount);
    expect(report.risks.some((risk) => risk.code === "RECIPE_DIFF_TOO_SMALL")).toBe(false);
  }, 15_000);

  it("keeps every Zero native recipe locked to the exact Zero tail frame", () => {
    const from = normalizeZeroLayerSnapshot(
      JSON.parse(
        execFileSync(
          process.execPath,
          [rootPath("scripts/zero-layer-snapshot-fixture.mjs"), "--node-id", "28:19"],
          {
            encoding: "utf8"
          }
        )
      )
    );
    const to = normalizeZeroLayerSnapshot(
      JSON.parse(
        execFileSync(
          process.execPath,
          [rootPath("scripts/zero-layer-snapshot-fixture.mjs"), "--node-id", "28:2"],
          {
            encoding: "utf8"
          }
        )
      )
    );
    const bindingResult = compileZeroLayerMotionBindings(from, to);
    const source = { kind: "zero-layer-morph" as const, from, to, bindingResult };

    for (const recipe of zeroLayerMotionRecipes) {
      const result = applyZeroLayerMotionRecipe(source, recipe.id);
      for (const binding of bindingResult.bindings) {
        const step = result.steps.find((item) => item.layerId === binding.layerId);
        expect(step?.animate).toMatchObject({
          x: binding.toBounds.x - binding.fromBounds.x,
          y: binding.toBounds.y - binding.fromBounds.y,
          width: binding.toBounds.w,
          height: binding.toBounds.h,
          scale: 1,
          opacity: to.layers.find((node) => node.nodeId === binding.toNodeId)?.opacity ?? 1,
          rotate: 0
        });
      }
    }
  }, 15_000);

  it("keeps matched layout motion inside the Zero first-to-tail spatial corridor", () => {
    const from = normalizeZeroLayerSnapshot(
      JSON.parse(
        execFileSync(
          process.execPath,
          [rootPath("scripts/zero-layer-snapshot-fixture.mjs"), "--node-id", "28:19"],
          {
            encoding: "utf8"
          }
        )
      )
    );
    const to = normalizeZeroLayerSnapshot(
      JSON.parse(
        execFileSync(
          process.execPath,
          [rootPath("scripts/zero-layer-snapshot-fixture.mjs"), "--node-id", "28:2"],
          {
            encoding: "utf8"
          }
        )
      )
    );
    const bindingResult = compileZeroLayerMotionBindings(from, to);
    const source = { kind: "zero-layer-morph" as const, from, to, bindingResult };

    for (const recipe of zeroLayerMotionRecipes) {
      const result = applyZeroLayerMotionRecipe(source, recipe.id);
      for (const binding of bindingResult.bindings) {
        const step = result.steps.find((item) => item.layerId === binding.layerId);
        if (!step) throw new Error(`missing step for ${binding.layerId}`);
        const minX = Math.min(0, binding.toBounds.x - binding.fromBounds.x);
        const maxX = Math.max(0, binding.toBounds.x - binding.fromBounds.x);
        const minY = Math.min(0, binding.toBounds.y - binding.fromBounds.y);
        const maxY = Math.max(0, binding.toBounds.y - binding.fromBounds.y);
        const minWidth = Math.min(binding.fromBounds.w, binding.toBounds.w);
        const maxWidth = Math.max(binding.fromBounds.w, binding.toBounds.w);
        const minHeight = Math.min(binding.fromBounds.h, binding.toBounds.h);
        const maxHeight = Math.max(binding.fromBounds.h, binding.toBounds.h);

        expect(step.initial?.x ?? 0).toBeGreaterThanOrEqual(minX);
        expect(step.initial?.x ?? 0).toBeLessThanOrEqual(maxX);
        expect(step.animate?.x ?? 0).toBeGreaterThanOrEqual(minX);
        expect(step.animate?.x ?? 0).toBeLessThanOrEqual(maxX);
        expect(step.initial?.y ?? 0).toBeGreaterThanOrEqual(minY);
        expect(step.initial?.y ?? 0).toBeLessThanOrEqual(maxY);
        expect(step.animate?.y ?? 0).toBeGreaterThanOrEqual(minY);
        expect(step.animate?.y ?? 0).toBeLessThanOrEqual(maxY);
        expect(step.initial?.width ?? binding.fromBounds.w).toBeGreaterThanOrEqual(minWidth);
        expect(step.initial?.width ?? binding.fromBounds.w).toBeLessThanOrEqual(maxWidth);
        expect(step.animate?.width ?? binding.toBounds.w).toBeGreaterThanOrEqual(minWidth);
        expect(step.animate?.width ?? binding.toBounds.w).toBeLessThanOrEqual(maxWidth);
        expect(step.initial?.height ?? binding.fromBounds.h).toBeGreaterThanOrEqual(minHeight);
        expect(step.initial?.height ?? binding.fromBounds.h).toBeLessThanOrEqual(maxHeight);
        expect(step.animate?.height ?? binding.toBounds.h).toBeGreaterThanOrEqual(minHeight);
        expect(step.animate?.height ?? binding.toBounds.h).toBeLessThanOrEqual(maxHeight);
        expect(step.initial?.scale ?? 1).toBe(1);
        expect(step.animate?.scale ?? 1).toBe(1);
        expect(step.easing?.type).toBe("classic");
      }
    }
  }, 15_000);

  it("exports recipe-specific Zero native motion instead of collapsing recipes to the same morph", () => {
    const from = normalizeZeroLayerSnapshot(
      JSON.parse(
        execFileSync(
          process.execPath,
          [rootPath("scripts/zero-layer-snapshot-fixture.mjs"), "--node-id", "28:19"],
          {
            encoding: "utf8"
          }
        )
      )
    );
    const to = normalizeZeroLayerSnapshot(
      JSON.parse(
        execFileSync(
          process.execPath,
          [rootPath("scripts/zero-layer-snapshot-fixture.mjs"), "--node-id", "28:2"],
          {
            encoding: "utf8"
          }
        )
      )
    );
    const bindingResult = compileZeroLayerMotionBindings(from, to);
    const source = { kind: "zero-layer-morph" as const, from, to, bindingResult };

    const spring = applyZeroLayerMotionRecipe(source, "spring-expand");
    const status = applyZeroLayerMotionRecipe(source, "status-switch");
    const container = applyZeroLayerMotionRecipe(source, "container-first");
    const replace = applyZeroLayerMotionRecipe(source, "content-replace");
    const springHtml = exportCompositionHtml(spring.document.composition!, spring.document);
    const statusHtml = exportCompositionHtml(status.document.composition!, status.document);
    const containerHtml = exportCompositionHtml(container.document.composition!, container.document);
    const replaceHtml = exportCompositionHtml(replace.document.composition!, replace.document);

    expect(springHtml).not.toMatch(/mc-zero-layer-match-[\\s\\S]*scale\\(0\\.96\\)/);
    expect(springHtml).toContain("420ms");
    expect(statusHtml).toContain("opacity:0.72");
    expect(statusHtml).toContain("translate(0px,0px) scale(1)");
    expect(statusHtml).not.toContain(
      '.mc-zero-layer-to [data-zero-layer-id="28:12"]{display:none!important;}'
    );
    expect(statusHtml).toContain("@keyframes mc-zero-layer-tail-5-28-12");
    expect(springHtml).not.toBe(statusHtml);
    expect(containerHtml).toContain("58%");
    expect(replaceHtml).toContain("42%");
    expect(replaceHtml).toContain("74%");
    expect(containerHtml).not.toBe(replaceHtml);
  }, 15_000);

  it("exposes a reusable Zero layer expression strategy library", () => {
    expect(zeroLayerExpressionStrategies.map((strategy) => strategy.id)).toEqual(
      expect.arrayContaining([
        "staged-container",
        "clip-reveal-x",
        "clip-reveal-y",
        "content-cross-replace",
        "list-push-insert",
        "indicator-slide",
        "sheet-rise-contained",
        "emphasis-pulse-contained"
      ])
    );
    expect(zeroLayerExpressionStrategies.every((strategy) => strategy.label && strategy.summary)).toBe(true);
  });

  it("exports expanded expression strategies as distinct keyframe programs", () => {
    const from = normalizeZeroLayerSnapshot(
      JSON.parse(
        execFileSync(
          process.execPath,
          [rootPath("scripts/zero-layer-snapshot-fixture.mjs"), "--node-id", "28:19"],
          {
            encoding: "utf8"
          }
        )
      )
    );
    const to = normalizeZeroLayerSnapshot(
      JSON.parse(
        execFileSync(
          process.execPath,
          [rootPath("scripts/zero-layer-snapshot-fixture.mjs"), "--node-id", "28:2"],
          {
            encoding: "utf8"
          }
        )
      )
    );
    const bindingResult = compileZeroLayerMotionBindings(from, to);
    const source = { kind: "zero-layer-morph" as const, from, to, bindingResult };

    const cardHtml = exportCompositionHtml(
      applyZeroLayerMotionRecipe(source, "card-expand-reveal").document.composition!,
      applyZeroLayerMotionRecipe(source, "card-expand-reveal").document
    );
    const listHtml = exportCompositionHtml(
      applyZeroLayerMotionRecipe(source, "list-insert-push").document.composition!,
      applyZeroLayerMotionRecipe(source, "list-insert-push").document
    );
    const sheetHtml = exportCompositionHtml(
      applyZeroLayerMotionRecipe(source, "bottom-sheet-rise").document.composition!,
      applyZeroLayerMotionRecipe(source, "bottom-sheet-rise").document
    );
    const replaceHtml = exportCompositionHtml(
      applyZeroLayerMotionRecipe(source, "content-replace").document.composition!,
      applyZeroLayerMotionRecipe(source, "content-replace").document
    );

    expect(cardHtml).toContain("zero-layer-expression:clip-reveal");
    expect(listHtml).toContain("zero-layer-expression:list-push-insert");
    expect(sheetHtml).toContain("zero-layer-expression:sheet-rise-contained");
    expect(replaceHtml).toContain("zero-layer-expression:content-cross-replace");
    expect(new Set([cardHtml, listHtml, sheetHtml, replaceHtml]).size).toBe(4);
  }, 15_000);

  it("attaches explicit expression strategy metadata to Zero native recipe steps", () => {
    const from = makeLayerSnapshot("from");
    const to = makeLayerSnapshot("to");
    const bindingResult = compileZeroLayerMotionBindings(from, to);
    const source = { kind: "zero-layer-morph" as const, from, to, bindingResult };
    const card = applyZeroLayerMotionRecipe(source, "card-expand-reveal");
    const list = applyZeroLayerMotionRecipe(source, "list-insert-push");

    const cardStrategies = new Set(card.steps.map((step) => zeroLayerExpressionStrategyForStep(step).id));
    const listStrategies = new Set(list.steps.map((step) => zeroLayerExpressionStrategyForStep(step).id));
    const cardMetadata = card.steps
      .map((step) => (step as typeof step & { metadata?: { zeroLayerExpressionStrategy?: string } }).metadata)
      .filter(Boolean);

    expect(cardStrategies).toContain("clip-reveal-x");
    expect(listStrategies).toContain("list-push-insert");
    expect(cardMetadata.some((metadata) => metadata?.zeroLayerExpressionStrategy === "clip-reveal-x")).toBe(
      true
    );
  });

  it("exposes a broader Zero native expression strategy library with distinct curves", () => {
    const ids = zeroLayerExpressionStrategies.map((strategy) => strategy.id);
    const curveSignatures = new Set(
      zeroLayerExpressionStrategies.map((strategy) =>
        strategy.stops.map((stop) => `${stop.percent}:${stop.progress}:${stop.opacity ?? ""}`).join("|")
      )
    );

    expect(ids).toEqual(
      expect.arrayContaining([
        "spring-settle-contained",
        "status-snap-replace",
        "mask-scan-reveal",
        "dropdown-accordion-y",
        "anchor-pop-contained",
        "focus-shift-contained",
        "list-reorder-cascade",
        "horizontal-stretch-reveal",
        "vertical-stack-reveal",
        "container-hold-content-rise",
        "content-exit-replace",
        "list-displace-push",
        "focus-snap-shift",
        "sheet-dock-rise",
        "anchor-scale-pop",
        "subtle-snap",
        "strong-reveal"
      ])
    );
    expect(zeroLayerExpressionStrategies.length).toBeGreaterThanOrEqual(28);
    expect(curveSignatures.size).toBe(zeroLayerExpressionStrategies.length);
  });

  it("uses manifest runtime traits when adapting Zero native recipe execution", () => {
    const from = makeDropdownLayerSnapshot("from");
    const to = makeDropdownLayerSnapshot("to");
    const bindingResult = compileZeroLayerMotionBindings(from, to);
    const source = { kind: "zero-layer-morph" as const, from, to, bindingResult };
    const spec = buildZeroMotionSpec(source);
    const sheet = applyZeroLayerMotionRecipe(source, "bottom-sheet-rise", { spec });
    const status = applyZeroLayerMotionRecipe(source, "status-switch", { spec });
    const sheetStrategies = new Set(sheet.steps.map((step) => zeroLayerExpressionStrategyForStep(step).id));
    const statusStrategies = new Set(status.steps.map((step) => zeroLayerExpressionStrategyForStep(step).id));
    const sheetEnter = sheet.steps.find((step) => step.id.startsWith("zero-layer-enter"));
    const statusEnter = status.steps.find((step) => step.id.startsWith("zero-layer-enter"));

    expect(sheetStrategies).toContain("sheet-dock-rise");
    expect(statusStrategies).toContain("subtle-snap");
    expect((sheetEnter?.initial?.y ?? 0) - (sheetEnter?.animate?.y ?? 0)).toBeGreaterThanOrEqual(0);
    expect(statusEnter?.initial?.scale ?? 1).toBeGreaterThanOrEqual(0.985);
  });

  it("wires expanded expression strategies to visibly different Zero native recipes", () => {
    const from = makeLayerSnapshot("from");
    const to = makeLayerSnapshot("to");
    const bindingResult = compileZeroLayerMotionBindings(from, to);
    const source = { kind: "zero-layer-morph" as const, from, to, bindingResult };
    const recipeStrategies = Object.fromEntries(
      [
        "spring-expand",
        "status-switch",
        "mask-reveal",
        "dropdown-reveal",
        "anchored-popover",
        "focus-guide",
        "list-reorder"
      ].map((recipeId) => [
        recipeId,
        new Set(
          applyZeroLayerMotionRecipe(
            source,
            recipeId as Parameters<typeof applyZeroLayerMotionRecipe>[1]
          ).steps.map((step) => zeroLayerExpressionStrategyForStep(step).id)
        )
      ])
    );

    expect(recipeStrategies["spring-expand"]).toContain("spring-settle-contained");
    expect(recipeStrategies["status-switch"]).toContain("status-snap-replace");
    expect(recipeStrategies["mask-reveal"]).toContain("mask-scan-reveal");
    expect(recipeStrategies["dropdown-reveal"]).toContain("dropdown-accordion-y");
    expect(recipeStrategies["anchored-popover"]).toContain("anchor-pop-contained");
    expect(recipeStrategies["focus-guide"]).toContain("focus-shift-contained");
    expect(recipeStrategies["list-reorder"]).toContain("list-reorder-cascade");
  });

  it("flags parent exit layers that can cover matched child layers", () => {
    const from = normalizeZeroLayerSnapshot({
      schemaVersion: "motion-copilot.zero-layer-snapshot.v1",
      frameId: "33:36",
      nodeId: "33:36",
      name: "首帧",
      width: 220,
      height: 44,
      screenshotUrl: "data:image/png;base64,FROM",
      assets: [],
      layers: [
        {
          nodeId: "33:36",
          name: "首帧",
          kind: "group",
          bounds: { x: 0, y: 0, w: 220, h: 44 },
          opacity: 1,
          visible: true,
          children: ["33:24"]
        },
        {
          nodeId: "33:24",
          parentId: "33:36",
          name: "Tabs 标签页- 初始状态",
          kind: "frame",
          bounds: { x: 0, y: 0, w: 220, h: 44 },
          opacity: 1,
          visible: true,
          fills: [{ type: "solid", color: "#ffffff" }],
          children: ["33:27"]
        },
        {
          nodeId: "33:27",
          parentId: "33:24",
          name: "text",
          kind: "text",
          bounds: { x: 24, y: 11, w: 70, h: 22 },
          opacity: 1,
          visible: true,
          text: "业务流程图",
          fills: [{ type: "solid", color: "#11141a" }],
          textStyle: { fontSize: 14, lineHeight: 22 }
        }
      ]
    });
    const to = normalizeZeroLayerSnapshot({
      ...from,
      frameId: "33:35",
      nodeId: "33:35",
      name: "尾帧",
      height: 140,
      screenshotUrl: "data:image/png;base64,TO",
      layers: [
        { ...from.layers[0]!, nodeId: "33:35", name: "尾帧", bounds: { x: 0, y: 0, w: 220, h: 140 } },
        { ...from.layers[2]!, nodeId: "33:16", parentId: "33:35" }
      ]
    });
    const bindingResult = {
      bindings: [
        {
          layerId: "zero-layer-33-36",
          nodeId: "33:36",
          toNodeId: "33:35",
          fromBounds: from.layers[0]!.bounds,
          toBounds: to.layers[0]!.bounds,
          confidence: 100,
          reasons: ["root-frame"]
        },
        {
          layerId: "zero-layer-33-27",
          nodeId: "33:27",
          toNodeId: "33:16",
          fromBounds: from.layers[2]!.bounds,
          toBounds: to.layers[1]!.bounds,
          confidence: 94,
          reasons: ["same-text"]
        }
      ],
      enter: [],
      exit: [from.layers[1]!],
      unresolved: []
    };

    const report = createZeroLayerDiagnosticReport({ from, to, bindingResult });

    expect(report.risks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "LAYER_ORDER_OCCLUSION",
          severity: "warning",
          nodeId: "33:24"
        })
      ])
    );
    expect(report.recommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "ADJUST_EXIT_LAYER_ORDER"
        })
      ])
    );
  });

  it("prints complete ZeroLayerSnapshot fixtures from the local bridge command", () => {
    const script = rootPath("scripts/zero-layer-snapshot-fixture.mjs");
    const expanded = normalizeZeroLayerSnapshot(
      JSON.parse(execFileSync(process.execPath, [script, "--node-id", "28:2"], { encoding: "utf8" }))
    );

    expect(expanded.layers.find((layer) => layer.nodeId === "28:12")).toMatchObject({
      name: "状态胶囊",
      cornerRadius: 999,
      fills: [{ type: "solid", color: "#f3f3f3" }]
    });
    expect(expanded.layers.find((layer) => layer.nodeId === "28:7")).toMatchObject({
      name: "组件背景",
      cornerRadius: 8
    });
  }, 15_000);

  it("runs the Zero layer diagnostic harness command against fixtures", () => {
    const script = rootPath("scripts/zero-layer-diagnose.mjs");
    const output = execFileSync(process.execPath, [script, "--fixture", "--from", "28:19", "--to", "28:2"], {
      encoding: "utf8"
    });
    const report = JSON.parse(output) as {
      schemaVersion: string;
      read: { source: string; fromLayerCount: number; toLayerCount: number };
      matching: { matched: number; enter: number };
      motion: { durationMs: number };
    };

    expect(report.schemaVersion).toBe("motion-copilot.zero-layer-diagnostic.v1");
    expect(report.read).toMatchObject({
      source: "fixture",
      fromLayerCount: 7,
      toLayerCount: 9
    });
    expect(report.matching.matched).toBeGreaterThan(0);
    expect(report.matching.enter).toBeGreaterThan(0);
    expect(report.motion.durationMs).toBeGreaterThanOrEqual(360);

    expect(() =>
      execFileSync(
        process.execPath,
        [script, "--fixture", "--from", "28:19", "--to", "28:2", "--fail-on", "warning"],
        {
          encoding: "utf8",
          stdio: "pipe"
        }
      )
    ).toThrow();
  }, 15_000);

  it("prints Zero motion spec, recommendations, salience, and repair advice from the CLI", () => {
    const script = rootPath("scripts/zero-layer-diagnose.mjs");
    const output = execFileSync(
      process.execPath,
      [
        script,
        "--fixture",
        "--from",
        "28:19",
        "--to",
        "28:2",
        "--emit-spec",
        "--recommend-recipes",
        "--emit-salience",
        "--emit-repair-advice"
      ],
      { encoding: "utf8" }
    );
    const payload = JSON.parse(output) as {
      diagnosticReport: { schemaVersion: string };
      spec: { schemaVersion: string; scene: { type: string } };
      recommendation: { selectedRecipeId?: string; candidates: Array<{ recipeId: string }> };
      salience: { schemaVersion: string; diagnosis: string };
      repairAdvice: { schemaVersion: string; actions: unknown[] };
    };

    expect(payload.diagnosticReport.schemaVersion).toBe("motion-copilot.zero-layer-diagnostic.v1");
    expect(payload.spec.schemaVersion).toBe("motion-copilot.zero-motion-spec.v1");
    expect(payload.spec.scene.type).toBe("horizontal-expand");
    expect(payload.recommendation.selectedRecipeId).toBe("container-first");
    expect(payload.recommendation.candidates.map((item) => item.recipeId)).toEqual(
      expect.arrayContaining(["container-first", "axis-expand", "card-expand-reveal"])
    );
    expect(payload.salience.schemaVersion).toBe("motion-copilot.zero-motion-salience.v1");
    expect(payload.repairAdvice.schemaVersion).toBe("motion-copilot.zero-motion-repair-advice.v1");
    expect(payload.repairAdvice.actions.length).toBeGreaterThan(0);
  }, 15_000);

  it("prints expression strategies in the human-readable Zero motion harness report", () => {
    const script = rootPath("scripts/zero-layer-diagnose.mjs");
    const output = execFileSync(
      process.execPath,
      [
        script,
        "--fixture",
        "--from",
        "28:19",
        "--to",
        "28:2",
        "--emit-spec",
        "--recommend-recipes",
        "--pretty"
      ],
      { encoding: "utf8" }
    );

    expect(output).toContain("Expression Strategies:");
    expect(output).toContain("staged-container");
  }, 15_000);

  it("runs the Zero layer recipe sampling harness command against fixtures", () => {
    const script = rootPath("scripts/zero-layer-diagnose.mjs");
    const output = execFileSync(
      process.execPath,
      [
        script,
        "--fixture",
        "--from",
        "28:19",
        "--to",
        "28:2",
        "--recipe-samples",
        "--recipe",
        "smooth-morph"
      ],
      { encoding: "utf8" }
    );
    const report = JSON.parse(output) as {
      schemaVersion: string;
      comparison: { recipeCount: number; distinctSignatures: number };
      recipes: Array<{ recipeId: string; samples: unknown[] }>;
    };

    expect(report.schemaVersion).toBe("motion-copilot.zero-layer-recipe-samples.v1");
    expect(report.comparison).toMatchObject({ recipeCount: 1, distinctSignatures: 1 });
    expect(report.recipes[0]).toMatchObject({ recipeId: "smooth-morph" });
    expect(report.recipes[0]?.samples).toHaveLength(5);

    expect(() =>
      execFileSync(
        process.execPath,
        [
          script,
          "--fixture",
          "--from",
          "28:19",
          "--to",
          "28:2",
          "--recipe-samples",
          "--recipe",
          "smooth-morph,smooth-morph",
          "--fail-on",
          "recipe-diff"
        ],
        {
          encoding: "utf8",
          stdio: "pipe"
        }
      )
    ).toThrow();
  }, 20_000);

  it("prints the Zero layer quality gate in the human-readable diagnostic report", () => {
    const script = rootPath("scripts/zero-layer-diagnose.mjs");
    const output = execFileSync(
      process.execPath,
      [script, "--fixture", "--from", "28:19", "--to", "28:2", "--pretty"],
      {
        encoding: "utf8"
      }
    );

    expect(output).toContain("Quality Gate:");
    expect(output).toContain("status=degraded");
    expect(output).toContain("strategy=safe-fade-unmatched");
    expect(output).toContain("DOWNGRADE_LOW_CONFIDENCE_TO_FADE");
  }, 15_000);

  it("verifies exported Zero layer HTML through the visual screenshot gate", () => {
    const tempDir = mkdtempSync(resolve(tmpdir(), "zero-layer-visual-gate-"));
    try {
      const htmlPath = resolve(tempDir, "zero-layer.html");
      const expectedImage = `data:image/svg+xml,${encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="#fff"/></svg>'
      )}`;
      writeFileSync(
        htmlPath,
        `<!doctype html><html><body><main class="mc-zero-layer-stage" style="width:1px;height:1px;background:#fff"></main></body></html>`
      );

      const output = execFileSync(
        process.execPath,
        [
          rootPath("scripts/verify-zero-visual-export.mjs"),
          "--html",
          htmlPath,
          "--from",
          expectedImage,
          "--to",
          expectedImage,
          "--width",
          "1",
          "--height",
          "1"
        ],
        { encoding: "utf8" }
      );
      const result = JSON.parse(output) as { passed: boolean; stage: { width: number; height: number } };

      expect(result.passed).toBe(true);
      expect(result.stage).toEqual({ width: 1, height: 1 });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }, 30_000);

  it("collects Zero MCP layer snapshots through the external use_design_script bridge", () => {
    const tempDir = mkdtempSync(resolve(tmpdir(), "zero-mcp-layer-bridge-"));
    try {
      const toolScript = resolve(tempDir, "tool.mjs");
      writeFileSync(
        toolScript,
        `const tool = process.argv[2];
const nodeId = process.argv[4];
if (tool === "use_design_script") {
  process.stdout.write(JSON.stringify({
    schemaVersion: "motion-copilot.zero-layer-snapshot.v1",
    frameId: nodeId,
    nodeId,
    name: "外部图层",
    width: 120,
    height: 48,
    screenshotUrl: "",
    assets: [],
    layers: [
      { nodeId, name: "外部图层", kind: "frame", bounds: { x: 0, y: 0, w: 120, h: 48 }, opacity: 1, visible: true },
      { nodeId: "bg", parentId: nodeId, name: "组件背景", kind: "rect", bounds: { x: 0, y: 0, w: 120, h: 48 }, opacity: 0.8, visible: true, cornerRadius: 12, fills: [{ type: "solid", color: "#ffffff" }] }
    ]
  }));
} else if (tool === "get_screenshot") {
  process.stdout.write(JSON.stringify({ image_url: "http://localhost/shot.png" }));
} else {
  process.exit(2);
}`
      );

      const output = execFileSync(
        process.execPath,
        [rootPath("scripts/zero-mcp-layer-bridge.mjs"), "--node-id", "28:2"],
        {
          encoding: "utf8",
          env: {
            ...process.env,
            ZERO_MCP_TOOL_COMMAND: process.execPath,
            ZERO_MCP_TOOL_ARGS: `${toolScript} {tool} --node-id {nodeId} --script {script}`
          }
        }
      );
      const snapshot = normalizeZeroLayerSnapshot(JSON.parse(output));

      expect(snapshot).toMatchObject({
        schemaVersion: "motion-copilot.zero-layer-snapshot.v1",
        nodeId: "28:2",
        screenshotUrl: "http://localhost/shot.png"
      });
      expect(snapshot.layers.find((layer) => layer.nodeId === "bg")).toMatchObject({
        cornerRadius: 12,
        opacity: 0.8,
        fills: [{ type: "solid", color: "#ffffff" }]
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }, 15_000);

  it("collects Zero MCP layer snapshots through the local HTTP use_design_script endpoint", async () => {
    const seenTools: string[] = [];
    const scriptArgumentKeys: string[][] = [];
    const server = createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const payload = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
        params?: { name?: string; arguments?: Record<string, unknown> & { nodeId?: string } };
      };
      const tool = payload.params?.name ?? "";
      seenTools.push(tool);
      if (tool === "use_design_script") {
        scriptArgumentKeys.push(Object.keys(payload.params?.arguments ?? {}).sort());
      }
      const nodeId = payload.params?.arguments?.nodeId ?? "28:2";
      const result =
        tool === "use_design_script"
          ? {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    schemaVersion: "motion-copilot.zero-layer-snapshot.v1",
                    frameId: nodeId,
                    nodeId,
                    name: "HTTP 图层",
                    width: 96,
                    height: 40,
                    screenshotUrl: "",
                    assets: [],
                    layers: [
                      {
                        nodeId,
                        name: "HTTP 图层",
                        kind: "frame",
                        bounds: { x: 0, y: 0, w: 96, h: 40 },
                        opacity: 1,
                        visible: true
                      },
                      {
                        nodeId: "pill",
                        parentId: nodeId,
                        name: "圆角矩形",
                        kind: "rect",
                        bounds: { x: 8, y: 6, w: 80, h: 28 },
                        opacity: 1,
                        visible: true,
                        cornerRadius: 999,
                        fills: [{ type: "solid", color: "#f3f3f3" }]
                      }
                    ]
                  })
                }
              ],
              scriptLength:
                typeof payload.params?.arguments?.code === "string" ? payload.params.arguments.code.length : 0
            }
          : {
              content: [
                { type: "text", text: JSON.stringify({ image_url: "http://localhost/http-shot.png" }) }
              ]
            };
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      res.end(`event: message\ndata: ${JSON.stringify({ jsonrpc: "2.0", id: "test", result })}\n\n`);
    });

    try {
      await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      const output = await execFileText(
        process.execPath,
        [rootPath("scripts/zero-mcp-layer-bridge.mjs"), "--node-id", "28:2"],
        {
          ...process.env,
          ZERO_MCP_HTTP_URL: `http://127.0.0.1:${port}/mcp`
        }
      );
      const snapshot = normalizeZeroLayerSnapshot(JSON.parse(output));

      expect(snapshot.name).toBe("HTTP 图层");
      expect(snapshot.screenshotUrl).toBe("http://localhost/http-shot.png");
      expect(snapshot.layers.find((layer) => layer.nodeId === "pill")?.cornerRadius).toBe(999);
      expect(seenTools.sort()).toEqual(["get_screenshot", "use_design_script"]);
      expect(scriptArgumentKeys).toEqual([["code", "description"]]);
    } finally {
      await new Promise<void>((resolveClose, rejectClose) =>
        server.close((error) => (error ? rejectClose(error) : resolveClose()))
      );
    }
  }, 15_000);

  it("sends Zero native layer collector as code to the HTTP use_design_script endpoint", async () => {
    let useDesignScriptArguments: Record<string, unknown> | undefined;
    const server = createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const payload = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
        params?: { name?: string; arguments?: Record<string, unknown> };
      };
      const tool = payload.params?.name ?? "";
      if (tool === "use_design_script") {
        useDesignScriptArguments = payload.params?.arguments;
      }
      const result =
        tool === "use_design_script"
          ? {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    schemaVersion: "motion-copilot.zero-layer-snapshot.v1",
                    frameId: "28:2",
                    nodeId: "28:2",
                    name: "HTTP 原生图层",
                    width: 96,
                    height: 40,
                    screenshotUrl: "",
                    assets: [],
                    layers: [
                      {
                        nodeId: "28:2",
                        name: "HTTP 原生图层",
                        kind: "group",
                        bounds: { x: 0, y: 0, w: 96, h: 40 },
                        opacity: 1,
                        visible: true
                      }
                    ]
                  })
                }
              ]
            }
          : {
              content: [
                { type: "text", text: JSON.stringify({ image_url: "http://localhost/http-shot.png" }) }
              ]
            };
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      res.end(`event: message\ndata: ${JSON.stringify({ jsonrpc: "2.0", id: "test", result })}\n\n`);
    });

    try {
      await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;

      await execFileText(
        process.execPath,
        [rootPath("scripts/zero-mcp-layer-bridge.mjs"), "--node-id", "28:2"],
        {
          ...process.env,
          ZERO_MCP_HTTP_URL: `http://127.0.0.1:${port}/mcp`
        }
      );

      expect(useDesignScriptArguments).toMatchObject({
        description: expect.stringContaining("Zero native layer")
      });
      expect(typeof useDesignScriptArguments?.code).toBe("string");
      expect(useDesignScriptArguments).not.toHaveProperty("script");
    } finally {
      await new Promise<void>((resolveClose, rejectClose) =>
        server.close((error) => (error ? rejectClose(error) : resolveClose()))
      );
    }
  }, 15_000);

  it("includes the raw use_design_script response when it is not a layer snapshot", async () => {
    const server = createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const payload = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
        params?: { name?: string };
      };
      const result =
        payload.params?.name === "use_design_script"
          ? { content: [{ type: "text", text: "Error: Node 33:36 was not found in current file." }] }
          : { content: [{ type: "text", text: JSON.stringify({ image_url: "http://localhost/shot.png" }) }] };
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      res.end(`event: message\ndata: ${JSON.stringify({ jsonrpc: "2.0", id: "test", result })}\n\n`);
    });

    try {
      await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;

      await expect(
        execFileText(
          process.execPath,
          [rootPath("scripts/zero-mcp-layer-bridge.mjs"), "--node-id", "33:36"],
          {
            ...process.env,
            ZERO_MCP_HTTP_URL: `http://127.0.0.1:${port}/mcp`
          }
        )
      ).rejects.toThrow("Node 33:36 was not found");
    } finally {
      await new Promise<void>((resolveClose, rejectClose) =>
        server.close((error) => (error ? rejectClose(error) : resolveClose()))
      );
    }
  }, 15_000);

  it("runs a recursive Zero MCP layer collector instead of relying on findAll only", () => {
    const tempDir = mkdtempSync(resolve(tmpdir(), "zero-mcp-layer-recursive-"));
    try {
      const toolScript = resolve(tempDir, "tool.mjs");
      writeFileSync(
        toolScript,
        `const tool = process.argv[2];
const script = process.argv[process.argv.indexOf("--script") + 1];
if (tool === "get_screenshot") {
  process.stdout.write(JSON.stringify({ image_url: "http://localhost/recursive-shot.png" }));
  process.exit(0);
}
if (tool !== "use_design_script") process.exit(2);
const root = {
  id: "28:2",
  name: "root",
  type: "FRAME",
  x: 0,
  y: 0,
  width: 120,
  height: 48,
  opacity: 1,
  visible: true,
  fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }],
  children: []
};
const bg = {
  id: "bg",
  parent: root,
  name: "组件背景",
  type: "RECTANGLE",
  x: 0,
  y: 0,
  width: 120,
  height: 48,
  opacity: 1,
  visible: true,
  cornerRadius: 12,
  fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }]
};
const label = {
  id: "label",
  parent: root,
  name: "状态文字",
  type: "TEXT",
  x: 20,
  y: 14,
  width: 64,
  height: 16,
  opacity: 1,
  visible: true,
  characters: "待确认 2",
  fontName: { family: "Arial", style: "Regular" },
  fontSize: 12,
  fontWeight: 500,
  lineHeight: { value: 16, unit: "PIXELS" },
  textAlignHorizontal: "LEFT",
  fills: [{ type: "SOLID", color: { r: 0.8, g: 0.67, b: 0.09 } }]
};
root.children = [bg, label];
const relay = {
  mixed: "__mixed__",
  skipInvisibleInstanceChildren: true,
  getNodeByIdAsync: async () => root
};
const run = new Function("relay", "return (async () => {" + script + "\\n})()");
const result = await run(relay);
process.stdout.write(JSON.stringify(result));`
      );

      const output = execFileSync(
        process.execPath,
        [rootPath("scripts/zero-mcp-layer-bridge.mjs"), "--node-id", "28:2"],
        {
          encoding: "utf8",
          env: {
            ...process.env,
            ZERO_MCP_TOOL_COMMAND: process.execPath,
            ZERO_MCP_TOOL_ARGS: `${toolScript} {tool} --node-id {nodeId} --script {script}`
          }
        }
      );
      const snapshot = normalizeZeroLayerSnapshot(JSON.parse(output));

      expect(snapshot.layers.map((layer) => layer.nodeId)).toEqual(["28:2", "bg", "label"]);
      expect(snapshot.layers.find((layer) => layer.nodeId === "28:2")?.parentId).toBeUndefined();
      expect(snapshot.layers.find((layer) => layer.nodeId === "bg")).toMatchObject({
        parentId: "28:2",
        cornerRadius: 12,
        fills: [{ type: "solid", color: "#ffffff" }]
      });
      expect(snapshot.layers.find((layer) => layer.nodeId === "label")).toMatchObject({
        text: "待确认 2",
        textStyle: { fontSize: 12, lineHeight: 16 }
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }, 15_000);

  it("normalizes Relay page-space node positions into component-local bounds", () => {
    const tempDir = mkdtempSync(resolve(tmpdir(), "zero-mcp-layer-page-space-"));
    try {
      const toolScript = resolve(tempDir, "tool.mjs");
      writeFileSync(
        toolScript,
        `const tool = process.argv[2];
const script = process.argv[process.argv.indexOf("--script") + 1];
if (tool === "get_screenshot") {
  process.stdout.write(JSON.stringify({ image_url: "http://localhost/page-space-shot.png" }));
  process.exit(0);
}
if (tool !== "use_design_script") process.exit(2);
const root = {
  id: "28:19",
  name: "root",
  type: "GROUP",
  x: -213,
  y: 42,
  width: 505,
  height: 38,
  opacity: 1,
  visible: true,
  children: []
};
const group = {
  id: "group",
  parent: root,
  name: "组",
  type: "GROUP",
  x: -135,
  y: 48,
  width: 108,
  height: 26,
  opacity: 1,
  visible: true,
  children: []
};
const pill = {
  id: "pill",
  parent: group,
  name: "状态胶囊",
  type: "RECTANGLE",
  x: -135,
  y: 48,
  width: 108,
  height: 26,
  opacity: 1,
  visible: true,
  cornerRadius: 25,
  fills: [{ type: "SOLID", color: { r: 0.953, g: 0.953, b: 0.953 } }]
};
const label = {
  id: "label",
  parent: group,
  name: "2",
  type: "TEXT",
  x: -110,
  y: 53,
  width: 8,
  height: 17,
  opacity: 1,
  visible: true,
  characters: "2",
  fontName: { family: "Arial", style: "Regular" },
  fontSize: 12,
  fontWeight: 500,
  lineHeight: { value: 16, unit: "PIXELS" },
  textAlignHorizontal: "LEFT",
  fills: [{ type: "SOLID", color: { r: 0.8, g: 0.67, b: 0.09 } }]
};
root.children = [group];
group.children = [pill, label];
const relay = {
  mixed: "__mixed__",
  skipInvisibleInstanceChildren: true,
  getNodeByIdAsync: async () => root
};
const run = new Function("relay", "return (async () => {" + script + "\\n})()");
const result = await run(relay);
process.stdout.write(JSON.stringify(result));`
      );

      const output = execFileSync(
        process.execPath,
        [rootPath("scripts/zero-mcp-layer-bridge.mjs"), "--node-id", "28:19"],
        {
          encoding: "utf8",
          env: {
            ...process.env,
            ZERO_MCP_TOOL_COMMAND: process.execPath,
            ZERO_MCP_TOOL_ARGS: `${toolScript} {tool} --node-id {nodeId} --script {script}`
          }
        }
      );
      const snapshot = normalizeZeroLayerSnapshot(JSON.parse(output));

      expect(snapshot.layers.find((layer) => layer.nodeId === "group")?.bounds).toEqual({
        x: 78,
        y: 6,
        w: 108,
        h: 26
      });
      expect(snapshot.layers.find((layer) => layer.nodeId === "pill")?.bounds).toEqual({
        x: 78,
        y: 6,
        w: 108,
        h: 26
      });
      expect(snapshot.layers.find((layer) => layer.nodeId === "label")?.bounds).toEqual({
        x: 103,
        y: 11,
        w: 8,
        h: 17
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }, 15_000);

  it("normalizes mixed Relay node.x coordinates through absolute bounding boxes", () => {
    const tempDir = mkdtempSync(resolve(tmpdir(), "zero-mcp-layer-absolute-bounds-"));
    try {
      const toolScript = resolve(tempDir, "tool.mjs");
      writeFileSync(
        toolScript,
        `const tool = process.argv[2];
const script = process.argv[process.argv.indexOf("--script") + 1];
if (tool === "get_screenshot") {
  process.stdout.write(JSON.stringify({ image_url: "http://localhost/absolute-bounds-shot.png" }));
  process.exit(0);
}
if (tool !== "use_design_script") process.exit(2);
const root = {
  id: "32:35",
  name: "组 534",
  type: "GROUP",
  x: -104,
  y: 5,
  width: 207.7812,
  height: 133.4044,
  absoluteBoundingBox: { x: -104, y: 5, width: 207.7812, height: 133.4044 },
  opacity: 1,
  visible: true,
  children: []
};
const direct = {
  id: "32:17",
  parent: root,
  name: ".item/new card",
  type: "FRAME",
  x: 23.7812,
  y: 5,
  width: 80,
  height: 28,
  absoluteBoundingBox: { x: 23.7812, y: 5, width: 80, height: 28 },
  opacity: 1,
  visible: true,
  children: []
};
const nested = {
  id: "32:18",
  parent: direct,
  name: "content",
  type: "FRAME",
  x: 12,
  y: 3,
  width: 56,
  height: 22,
  absoluteBoundingBox: { x: 35.7812, y: 8, width: 56, height: 22 },
  opacity: 1,
  visible: true,
  children: []
};
const text = {
  id: "32:19",
  parent: nested,
  name: "text",
  type: "TEXT",
  x: -0.000016316223991452716,
  y: 0,
  width: 56,
  height: 22,
  absoluteBoundingBox: { x: 35.78118368377601, y: 8, width: 56, height: 22 },
  opacity: 1,
  visible: true,
  characters: "场域视图",
  fontName: { family: "Arial", style: "Regular" },
  fontSize: 14,
  lineHeight: { value: 22, unit: "PIXELS" },
  fills: [{ type: "SOLID", color: { r: 0.31, g: 0.32, b: 0.35 } }]
};
root.children = [direct];
direct.children = [nested];
nested.children = [text];
const relay = {
  mixed: "__mixed__",
  skipInvisibleInstanceChildren: true,
  getNodeByIdAsync: async () => root
};
const run = new Function("relay", "return (async () => {" + script + "\\n})()");
const result = await run(relay);
process.stdout.write(JSON.stringify(result));`
      );

      const output = execFileSync(
        process.execPath,
        [rootPath("scripts/zero-mcp-layer-bridge.mjs"), "--node-id", "32:35"],
        {
          encoding: "utf8",
          env: {
            ...process.env,
            ZERO_MCP_TOOL_COMMAND: process.execPath,
            ZERO_MCP_TOOL_ARGS: `${toolScript} {tool} --node-id {nodeId} --script {script}`
          }
        }
      );
      const snapshot = normalizeZeroLayerSnapshot(JSON.parse(output));

      expect(snapshot.layers.find((layer) => layer.nodeId === "32:17")?.bounds).toEqual({
        x: 127.7812,
        y: 0,
        w: 80,
        h: 28
      });
      expect(snapshot.layers.find((layer) => layer.nodeId === "32:18")?.bounds).toEqual({
        x: 139.7812,
        y: 3,
        w: 56,
        h: 22
      });
      expect(snapshot.layers.find((layer) => layer.nodeId === "32:19")?.bounds).toMatchObject({
        x: expect.closeTo(139.781183683776, 6),
        y: 3,
        w: 56,
        h: 22
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }, 15_000);
});
