import { execFile, execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildFrameObjectModel,
  compileMorphPlan,
  compileFrameMorphComposition,
  compileVisualMotionBindings,
  compileVisualMotionComposition,
  compileVisualMotionIntent,
  createRestorationReport,
  createZeroVisualSnapshotFromMcp,
  createMorphVisualCheckPlan,
  createVisualTimelineCss,
  createVisualTimelineCssForTrack,
  diffRgbaPixels,
  evaluateMorphPlan,
  evaluateScreenshotDiff,
  exportCompositionHtml,
  exportMorphHtml,
  exportMorphJson,
  createZeroVisualNodeOverrideCss,
  FrameSnapshotValidationError,
  matchFrameElements,
  normalizeFrameSnapshot,
  normalizeZeroVisualSnapshot,
  ZeroVisualSnapshotValidationError,
  inlineZeroVisualAssets,
  type AssetFetcher,
  type FrameSnapshot,
  type ZeroVisualSnapshot,
  type VisualMotionBindingResult
} from "../src";

function readFixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`../../../fixtures/frames/${name}.json`, import.meta.url), "utf8"));
}

function rootPath(...parts: string[]): string {
  return resolve(fileURLToPath(new URL("../../..", import.meta.url)), ...parts);
}

function execFileText(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolveExec, rejectExec) => {
    execFile(command, args, { encoding: "utf8", env }, (error, stdout, stderr) => {
      if (error) {
        rejectExec(new Error(stderr || error.message));
        return;
      }
      resolveExec(stdout);
    });
  });
}

const expandedZeroContext = `const imgAsset5093 = "http://localhost:27618/assets/svg_2069969131263778818_28-4.svg";
const imgAsset5126 = "http://localhost:27618/assets/svg_2069969131263778818_28-7.svg";
const imgAsset5096 = "http://localhost:27618/assets/svg_2069969131263778818_28-17.svg";

export default function Component() {
  return (
    <div className="contents relative size-full" data-node-id="28:2" data-name="信息展开状态">
      <div className="absolute contents left-[477px] top-0" data-node-id="28:3" data-name="组 490">
        <div className="absolute left-0 top-0 w-[106px] h-[38px]" data-node-id="28:4">
          <div className="absolute top-[-13.158%] right-[-4.717%] bottom-[-13.158%] left-[-4.717%]">
            <img className="block max-w-none size-full" alt="" src={imgAsset5093} />
          </div>
        </div>
        <p className="absolute left-[17px] top-[10.5px] w-[72px] h-[17px] [word-break:break-word] font-['PingFang-SC:Semibold'] font-semibold not-italic text-[12px] leading-[normal] text-black whitespace-nowrap" style={{ fontVariationSettings: "'wdth' 100" }} data-node-id="28:5">邀请主架构 &gt;</p>
      </div>
      <div className="absolute contents left-0 top-0" data-node-id="28:6" data-name="组 491">
        <div className="absolute left-0 top-0 w-[366px] h-[38px]" data-node-id="28:7">
          <div className="absolute top-[-13.158%] right-[-1.366%] bottom-[-13.158%] left-[-1.366%]">
            <img className="block max-w-none size-full" alt="" src={imgAsset5126} />
          </div>
        </div>
        <p className="absolute left-[13px] top-[10px] w-[60px] h-[17px] [word-break:break-word] font-['PingFang-SC:Medium'] font-medium not-italic text-[12px] leading-[normal] text-black whitespace-nowrap" style={{ fontVariationSettings: "'wdth' 100" }} data-node-id="28:8">指派域产品</p>
        <div className="absolute contents left-[273px] top-[4px]" data-node-id="28:9" data-name="组 431">
          <div className="absolute left-0 top-0 w-[88px] h-[30px] rounded-[36px] bg-black" data-node-id="28:10" data-name="矩形 5125" />
          <p className="absolute left-[14px] top-[6px] w-[60px] h-[17px] [word-break:break-word] font-['PingFang-SC:Medium'] font-medium not-italic text-[12px] leading-[normal] text-white whitespace-nowrap" style={{ fontVariationSettings: "'wdth' 100" }} data-node-id="28:11">继续指派 &gt;</p>
        </div>
        <div className="absolute left-[79px] top-[6px] w-[185px] h-[26px] rounded-[25px] bg-[#f3f3f3]" data-node-id="28:12" data-name="矩形 5127" />
        <p className="absolute left-[206px] top-[10px] w-[48px] h-[17px] [word-break:break-word] font-['PingFang-SC:Medium'] font-medium not-italic text-[12px] leading-[normal] text-[#ff3434] whitespace-nowrap" style={{ fontVariationSettings: "'wdth' 100" }} data-node-id="28:13">已拒绝 3</p>
        <p className="absolute left-[88px] top-[10px] w-[48px] h-[17px] [word-break:break-word] font-['PingFang-SC:Medium'] font-medium not-italic text-[12px] leading-[normal] text-[#cdab18] whitespace-nowrap" style={{ fontVariationSettings: "'wdth' 100" }} data-node-id="28:14">待确认 2</p>
        <p className="absolute left-[149px] top-[10px] w-[45px] h-[17px] [word-break:break-word] font-['PingFang-SC:Medium'] font-medium not-italic text-[12px] leading-[normal] text-[#09ae28] whitespace-nowrap" style={{ fontVariationSettings: "'wdth' 100" }} data-node-id="28:15">已接受 1</p>
      </div>
      <div className="absolute contents left-[380px] top-0" data-node-id="28:16" data-name="组 497">
        <div className="absolute left-0 top-0 w-[83px] h-[38px]" data-node-id="28:17">
          <div className="absolute top-[-13.158%] right-[-6.024%] bottom-[-13.158%] left-[-6.024%]">
            <img className="block max-w-none size-full" alt="" src={imgAsset5096} />
          </div>
        </div>
        <p className="absolute left-[17px] top-[10px] w-[49px] h-[17px] [word-break:break-word] font-['PingFang-SC:Semibold'] font-semibold not-italic text-[12px] leading-[normal] text-black whitespace-nowrap" style={{ fontVariationSettings: "'wdth' 100" }} data-node-id="28:18">生成PRD</p>
      </div>
    </div>
  );
}`;

const expandedZeroMetadata = `<group id="28:2" name="信息展开状态" x="-291" y="-19" width="583" height="38">
  <group id="28:3" name="组 490" x="477" y="0" width="106" height="38">
    <vector id="28:4" name="矩形 5093" x="0" y="0" width="106" height="38" />
    <text id="28:5" name="文字 140" x="17" y="10.5" width="72" height="17" />
  </group>
  <group id="28:6" name="组 491" x="0" y="0" width="366" height="38">
    <vector id="28:7" name="矩形 5126" x="0" y="0" width="366" height="38" />
    <text id="28:8" name="文字 159" x="13" y="10" width="60" height="17" />
    <group id="28:9" name="组 431" x="273" y="4" width="88" height="30">
      <rounded-rectangle id="28:10" name="矩形 5125" x="0" y="0" width="88" height="30" />
      <text id="28:11" name="文字 159" x="14" y="6" width="60" height="17" />
    </group>
    <rounded-rectangle id="28:12" name="矩形 5127" x="79" y="6" width="185" height="26" />
    <text id="28:13" name="文字 159" x="206" y="10" width="48" height="17" />
    <text id="28:14" name="文字 159" x="88" y="10" width="48" height="17" />
    <text id="28:15" name="文字 159" x="149" y="10" width="45" height="17" />
  </group>
  <group id="28:16" name="组 497" x="380" y="0" width="83" height="38">
    <vector id="28:17" name="矩形 5096" x="0" y="0" width="83" height="38" />
    <text id="28:18" name="文字 140" x="17" y="10" width="49" height="17" />
  </group>
</group>`;

describe("FrameSnapshot normalization", () => {
  it("normalizes the Zero collapsed and expanded fixtures", () => {
    const collapsed = normalizeFrameSnapshot(readFixture("info-collapsed"));
    const expanded = normalizeFrameSnapshot(readFixture("info-expanded"));

    expect(collapsed).toMatchObject({
      schemaVersion: "motion-copilot.frame-snapshot.v1",
      frameId: "28:19",
      name: "信息收起状态",
      width: 505,
      height: 38
    });
    expect(expanded).toMatchObject({
      frameId: "28:2",
      name: "信息展开状态",
      width: 583,
      height: 38
    });
    expect(collapsed.screenshotUrl).toMatch(/^https:\/\/img\d+\.360buyimg\.com\//);
    expect(expanded.screenshotUrl).toMatch(/^https:\/\/img\d+\.360buyimg\.com\//);
    expect(collapsed.elements.map((element) => element.key)).toContain("rect:status-pill");
    expect(expanded.elements.map((element) => element.key)).toContain("text:status-rejected-expanded");
    expect(collapsed.elements.find((element) => element.key === "text:continue-assign")).toMatchObject({
      nodeId: "28:32",
      text: "继续指派 >",
      x: 209,
      y: 10
    });
    expect(expanded.elements.find((element) => element.key === "text:continue-assign")).toMatchObject({
      nodeId: "28:11",
      text: "继续指派 >",
      x: 287,
      y: 10
    });
  });

  it("fills safe defaults without mutating the input", () => {
    const input = {
      schemaVersion: "motion-copilot.frame-snapshot.v1",
      frameId: "frame-a",
      name: "Frame A",
      width: 100,
      height: 40,
      elements: [
        {
          nodeId: "1:1",
          name: "矩形",
          kind: "rect",
          x: 1,
          y: 2,
          w: 10,
          h: 20
        }
      ]
    };

    const normalized = normalizeFrameSnapshot(input);

    expect(normalized.elements[0]).toMatchObject({
      key: "1:1",
      opacity: 1,
      zIndex: 0
    });
    expect((input.elements[0] as { key?: string }).key).toBeUndefined();
  });

  it("rejects invalid snapshots with stable issues", () => {
    expect(() =>
      normalizeFrameSnapshot({
        schemaVersion: "wrong",
        frameId: "",
        name: "Broken",
        width: 0,
        height: 38,
        elements: [
          {
            key: "dup",
            nodeId: "1:1",
            name: "A",
            kind: "text",
            x: 0,
            y: 0,
            w: 10,
            h: 10,
            opacity: 2,
            zIndex: 0
          },
          {
            key: "dup",
            nodeId: "1:2",
            name: "B",
            kind: "text",
            x: 0,
            y: 0,
            w: 10,
            h: 10,
            opacity: 1,
            zIndex: 1
          }
        ]
      })
    ).toThrow(FrameSnapshotValidationError);

    try {
      normalizeFrameSnapshot({ schemaVersion: "wrong", elements: "nope" });
    } catch (error) {
      expect(error).toBeInstanceOf(FrameSnapshotValidationError);
      expect((error as FrameSnapshotValidationError).issues).toContain(
        "$.schemaVersion must be motion-copilot.frame-snapshot.v1"
      );
      expect((error as FrameSnapshotValidationError).issues).toContain("$.elements must be an array");
    }
  });

  it("keeps the public contract assignable", () => {
    const snapshot: FrameSnapshot = normalizeFrameSnapshot(readFixture("info-expanded"));
    expect(snapshot.elements.every((element) => element.nodeId.startsWith("28:"))).toBe(true);
  });
});

describe("ZeroVisualSnapshot normalization", () => {
  it("creates a complete high-fidelity snapshot from real Zero MCP context output", () => {
    const snapshot = createZeroVisualSnapshotFromMcp({
      nodeId: "28:2",
      designContext: expandedZeroContext,
      designMetadata: expandedZeroMetadata,
      screenshot: { image_url: "http://localhost:27618/assets/img_2069969131263778818_28-2.png" }
    });

    expect(snapshot).toMatchObject({
      schemaVersion: "motion-copilot.zero-visual-snapshot.v1",
      frameId: "28:2",
      nodeId: "28:2",
      name: "信息展开状态",
      width: 583,
      height: 38
    });
    expect(snapshot.nodes).toHaveLength(17);
    expect(snapshot.assets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "asset-28:4",
          nodeId: "28:4",
          type: "svg",
          url: "http://localhost:27618/assets/svg_2069969131263778818_28-4.svg"
        })
      ])
    );
    expect(snapshot.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          nodeId: "28:11",
          kind: "text",
          bounds: { x: 287, y: 10, w: 60, h: 17 },
          text: "继续指派 >"
        }),
        expect.objectContaining({
          nodeId: "28:17",
          kind: "vector",
          bounds: { x: 380, y: 0, w: 83, h: 38 },
          assetId: "asset-28:17"
        })
      ])
    );
    expect(snapshot.html).toContain('src="http://localhost:27618/assets/svg_2069969131263778818_28-7.svg"');
    expect(snapshot.html).toContain("border-radius:25px");
    expect(snapshot.html).not.toContain("src={");
    expect(snapshot.html).not.toContain("className=");
  });

  it("accepts rich Zero visual context for high-fidelity rendering", () => {
    const snapshot: ZeroVisualSnapshot = normalizeZeroVisualSnapshot({
      schemaVersion: "motion-copilot.zero-visual-snapshot.v1",
      frameId: "28:2",
      nodeId: "28:2",
      name: "信息展开状态",
      width: 583,
      height: 38,
      screenshotUrl: "http://localhost:27618/assets/img_28-2.png",
      html: '<div data-node-id="28:2"><div data-node-id="28:8"></div><span data-node-id="28:11">继续指派 &gt;</span></div>',
      css: ".zero-frame { position: relative; }",
      assets: [
        {
          id: "asset-status-bg",
          type: "svg",
          url: "http://localhost:27618/assets/svg_status_bg.svg",
          nodeId: "28:8"
        }
      ],
      nodes: [
        {
          nodeId: "28:2",
          name: "信息展开状态",
          kind: "group",
          bounds: { x: 0, y: 0, w: 583, h: 38 }
        },
        {
          nodeId: "28:11",
          name: "文字 159",
          kind: "text",
          bounds: { x: 287, y: 10, w: 60, h: 17 },
          text: "继续指派 >"
        },
        {
          nodeId: "28:8",
          name: "矩形 5127",
          kind: "vector",
          bounds: { x: 79, y: 6, w: 185, h: 26 },
          assetId: "asset-status-bg"
        }
      ]
    });

    expect(snapshot.frameId).toBe("28:2");
    expect(snapshot.html).toContain('data-node-id="28:11"');
    expect(snapshot.nodes.map((node) => node.nodeId)).toEqual(["28:2", "28:11", "28:8"]);
  });

  it("accepts a degraded (empty) screenshotUrl because the morph renders from html+css (bug B)", () => {
    // The screenshot is only a pixel-diff/preview reference; the morph renders from html+css.
    // visualCheck / createRestorationReport / FrameMorphPanel already guard `if (!screenshotUrl)`,
    // so a missing screenshot must degrade — not abort the whole snapshot at the normalizer gate.
    const snapshot: ZeroVisualSnapshot = normalizeZeroVisualSnapshot({
      schemaVersion: "motion-copilot.zero-visual-snapshot.v1",
      frameId: "28:2",
      nodeId: "28:2",
      name: "信息展开状态",
      width: 583,
      height: 38,
      screenshotUrl: "",
      html: '<div data-node-id="28:2"><span data-node-id="28:11">继续指派 &gt;</span></div>',
      css: ".zero-frame { position: relative; }",
      assets: [],
      nodes: [
        {
          nodeId: "28:2",
          name: "信息展开状态",
          kind: "group",
          bounds: { x: 0, y: 0, w: 583, h: 38 }
        },
        {
          nodeId: "28:11",
          name: "文字 159",
          kind: "text",
          bounds: { x: 287, y: 10, w: 60, h: 17 },
          text: "继续指派 >"
        }
      ]
    });

    expect(snapshot.screenshotUrl).toBe("");
    expect(snapshot.html).toContain('data-node-id="28:11"');
  });

  it("still requires schemaVersion even when the screenshot is degraded", () => {
    expect(() =>
      normalizeZeroVisualSnapshot({
        schemaVersion: "wrong-version",
        frameId: "28:2",
        nodeId: "28:2",
        name: "信息展开状态",
        width: 583,
        height: 38,
        screenshotUrl: "",
        html: '<div data-node-id="28:2"></div>',
        css: "",
        assets: [],
        nodes: [{ nodeId: "28:2", name: "信息展开状态", kind: "group", bounds: { x: 0, y: 0, w: 583, h: 38 } }]
      })
    ).toThrow(ZeroVisualSnapshotValidationError);
  });

  it("rejects metadata-only payloads before they enter the high-fidelity path", () => {
    expect(() =>
      normalizeZeroVisualSnapshot({
        schemaVersion: "motion-copilot.zero-visual-snapshot.v1",
        frameId: "28:2",
        nodeId: "28:2",
        name: "信息展开状态",
        width: 583,
        height: 38,
        nodes: [
          {
            nodeId: "28:11",
            name: "文字 159",
            kind: "text",
            bounds: { x: 287, y: 10, w: 60, h: 17 }
          }
        ]
      })
    ).toThrow(ZeroVisualSnapshotValidationError);

    try {
      normalizeZeroVisualSnapshot({
        schemaVersion: "motion-copilot.zero-visual-snapshot.v1",
        frameId: "28:2",
        nodeId: "28:2",
        name: "信息展开状态",
        width: 583,
        height: 38,
        screenshotUrl: "http://localhost:27618/assets/img_28-2.png",
        html: "<div>missing binding</div>",
        css: "",
        assets: [],
        nodes: [
          {
            nodeId: "28:11",
            name: "文字 159",
            kind: "text",
            bounds: { x: 287, y: 10, w: 60, h: 17 }
          }
        ]
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ZeroVisualSnapshotValidationError);
      expect((error as ZeroVisualSnapshotValidationError).issues).toContain(
        "$.html must preserve Zero node bindings with data-node-id attributes"
      );
    }
  });

  it("rejects visual snapshots when html node bindings and node index diverge", () => {
    expect(() =>
      normalizeZeroVisualSnapshot({
        schemaVersion: "motion-copilot.zero-visual-snapshot.v1",
        frameId: "28:2",
        nodeId: "28:2",
        name: "信息展开状态",
        width: 583,
        height: 38,
        screenshotUrl: "http://localhost:27618/assets/img_28-2.png",
        html: '<div data-node-id="28:2"><span data-node-id="28:11">继续指派 &gt;</span></div>',
        css: "",
        assets: [],
        nodes: [
          {
            nodeId: "28:2",
            name: "信息展开状态",
            kind: "group",
            bounds: { x: 0, y: 0, w: 583, h: 38 }
          }
        ]
      })
    ).toThrow(ZeroVisualSnapshotValidationError);

    try {
      normalizeZeroVisualSnapshot({
        schemaVersion: "motion-copilot.zero-visual-snapshot.v1",
        frameId: "28:2",
        nodeId: "28:2",
        name: "信息展开状态",
        width: 583,
        height: 38,
        screenshotUrl: "http://localhost:27618/assets/img_28-2.png",
        html: '<div data-node-id="28:2"></div>',
        css: "",
        assets: [],
        nodes: [
          {
            nodeId: "28:2",
            name: "信息展开状态",
            kind: "group",
            bounds: { x: 0, y: 0, w: 583, h: 38 }
          },
          {
            nodeId: "28:11",
            name: "继续指派",
            kind: "text",
            bounds: { x: 287, y: 10, w: 60, h: 17 },
            text: "继续指派 >"
          }
        ]
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ZeroVisualSnapshotValidationError);
      expect((error as ZeroVisualSnapshotValidationError).issues).toContain(
        "$.nodes nodeId is missing from $.html data-node-id: 28:11"
      );
    }
  });
});

describe("Zero visual motion bindings", () => {
  it("pairs rich visual nodes and keeps weak matches reviewable", () => {
    const from = normalizeZeroVisualSnapshot({
      schemaVersion: "motion-copilot.zero-visual-snapshot.v1",
      frameId: "28:19",
      nodeId: "28:19",
      name: "信息收起状态",
      width: 505,
      height: 38,
      screenshotUrl: "http://localhost:27618/assets/img_28-19.png",
      html: '<div data-node-id="28:19"><span data-node-id="28:32">继续指派 &gt;</span><div data-node-id="28:35"></div><span data-node-id="28:99">旧</span></div>',
      css: ".zero-frame{position:relative}",
      assets: [{ id: "pill", type: "svg", url: "http://localhost:27618/assets/pill.svg", nodeId: "28:35" }],
      nodes: [
        {
          nodeId: "28:19",
          name: "信息收起状态",
          kind: "group",
          bounds: { x: 0, y: 0, w: 505, h: 38 }
        },
        {
          nodeId: "28:32",
          name: "继续指派文案",
          kind: "text",
          bounds: { x: 209, y: 10, w: 60, h: 17 },
          text: "继续指派 >"
        },
        {
          nodeId: "28:35",
          name: "状态胶囊",
          kind: "vector",
          bounds: { x: 78, y: 6, w: 108, h: 26 },
          assetId: "pill"
        },
        {
          nodeId: "28:99",
          name: "旧孤立节点",
          kind: "text",
          bounds: { x: 450, y: 10, w: 36, h: 17 },
          text: "旧"
        }
      ]
    });
    const to = normalizeZeroVisualSnapshot({
      schemaVersion: "motion-copilot.zero-visual-snapshot.v1",
      frameId: "28:2",
      nodeId: "28:2",
      name: "信息展开状态",
      width: 583,
      height: 38,
      screenshotUrl: "http://localhost:27618/assets/img_28-2.png",
      html: '<div data-node-id="28:2"><span data-node-id="28:11">继续指派 &gt;</span><div data-node-id="28:8"></div><span data-node-id="28:12">待确认 2</span></div>',
      css: ".zero-frame{position:relative}",
      assets: [
        { id: "pill-wide", type: "svg", url: "http://localhost:27618/assets/pill-wide.svg", nodeId: "28:8" }
      ],
      nodes: [
        {
          nodeId: "28:2",
          name: "信息展开状态",
          kind: "group",
          bounds: { x: 0, y: 0, w: 583, h: 38 }
        },
        {
          nodeId: "28:11",
          name: "继续指派文案",
          kind: "text",
          bounds: { x: 287, y: 10, w: 60, h: 17 },
          text: "继续指派 >"
        },
        {
          nodeId: "28:8",
          name: "状态胶囊",
          kind: "vector",
          bounds: { x: 79, y: 6, w: 185, h: 26 },
          assetId: "pill-wide"
        },
        {
          nodeId: "28:12",
          name: "待确认",
          kind: "text",
          bounds: { x: 95, y: 10, w: 51, h: 17 },
          text: "待确认 2"
        }
      ]
    });

    const result = compileVisualMotionBindings(from, to);

    expect(result.bindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          nodeId: "28:32",
          toNodeId: "28:11",
          source: "html-node",
          fromBounds: { x: 209, y: 10, w: 60, h: 17 },
          toBounds: { x: 287, y: 10, w: 60, h: 17 }
        }),
        expect.objectContaining({
          nodeId: "28:35",
          source: "svg-asset",
          fromBounds: { x: 78, y: 6, w: 108, h: 26 },
          toBounds: { x: 79, y: 6, w: 185, h: 26 }
        })
      ])
    );
    expect(result.enter.map((node) => node.nodeId)).toContain("28:12");
    expect(result.exit.map((node) => node.nodeId)).toContain("28:99");
    expect(result.unresolved).toEqual(
      expect.arrayContaining([expect.objectContaining({ fromNodeId: "28:99" })])
    );

    const fromCss = createVisualTimelineCss(result, 0.5, "from");
    const toCss = createVisualTimelineCss(result, 0.5, "to");
    expect(fromCss).toContain('[data-node-id="28:32"]');
    expect(fromCss).toContain("transform:translate(39px,0px)");
    expect(toCss).toContain('[data-node-id="28:11"]{display:none!important;}');
    expect(toCss).toContain('[data-node-id="28:12"]{opacity:0.5');

    const intent = compileVisualMotionIntent("胶囊丝滑展开，状态文字错峰淡入");
    const composition = compileVisualMotionComposition({ from, to, bindingResult: result, intent });
    expect(composition.document.stage).toMatchObject({ mode: "custom", width: 583, height: 38 });
    expect(composition.document.layers.map((layer) => layer.id)).toContain("zero-visual-28-32");
    expect(composition.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "高保真形变",
          layerId: "zero-visual-28-32",
          initial: expect.objectContaining({ width: 60, height: 17, opacity: 1 }),
          animate: expect.objectContaining({ x: 78, y: 0, width: 60, height: 17, opacity: 1 })
        }),
        expect.objectContaining({
          label: "高保真进入",
          layerId: "zero-visual-28-12",
          initial: expect.objectContaining({ opacity: 0 })
        }),
        expect.objectContaining({
          label: "高保真退出",
          layerId: "zero-visual-28-99",
          animate: expect.objectContaining({ opacity: 0 })
        })
      ])
    );
    expect(composition.document.composition?.steps).toHaveLength(composition.steps.length);
    expect(composition.document.visualSource).toMatchObject({
      kind: "zero-visual-morph",
      from: { nodeId: "28:19" },
      to: { nodeId: "28:2" }
    });

    const visualHtml = exportCompositionHtml(composition.document.composition!, composition.document);
    expect(visualHtml).toContain("mc-zero-stage");
    expect(visualHtml).toContain("mc-progress");
    expect(visualHtml).toContain("--mc-zero-time");
    expect(visualHtml).toContain('data-node-id="28:32"');
    expect(visualHtml).toContain('data-node-id="28:11"');
    expect(visualHtml).toContain("mc-zero-match");
    expect(visualHtml).toContain("mc-zero-enter");
    expect(visualHtml).not.toContain("mc-comp-target");
    expect(visualHtml).not.toContain("background:#f6f8fa");
  });

  it("compiles natural language into visual motion intent parameters", () => {
    const intent = compileVisualMotionIntent("胶囊丝滑展开，状态文字错峰淡入，整体带一点弹性");

    expect(intent.durationMs).toBe(420);
    expect(intent.easing.type).toBe("spring");
    expect(intent.staggerMs).toBe(48);
    expect(intent.enter.opacityFrom).toBe(0);
    expect(intent.exit.opacityTo).toBe(0);

    const fast = compileVisualMotionIntent("快速干脆地切换");
    expect(fast.durationMs).toBe(220);
    expect(fast.easing).toMatchObject({ type: "classic", preset: "standard" });
  });

  it("prints complete ZeroVisualSnapshot fixtures from the local bridge command", () => {
    const script = rootPath("scripts/zero-visual-snapshot-fixture.mjs");
    const collapsed = normalizeZeroVisualSnapshot(
      JSON.parse(execFileSync(process.execPath, [script, "--node-id", "28:19"], { encoding: "utf8" }))
    );
    const expanded = normalizeZeroVisualSnapshot(
      JSON.parse(execFileSync(process.execPath, [script, "--node-id", "28:2"], { encoding: "utf8" }))
    );

    expect(collapsed.nodes.map((node) => node.nodeId)).toContain("28:43");
    expect(expanded.nodes.map((node) => node.nodeId)).toContain("28:18");
    expect(collapsed.nodes).toHaveLength(25);
    expect(expanded.nodes).toHaveLength(17);
    expect(collapsed.assets.length).toBeGreaterThanOrEqual(6);
    expect(expanded.assets.length).toBeGreaterThanOrEqual(3);
  });

  it("collects raw Zero MCP visual bundles through the external bridge wrapper", () => {
    const tempDir = mkdtempSync(resolve(tmpdir(), "zero-mcp-bridge-"));
    try {
      const toolScript = resolve(tempDir, "tool.mjs");
      writeFileSync(
        toolScript,
        `const tool = process.argv[2];
const nodeId = process.argv[4];
if (tool === "get_design_context") process.stdout.write(JSON.stringify({ tool, nodeId, text: "context" }));
else if (tool === "get_design_metadata") process.stdout.write(JSON.stringify({ tool, nodeId, text: "metadata" }));
else if (tool === "get_screenshot") process.stdout.write(JSON.stringify({ tool, nodeId, image_url: "http://localhost/shot.png" }));
else process.exit(2);`
      );

      const output = execFileSync(
        process.execPath,
        [rootPath("scripts/zero-mcp-visual-bridge.mjs"), "--node-id", "28:2"],
        {
          encoding: "utf8",
          env: {
            ...process.env,
            ZERO_MCP_TOOL_COMMAND: process.execPath,
            ZERO_MCP_TOOL_ARGS: `${toolScript} {tool} --node-id {nodeId}`
          }
        }
      );
      const payload = JSON.parse(output) as {
        nodeId: string;
        designContext: { tool: string; nodeId: string; text: string };
        designMetadata: { tool: string; nodeId: string; text: string };
        screenshot: { tool: string; nodeId: string; image_url: string };
      };

      expect(payload).toMatchObject({
        nodeId: "28:2",
        designContext: { tool: "get_design_context", nodeId: "28:2", text: "context" },
        designMetadata: { tool: "get_design_metadata", nodeId: "28:2", text: "metadata" },
        screenshot: { tool: "get_screenshot", nodeId: "28:2", image_url: "http://localhost/shot.png" }
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("collects raw Zero MCP visual bundles through the local HTTP MCP endpoint", async () => {
    const seenTools: string[] = [];
    const server = createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const payload = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
        params?: { name?: string; arguments?: { nodeId?: string; forceCode?: boolean; maxDimension?: number } };
      };
      const tool = payload.params?.name ?? "";
      seenTools.push(tool);
      const nodeId = payload.params?.arguments?.nodeId;
      const result =
        tool === "get_design_context"
          ? { content: [{ type: "text", text: "context" }], forceCode: payload.params?.arguments?.forceCode }
          : tool === "get_design_metadata"
            ? { content: [{ type: "text", text: "metadata" }] }
            : { content: [{ type: "text", text: JSON.stringify({ image_url: "http://localhost/shot.png", nodeId }) }] };
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      res.end(`event: message\ndata: ${JSON.stringify({ jsonrpc: "2.0", id: "test", result })}\n\n`);
    });

    try {
      await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      const output = await execFileText(
        process.execPath,
        [rootPath("scripts/zero-mcp-visual-bridge.mjs"), "--node-id", "28:2"],
        {
          ...process.env,
          ZERO_MCP_HTTP_URL: `http://127.0.0.1:${port}/mcp`
        }
      );
      const payload = JSON.parse(output) as {
        nodeId: string;
        designContext: { content: Array<{ text: string }>; forceCode: boolean };
        designMetadata: { content: Array<{ text: string }> };
        screenshot: { content: Array<{ text: string }> };
      };

      expect(payload.nodeId).toBe("28:2");
      expect(payload.designContext.forceCode).toBe(true);
      expect(payload.designContext.content[0]?.text).toBe("context");
      expect(payload.designMetadata.content[0]?.text).toBe("metadata");
      expect(payload.screenshot.content[0]?.text).toContain("shot.png");
      expect(seenTools.sort()).toEqual(["get_design_context", "get_design_metadata", "get_screenshot"]);
    } finally {
      await new Promise<void>((resolveClose, rejectClose) =>
        server.close((error) => (error ? rejectClose(error) : resolveClose()))
      );
    }
  });

  it("degrades to an empty screenshot when get_screenshot fails but render-essential tools succeed (bug B)", async () => {
    const seenTools: string[] = [];
    const server = createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const payload = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
        params?: { name?: string };
      };
      const tool = payload.params?.name ?? "";
      seenTools.push(tool);
      if (tool === "get_screenshot") {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("screenshot service unavailable");
        return;
      }
      const result =
        tool === "get_design_context"
          ? { content: [{ type: "text", text: "context" }] }
          : { content: [{ type: "text", text: "metadata" }] };
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      res.end(`event: message\ndata: ${JSON.stringify({ jsonrpc: "2.0", id: "test", result })}\n\n`);
    });

    try {
      await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      const output = await execFileText(
        process.execPath,
        [rootPath("scripts/zero-mcp-visual-bridge.mjs"), "--node-id", "28:2"],
        {
          ...process.env,
          ZERO_MCP_HTTP_URL: `http://127.0.0.1:${port}/mcp`,
          ZERO_MCP_BRIDGE_RETRY_DELAY_MS: "10"
        }
      );
      const payload = JSON.parse(output) as {
        nodeId: string;
        designContext: { content: Array<{ text: string }> };
        designMetadata: { content: Array<{ text: string }> };
        screenshot: unknown;
      };

      // Render-essential tools come through; the failed screenshot degrades to "" instead of aborting.
      expect(payload.nodeId).toBe("28:2");
      expect(payload.designContext.content[0]?.text).toBe("context");
      expect(payload.designMetadata.content[0]?.text).toBe("metadata");
      expect(payload.screenshot).toBe("");
      // All three tools are still attempted (test constraint), get_screenshot is retried before degrading.
      expect(new Set(seenTools)).toEqual(
        new Set(["get_design_context", "get_design_metadata", "get_screenshot"])
      );
      expect(seenTools.filter((tool) => tool === "get_screenshot").length).toBeGreaterThanOrEqual(2);
    } finally {
      await new Promise<void>((resolveClose, rejectClose) =>
        server.close((error) => (error ? rejectClose(error) : resolveClose()))
      );
    }
  });

  it("fails fast when get_design_context is unavailable because the morph cannot render without it (bug B)", async () => {
    const server = createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const payload = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
        params?: { name?: string };
      };
      const tool = payload.params?.name ?? "";
      if (tool === "get_design_context") {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("context service unavailable");
        return;
      }
      const result = { content: [{ type: "text", text: tool }] };
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      res.end(`event: message\ndata: ${JSON.stringify({ jsonrpc: "2.0", id: "test", result })}\n\n`);
    });

    try {
      await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      await expect(
        execFileText(process.execPath, [rootPath("scripts/zero-mcp-visual-bridge.mjs"), "--node-id", "28:2"], {
          ...process.env,
          ZERO_MCP_HTTP_URL: `http://127.0.0.1:${port}/mcp`,
          ZERO_MCP_BRIDGE_RETRY_DELAY_MS: "10"
        })
      ).rejects.toThrow(/get_design_context/);
    } finally {
      await new Promise<void>((resolveClose, rejectClose) =>
        server.close((error) => (error ? rejectClose(error) : resolveClose()))
      );
    }
  });
});

describe("Frame morph compilation", () => {
  it("matches stable elements and separates enter and exit elements", () => {
    const collapsed = normalizeFrameSnapshot(readFixture("info-collapsed"));
    const expanded = normalizeFrameSnapshot(readFixture("info-expanded"));

    const result = matchFrameElements(collapsed, expanded);

    expect(result.matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fromKey: "rect:status-pill", toKey: "rect:status-pill" }),
        expect.objectContaining({ fromKey: "text:continue-assign", toKey: "text:continue-assign" }),
        expect.objectContaining({ fromKey: "text:generate-prd", toKey: "text:generate-prd" })
      ])
    );
    expect(result.enter).toContain("text:status-pending-expanded");
    expect(result.enter).toContain("text:status-accepted-expanded");
    expect(result.enter).toContain("text:status-rejected-expanded");
    expect(result.exit).toContain("vector:status-pending-dot");
    expect(result.exit).toContain("text:status-pending-count");
  });

  it("compiles matched, enter, and exit tracks into a MorphPlan", () => {
    const collapsed = normalizeFrameSnapshot(readFixture("info-collapsed"));
    const expanded = normalizeFrameSnapshot(readFixture("info-expanded"));

    const plan = compileMorphPlan({ from: collapsed, to: expanded, durationMs: 360 });

    expect(plan).toMatchObject({
      schemaVersion: "motion-copilot.frame-morph.v1",
      fromFrameId: "28:19",
      toFrameId: "28:2",
      durationMs: 360,
      easing: { type: "classic", preset: "decelerate" }
    });

    const statusPill = plan.tracks.find((track) => track.id === "matched:rect:status-pill->rect:status-pill");
    expect(statusPill).toMatchObject({
      role: "matched",
      from: { x: 78, y: 6, w: 108, h: 26, opacity: 1, radius: 25, background: "#f3f3f3" },
      to: { x: 79, y: 6, w: 185, h: 26, opacity: 1, radius: 25, background: "#f3f3f3" }
    });

    const continueAssign = plan.tracks.find(
      (track) => track.id === "matched:text:continue-assign->text:continue-assign"
    );
    expect(continueAssign).toMatchObject({
      role: "matched",
      from: { x: 209, y: 10, text: "继续指派 >" },
      to: { x: 287, y: 10, text: "继续指派 >" }
    });

    const enter = plan.tracks.find((track) => track.id === "enter:text:status-pending-expanded");
    expect(enter).toMatchObject({
      role: "enter",
      from: { opacity: 0 },
      to: { opacity: 1, text: "待确认 2" }
    });

    const exit = plan.tracks.find((track) => track.id === "exit:text:status-pending-count");
    expect(exit).toMatchObject({
      role: "exit",
      from: { opacity: 1, text: "2" },
      to: { opacity: 0 }
    });
  });

  it("maps Zero frame differences into editable document layers and composition timeline steps", () => {
    const collapsed = normalizeFrameSnapshot(readFixture("info-collapsed"));
    const expanded = normalizeFrameSnapshot(readFixture("info-expanded"));

    const result = compileFrameMorphComposition({
      from: collapsed,
      to: expanded,
      prompt: "胶囊宽度丝滑展开，状态文字错峰淡入，整体带一点弹性"
    });

    expect(result.document.stage).toMatchObject({ mode: "custom", width: 583, height: 38 });
    expect(result.document.stage).toMatchObject({
      background: "transparent",
      backgroundFit: "fill",
      backgroundPosition: "center"
    });
    expect(result.document.stage.backgroundImage).toBeUndefined();
    expect(result.document.elements[0]).toMatchObject({ role: "background", initial: { opacity: 0 } });
    expect(result.document.selectedLayerId).toBeUndefined();
    expect(result.document.layers.map((layer) => layer.id)).toContain("zero-rect-status-pill");
    expect(result.document.layers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "zero-vector-assign-bg",
          name: "指派区域背景",
          style: expect.objectContaining({ background: "#ffffff" }),
          layout: expect.objectContaining({ zIndex: 3 })
        }),
        expect.objectContaining({
          id: "zero-vector-generate-prd-bg",
          name: "生成PRD按钮背景",
          style: expect.objectContaining({ background: "#ffffff" }),
          layout: expect.objectContaining({ zIndex: 20 })
        }),
        expect.objectContaining({
          id: "zero-vector-invite-architect-bg",
          name: "邀请主架构按钮背景",
          style: expect.objectContaining({ background: "#ffffff" }),
          layout: expect.objectContaining({ zIndex: 23 })
        }),
        expect.objectContaining({
          id: "zero-vector-status-accepted-dot",
          name: "已接受圆点",
          style: expect.objectContaining({ background: "#09ae28" }),
          layout: expect.objectContaining({ zIndex: 14 })
        }),
        expect.objectContaining({
          id: "zero-text-status-accepted-count",
          name: "1",
          layout: expect.objectContaining({ zIndex: 15 })
        })
      ])
    );
    expect(result.document.layers.every((layer) => layer.kind !== "group")).toBe(true);
    expect(result.document.composition?.steps).toHaveLength(result.steps.length);
    expect(result.document.composition?.totalDurationMs).toBeLessThanOrEqual(700);
    expect(result.steps.length).toBeGreaterThan(0);
    expect(result.steps.every((step) => step.target === "selected-layer" && step.layerId)).toBe(true);
    expect(result.steps.every((step) => step.fillMode === "both")).toBe(true);
    expect(result.intent.easing.type).toBe("spring");
    expect(result.intent.staggerMs).toBeGreaterThan(0);

    const statusPill = result.steps.find((step) => step.layerId === "zero-rect-status-pill");
    expect(statusPill).toMatchObject({
      presetId: "frame-morph-layout",
      label: "帧间形变",
      initial: { width: 108, height: 26, opacity: 1 },
      animate: { x: 1, y: 0, width: 185, height: 26, opacity: 1 }
    });

    const expandedText = result.steps.find((step) => step.layerId === "zero-text-status-pending-expanded");
    expect(expandedText).toMatchObject({
      label: "帧间进入",
      initial: { opacity: 0 },
      animate: { opacity: 1 }
    });
  });

  it("evaluates missing asset fallback and long duration issues", () => {
    const collapsed = normalizeFrameSnapshot(readFixture("info-collapsed"));
    const expanded = normalizeFrameSnapshot(readFixture("info-expanded"));
    const plan = compileMorphPlan({ from: collapsed, to: expanded, durationMs: 2400 });

    const issues = evaluateMorphPlan(plan, { from: collapsed, to: expanded });

    expect(issues.map((issue) => issue.id)).toContain("morph-duration-too-long");
    expect(issues.map((issue) => issue.id)).toContain("asset-fallback-missing-vector:assign-bg");
  });

  it("keeps weak matches unresolved instead of silently pairing them", () => {
    const from = normalizeFrameSnapshot({
      schemaVersion: "motion-copilot.frame-snapshot.v1",
      frameId: "from",
      name: "From",
      width: 100,
      height: 100,
      elements: [
        {
          key: "from-text",
          nodeId: "1:1",
          name: "A",
          kind: "text",
          x: 0,
          y: 0,
          w: 10,
          h: 10,
          opacity: 1,
          zIndex: 0,
          text: "A"
        }
      ]
    });
    const to = normalizeFrameSnapshot({
      schemaVersion: "motion-copilot.frame-snapshot.v1",
      frameId: "to",
      name: "To",
      width: 100,
      height: 100,
      elements: [
        {
          key: "to-text",
          nodeId: "2:1",
          name: "B",
          kind: "text",
          x: 90,
          y: 90,
          w: 10,
          h: 10,
          opacity: 1,
          zIndex: 0,
          text: "B"
        }
      ]
    });

    const result = matchFrameElements(from, to);

    expect(result.matches).toEqual([]);
    expect(result.enter).toEqual(["to-text"]);
    expect(result.exit).toEqual(["from-text"]);
    expect(result.unresolved).toEqual([expect.objectContaining({ fromKey: "from-text", toKey: "to-text" })]);
  });

  it("exports stable morph json and standalone html", () => {
    const collapsed = normalizeFrameSnapshot(readFixture("info-collapsed"));
    const expanded = normalizeFrameSnapshot(readFixture("info-expanded"));
    const plan = compileMorphPlan({ from: collapsed, to: expanded, durationMs: 360 });

    const json = exportMorphJson(plan);
    const payload = JSON.parse(json) as {
      schemaVersion: string;
      tracks: Array<{ id: string; role: string }>;
    };
    const html = exportMorphHtml(plan);

    expect(payload.schemaVersion).toBe("motion-copilot.frame-morph.v1");
    expect(payload.tracks.length).toBe(plan.tracks.length);
    expect(payload.tracks.map((track) => track.role)).toContain("enter");
    expect(payload.tracks.map((track) => track.role)).toContain("exit");
    expect(json).toContain("matched:rect:status-pill->rect:status-pill");

    expect(html).toContain("<!doctype html>");
    expect(html).toContain('data-from-frame="28:19"');
    expect(html).toContain('data-to-frame="28:2"');
    expect(html).toContain('data-track-id="matched:rect:status-pill-&gt;rect:status-pill"');
    expect(html).toContain('data-track-id="enter:text:status-pending-expanded"');
    expect(html).toContain('data-track-id="exit:text:status-pending-count"');
    expect(html).toContain("@media (prefers-reduced-motion: reduce)");
    expect(html).not.toContain("React");
    expect(html).not.toContain("localStorage");
    expect(html).not.toContain("fetch(");
  });

  it("runs the headless morph command with flags and config overrides", () => {
    const temp = mkdtempSync(resolve(tmpdir(), "motion-morph-"));
    try {
      const script = rootPath("scripts/motion-copilot-morph.mjs");
      const from = rootPath("fixtures/frames/info-collapsed.json");
      const to = rootPath("fixtures/frames/info-expanded.json");
      const out = resolve(temp, "plan.json");

      execFileSync("node", [script, "--from", from, "--to", to, "--out", out], { encoding: "utf8" });
      const payload = JSON.parse(readFileSync(out, "utf8")) as {
        schemaVersion: string;
        tracks: Array<{ id: string }>;
      };
      expect(payload.schemaVersion).toBe("motion-copilot.frame-morph.v1");
      expect(payload.tracks.map((track) => track.id)).toContain("matched:rect:status-pill->rect:status-pill");

      const configPath = resolve(temp, "job.json");
      const configOut = resolve(temp, "plan-config.json");
      writeFileSync(
        configPath,
        JSON.stringify(
          {
            from,
            to,
            out: configOut,
            pairs: [{ from: "text:status-pending-count", to: "text:status-pending-expanded" }],
            exclude: ["vector:status-pending-dot"],
            durationMs: 420
          },
          null,
          2
        )
      );
      execFileSync("node", [script, "--config", configPath], { encoding: "utf8" });
      const configured = JSON.parse(readFileSync(configOut, "utf8")) as {
        durationMs: number;
        tracks: Array<{ id: string }>;
      };
      expect(configured.durationMs).toBe(420);
      expect(configured.tracks.map((track) => track.id)).toContain(
        "matched:text:status-pending-count->text:status-pending-expanded"
      );
      expect(configured.tracks.map((track) => track.id)).not.toContain("exit:vector:status-pending-dot");
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });

  it("prints FrameSnapshot JSON from the default local Zero bridge fixture command", () => {
    const output = execFileSync(
      process.execPath,
      [rootPath("scripts/zero-frame-snapshot-fixture.mjs"), "--node-id", "28:19"],
      { encoding: "utf8" }
    );

    const snapshot = normalizeFrameSnapshot(JSON.parse(output) as unknown);
    expect(snapshot).toMatchObject({
      frameId: "28:19",
      name: "信息收起状态"
    });
  });

  it("creates endpoint visual check plans and evaluates screenshot diffs", () => {
    const collapsed = normalizeFrameSnapshot(readFixture("info-collapsed"));
    const expanded = normalizeFrameSnapshot(readFixture("info-expanded"));

    const plan = createMorphVisualCheckPlan({ from: collapsed, to: expanded }, { maxDifferenceRatio: 0.03 });

    expect(plan.issues).toEqual([]);
    expect(plan.checks).toEqual([
      expect.objectContaining({ frameId: "28:19", target: "from", maxDifferenceRatio: 0.03 }),
      expect.objectContaining({ frameId: "28:2", target: "to", maxDifferenceRatio: 0.03 })
    ]);
    expect(
      evaluateScreenshotDiff({ changedPixels: 20, totalPixels: 1000, maxDifferenceRatio: 0.03 })
    ).toMatchObject({
      passed: true,
      differenceRatio: 0.02
    });
    expect(
      evaluateScreenshotDiff({ changedPixels: 80, totalPixels: 1000, maxDifferenceRatio: 0.03 })
    ).toMatchObject({
      passed: false,
      differenceRatio: 0.08
    });

    expect(
      diffRgbaPixels({
        actual: [0, 0, 0, 255, 255, 255, 255, 255],
        expected: [0, 0, 0, 255, 240, 255, 255, 255],
        width: 2,
        height: 1,
        maxDifferenceRatio: 0.6,
        perChannelThreshold: 8
      })
    ).toMatchObject({
      passed: true,
      changedPixels: 1,
      totalPixels: 2,
      differenceRatio: 0.5
    });
  });

  it("stagger applies incremental delayMs to enter steps by enterIndex", () => {
    const from = normalizeZeroVisualSnapshot({
      schemaVersion: "motion-copilot.zero-visual-snapshot.v1",
      frameId: "stagger-from",
      nodeId: "stagger-from",
      name: "from",
      width: 200,
      height: 50,
      screenshotUrl: "data:image/png;base64,iVBOR",
      html: '<div data-node-id="stagger-from"><div data-node-id="a"></div></div>',
      css: "",
      assets: [],
      nodes: [
        { nodeId: "stagger-from", name: "root", kind: "group", bounds: { x: 0, y: 0, w: 200, h: 50 } },
        { nodeId: "a", name: "A", kind: "rect", bounds: { x: 0, y: 0, w: 50, h: 50 } }
      ]
    });
    const to = normalizeZeroVisualSnapshot({
      schemaVersion: "motion-copilot.zero-visual-snapshot.v1",
      frameId: "stagger-to",
      nodeId: "stagger-to",
      name: "to",
      width: 200,
      height: 50,
      screenshotUrl: "data:image/png;base64,iVBOR",
      html: '<div data-node-id="stagger-to"><div data-node-id="b"></div><div data-node-id="c"></div><div data-node-id="d"></div></div>',
      css: "",
      assets: [],
      nodes: [
        { nodeId: "stagger-to", name: "root", kind: "group", bounds: { x: 0, y: 0, w: 200, h: 50 } },
        { nodeId: "b", name: "B", kind: "rect", bounds: { x: 0, y: 0, w: 50, h: 50 } },
        { nodeId: "c", name: "C", kind: "rect", bounds: { x: 60, y: 0, w: 50, h: 50 } },
        { nodeId: "d", name: "D", kind: "rect", bounds: { x: 120, y: 0, w: 50, h: 50 } }
      ]
    });

    const bindingResult: VisualMotionBindingResult = {
      bindings: [],
      enter: to.nodes.filter((n) => n.kind !== "group"),
      exit: from.nodes.filter((n) => n.kind !== "group"),
      ignored: [],
      unresolved: []
    };

    const intent = compileVisualMotionIntent("逐个淡入");
    expect(intent.staggerMs).toBeGreaterThan(0);

    const composition = compileVisualMotionComposition({ from, to, bindingResult, intent });
    const enterSteps = composition.steps.filter((s) => s.label === "高保真进入");
    expect(enterSteps).toHaveLength(3);
    expect(enterSteps[0]!.delayMs).toBe(0);
    expect(enterSteps[1]!.delayMs).toBe(intent.staggerMs);
    expect(enterSteps[2]!.delayMs).toBe(intent.staggerMs * 2);
  });
});

describe("Real-device regressions", () => {
  it("converts display:contents on positioned Zero groups to display:block (bug A: child offsets bubble to frame)", () => {
    const snapshot = createZeroVisualSnapshotFromMcp({
      nodeId: "28:2",
      designContext: expandedZeroContext,
      designMetadata: expandedZeroMetadata,
      screenshot: { image_url: "http://localhost:27618/assets/img_2069969131263778818_28-2.png" }
    });

    // 组 490 (28:3) is `absolute contents left-[477px] top-0` in the Zero export. With
    // display:contents it generates no box, so its absolutely-positioned children (left:0)
    // resolve against the frame instead of the group's 477px offset — the visual distortion.
    // It MUST be emitted as a real positioned box so relative child offsets resolve correctly.
    const group490 = snapshot.html.match(/<div\b[^>]*data-node-id="28:3"[^>]*>/);
    expect(group490).toBeTruthy();
    const tag = group490![0];
    expect(tag).toContain("position:absolute");
    expect(tag).toContain("left:477px");
    expect(tag).toContain("display:block");
    expect(tag).not.toContain("display:contents");

    // Every positioned group in this fixture (28:2/28:3/28:6/28:9/28:16) must lose display:contents.
    expect(snapshot.html).not.toContain("display:contents");
  });

  it("expands snapshot bounds when children extend past the root node (bug 3)", () => {
    const overflowMetadata = `<group id="root" name="root" x="0" y="0" width="200" height="40">
  <rounded-rectangle id="child-left" name="左侧" x="0" y="0" width="120" height="40" />
  <rounded-rectangle id="child-right" name="右侧" x="180" y="0" width="80" height="40" />
</group>`;
    const overflowContext = `const imgAssetLeft = "http://localhost:27618/assets/left.svg";
const imgAssetRight = "http://localhost:27618/assets/right.svg";
export default function Component() {
  return (
    <div className="contents relative size-full" data-node-id="root" data-name="root">
      <div className="absolute left-0 top-0 w-[120px] h-[40px]" data-node-id="child-left">
        <img className="block max-w-none size-full" alt="" src={imgAssetLeft} />
      </div>
      <div className="absolute left-[180px] top-0 w-[80px] h-[40px]" data-node-id="child-right">
        <img className="block max-w-none size-full" alt="" src={imgAssetRight} />
      </div>
    </div>
  );
}`;

    const snapshot = createZeroVisualSnapshotFromMcp({
      nodeId: "root",
      designContext: overflowContext,
      designMetadata: overflowMetadata,
      screenshot: { image_url: "http://localhost:27618/assets/root.png" }
    });

    expect(snapshot.width).toBeGreaterThanOrEqual(260);
    expect(snapshot.height).toBeGreaterThanOrEqual(40);
    const rightNode = snapshot.nodes.find((node) => node.nodeId === "child-right");
    expect(rightNode).toBeDefined();
    if (rightNode) {
      expect(rightNode.bounds.x + rightNode.bounds.w).toBeLessThanOrEqual(snapshot.width);
    }
  });

  it("propagates Zero document order into proxy layer zIndex (bug 1)", () => {
    const from = normalizeZeroVisualSnapshot({
      schemaVersion: "motion-copilot.zero-visual-snapshot.v1",
      frameId: "from",
      nodeId: "from",
      name: "from",
      width: 400,
      height: 80,
      screenshotUrl: "http://localhost:27618/assets/from.png",
      html: '<div data-node-id="from"><span data-node-id="from-a">A</span><span data-node-id="from-b">B</span><span data-node-id="from-only">old</span></div>',
      css: "",
      assets: [],
      nodes: [
        { nodeId: "from", name: "from", kind: "group", bounds: { x: 0, y: 0, w: 400, h: 80 } },
        { nodeId: "from-a", name: "A", kind: "text", bounds: { x: 10, y: 10, w: 40, h: 20 }, text: "A" },
        { nodeId: "from-b", name: "B", kind: "text", bounds: { x: 60, y: 10, w: 40, h: 20 }, text: "B" },
        { nodeId: "from-only", name: "old", kind: "text", bounds: { x: 200, y: 10, w: 40, h: 20 }, text: "old" }
      ]
    });
    const to = normalizeZeroVisualSnapshot({
      schemaVersion: "motion-copilot.zero-visual-snapshot.v1",
      frameId: "to",
      nodeId: "to",
      name: "to",
      width: 400,
      height: 80,
      screenshotUrl: "http://localhost:27618/assets/to.png",
      html: '<div data-node-id="to"><span data-node-id="to-bg">背景</span><span data-node-id="from-a">A</span><span data-node-id="from-b">B</span><span data-node-id="to-new">new</span></div>',
      css: "",
      assets: [],
      nodes: [
        { nodeId: "to", name: "to", kind: "group", bounds: { x: 0, y: 0, w: 400, h: 80 } },
        { nodeId: "to-bg", name: "背景", kind: "text", bounds: { x: 0, y: 0, w: 400, h: 80 }, text: "背景" },
        { nodeId: "from-a", name: "A", kind: "text", bounds: { x: 10, y: 10, w: 40, h: 20 }, text: "A" },
        { nodeId: "from-b", name: "B", kind: "text", bounds: { x: 60, y: 10, w: 40, h: 20 }, text: "B" },
        { nodeId: "to-new", name: "new", kind: "text", bounds: { x: 300, y: 10, w: 40, h: 20 }, text: "new" }
      ]
    });

    const bindingResult = compileVisualMotionBindings(from, to);
    const intent = compileVisualMotionIntent("丝滑过渡");
    const composition = compileVisualMotionComposition({ from, to, bindingResult, intent });

    const sortedLayerIds = [...composition.document.layers]
      .filter((layer) => typeof layer.layout?.zIndex === "number")
      .sort((left, right) => (left.layout?.zIndex ?? 0) - (right.layout?.zIndex ?? 0))
      .map((layer) => layer.id);

    const indexOf = (id: string) => sortedLayerIds.indexOf(id);
    expect(indexOf("zero-visual-to-bg")).toBeGreaterThanOrEqual(0);
    expect(indexOf("zero-visual-to-bg")).toBeLessThan(indexOf("zero-visual-from-a"));
    expect(indexOf("zero-visual-from-a")).toBeLessThan(indexOf("zero-visual-from-b"));
    expect(indexOf("zero-visual-from-b")).toBeLessThan(indexOf("zero-visual-to-new"));
    expect(indexOf("zero-visual-from-only")).toBeGreaterThan(indexOf("zero-visual-to-new"));
  });

  it("keeps high-fidelity svg button backgrounds bindable (real-device regression)", () => {
    const collapsed = createZeroVisualSnapshotFromMcp({
      nodeId: "28:19",
      designContext: expandedZeroContext.replaceAll("28:2", "28:19"),
      designMetadata: expandedZeroMetadata.replaceAll('id="28:2"', 'id="28:19"'),
      screenshot: { image_url: "http://localhost:27618/assets/img_28-19.png" }
    });
    const expanded = createZeroVisualSnapshotFromMcp({
      nodeId: "28:2",
      designContext: expandedZeroContext,
      designMetadata: expandedZeroMetadata,
      screenshot: { image_url: "http://localhost:27618/assets/img_28-2.png" }
    });

    const result = compileVisualMotionBindings(collapsed, expanded);

    expect(collapsed.html).toContain('data-node-id="28:4"');
    expect(collapsed.html).toContain('src="http://localhost:27618/assets/svg_2069969131263778818_28-4.svg"');
    expect(result.bindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          nodeId: "28:4",
          toNodeId: "28:4",
          source: "svg-asset"
        }),
        expect.objectContaining({
          nodeId: "28:17",
          toNodeId: "28:17",
          source: "svg-asset"
        })
      ])
    );
  });

  it("carries rich style fields through MorphState (bug 2A)", () => {
    const richElement = {
      key: "rect:rich",
      nodeId: "rich",
      name: "rich",
      kind: "rect" as const,
      x: 0,
      y: 0,
      w: 100,
      h: 40,
      opacity: 1,
      zIndex: 1,
      text: "Hi",
      style: {
        background: "#fff",
        color: "#000",
        borderColor: "#1677ff",
        borderWidth: 2,
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        fontSize: 14,
        fontWeight: 600,
        fontFamily: "PingFang SC",
        lineHeight: 18,
        textDecoration: "underline",
        radius: 6
      }
    };
    const baseSnapshot = {
      schemaVersion: "motion-copilot.frame-snapshot.v1" as const,
      frameId: "rich-from",
      name: "rich-from",
      width: 200,
      height: 100,
      elements: [richElement]
    };
    const from = normalizeFrameSnapshot(baseSnapshot);
    const to = normalizeFrameSnapshot({
      ...baseSnapshot,
      frameId: "rich-to",
      name: "rich-to",
      elements: [
        {
          ...richElement,
          x: 50,
          style: { ...richElement.style, fontSize: 18, borderWidth: 3 }
        }
      ]
    });

    const plan = compileMorphPlan({ from, to });
    const track = plan.tracks.find((item) => item.role === "matched");
    expect(track).toBeDefined();
    expect(track?.from).toMatchObject({
      borderColor: "#1677ff",
      borderWidth: 2,
      boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
      fontSize: 14,
      fontWeight: 600,
      fontFamily: "PingFang SC",
      lineHeight: 18,
      textDecoration: "underline"
    });
    expect(track?.to).toMatchObject({ fontSize: 18, borderWidth: 3 });
  });

  it("keeps groups with borders or shadows visible after compilation (bug 2C)", () => {
    const fromSnapshot: FrameSnapshot = normalizeFrameSnapshot({
      schemaVersion: "motion-copilot.frame-snapshot.v1",
      frameId: "g-from",
      name: "g-from",
      width: 200,
      height: 80,
      elements: [
        {
          key: "group:card",
          nodeId: "card",
          name: "卡片",
          kind: "group",
          x: 0,
          y: 0,
          w: 200,
          h: 80,
          opacity: 1,
          zIndex: 1,
          style: { borderColor: "#dddddd", borderWidth: 1, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }
        }
      ]
    });
    const toSnapshot: FrameSnapshot = normalizeFrameSnapshot({
      ...fromSnapshot,
      frameId: "g-to",
      name: "g-to",
      elements: fromSnapshot.elements.map((element) => ({ ...element, x: 10 }))
    });

    const result = compileFrameMorphComposition({ from: fromSnapshot, to: toSnapshot, prompt: "" });
    const cardLayer = result.document.layers.find((layer) => layer.id === "zero-group-card");
    expect(cardLayer).toBeDefined();
    expect(cardLayer?.style).toMatchObject({ borderColor: "#dddddd", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" });
  });

  it("propagates border-radius from MCP metadata, SVG rx, and Tailwind tokens into snapshot css (bug 1 radius)", () => {
    const metadataXml = `<group id="root" name="root" x="0" y="0" width="220" height="40">
  <rounded-rectangle id="pill-meta" name="metadata-pill" x="0" y="0" width="100" height="40" cornerRadius="20" />
  <rounded-rectangle id="pill-svg" name="svg-pill" x="110" y="0" width="100" height="40" />
  <rounded-rectangle id="pill-tw" name="tailwind-pill" x="0" y="0" width="100" height="40" />
</group>`;
    const svgRectRx = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40"><rect width="100" height="40" rx="84" fill="#eee"/></svg>');
    const designContext = `const imgPillSvg = "data:image/svg+xml,${svgRectRx}";
export default function Component() {
  return (
    <div className="contents relative size-full" data-node-id="root" data-name="root">
      <div className="absolute left-0 top-0 w-[100px] h-[40px]" data-node-id="pill-meta" />
      <div className="absolute left-[110px] top-0 w-[100px] h-[40px]" data-node-id="pill-svg">
        <img className="block max-w-none size-full" alt="" src={imgPillSvg} />
      </div>
      <div className="absolute left-0 top-0 w-[100px] h-[40px] rounded-full" data-node-id="pill-tw" />
    </div>
  );
}`;

    const snapshot = createZeroVisualSnapshotFromMcp({
      nodeId: "root",
      designContext,
      designMetadata: metadataXml,
      screenshot: { image_url: "http://localhost:27618/assets/root.png" }
    });

    expect(snapshot.css).toContain('[data-node-id="pill-meta"]{border-radius:20px;}');
    expect(snapshot.css).toContain('[data-node-id="pill-svg"]{border-radius:84px;}');
    expect(snapshot.html).toContain("border-radius:9999px");
  });
});

describe("Restoration report", () => {
  it("detects SVG background loss in vector elements", () => {
    const from = readFixture("info-collapsed") as FrameSnapshot;
    const to = readFixture("info-expanded") as FrameSnapshot;
    const matchResult = matchFrameElements(from, to);
    const report = createRestorationReport({ from, to, bindings: matchResult });

    const svgBgIssues = report.issues.filter(
      (i) => i.category === "style" && i.field === "background" && i.source === "conversion-lost"
    );
    expect(svgBgIssues.length).toBeGreaterThan(0);
    expect(svgBgIssues[0]!.title).toContain("SVG");
    expect(svgBgIssues[0]!.nodeId).toBeDefined();
  });

  it("detects radius without background as warning", () => {
    const from: FrameSnapshot = {
      schemaVersion: "motion-copilot.frame-snapshot.v1",
      frameId: "test:1",
      name: "test",
      width: 100,
      height: 100,
      elements: [
        {
          key: "rect:solo-radius",
          nodeId: "n1",
          name: "圆角容器",
          kind: "rect",
          x: 0, y: 0, w: 50, h: 50,
          opacity: 1, zIndex: 1,
          style: { radius: 12 }
        }
      ]
    };
    const to: FrameSnapshot = { ...from, frameId: "test:2" };
    const matchResult = matchFrameElements(from, to);
    const report = createRestorationReport({ from, to, bindings: matchResult });

    const radiusIssues = report.issues.filter((i) => i.field === "radius");
    expect(radiusIssues.length).toBe(1);
    expect(radiusIssues[0]!.severity).toBe("warning");
    expect(radiusIssues[0]!.source).toBe("conversion-lost");
  });

  it("detects layer order inversion from binding bounds", () => {
    const from: FrameSnapshot = {
      schemaVersion: "motion-copilot.frame-snapshot.v1",
      frameId: "test:1",
      name: "test",
      width: 300,
      height: 300,
      elements: [
        { key: "a", nodeId: "n1", name: "A", kind: "rect", x: 0, y: 0, w: 100, h: 50, opacity: 1, zIndex: 1 },
        { key: "b", nodeId: "n2", name: "B", kind: "rect", x: 0, y: 100, w: 100, h: 50, opacity: 1, zIndex: 2 }
      ]
    };
    const to: FrameSnapshot = {
      schemaVersion: "motion-copilot.frame-snapshot.v1",
      frameId: "test:2",
      name: "test",
      width: 300,
      height: 300,
      elements: [
        { key: "a", nodeId: "n1", name: "A", kind: "rect", x: 0, y: 200, w: 100, h: 50, opacity: 1, zIndex: 1 },
        { key: "b", nodeId: "n2", name: "B", kind: "rect", x: 0, y: 0, w: 100, h: 50, opacity: 1, zIndex: 2 }
      ]
    };
    const matchResult = matchFrameElements(from, to);
    const report = createRestorationReport({ from, to, bindings: matchResult });
    expect(report.metrics.layerOrderConfidence.value).toBeLessThan(100);
  });

  it("reports low-confidence matches as issues", () => {
    const from = readFixture("info-collapsed") as FrameSnapshot;
    const to = readFixture("info-expanded") as FrameSnapshot;
    const matchResult = matchFrameElements(from, to);
    const report = createRestorationReport({ from, to, bindings: matchResult });

    const lowConfIssues = report.issues.filter((i) => i.category === "match" && i.title.includes("低置信度"));
    if (matchResult.matches.some((m) => m.confidence < 60)) {
      expect(lowConfIssues.length).toBeGreaterThan(0);
    }
  });

  it("computes valid score between 0-100 with all metrics", () => {
    const from = readFixture("info-collapsed") as FrameSnapshot;
    const to = readFixture("info-expanded") as FrameSnapshot;
    const matchResult = matchFrameElements(from, to);
    const report = createRestorationReport({ from, to, bindings: matchResult });

    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
    expect(report.inputHash).toBeTruthy();
    expect(report.bindingHash).toBeTruthy();
    expect(report.generatedAt).toBeTruthy();
    expect(report.metrics.nodeCoverage.weight).toBe(30);
    expect(report.metrics.styleCoverage.weight).toBe(25);
    expect(report.metrics.layerOrderConfidence.weight).toBe(20);
    expect(report.metrics.matchConfidence.weight).toBe(15);
    expect(report.metrics.visualRisk.weight).toBe(10);
  });

  it("generates issue source for each issue type", () => {
    const from = readFixture("info-collapsed") as FrameSnapshot;
    const to = readFixture("info-expanded") as FrameSnapshot;
    const matchResult = matchFrameElements(from, to);
    const report = createRestorationReport({ from, to, bindings: matchResult });

    for (const issue of report.issues) {
      expect(["input-missing", "conversion-lost", "render-risk", "user-change"]).toContain(issue.source);
      expect(["node", "style", "layer-order", "match", "asset", "export"]).toContain(issue.category);
    }
  });
});

describe("Frame Object Model", () => {
  it("classifies text elements as text objects", () => {
    const snapshot = readFixture("info-collapsed") as FrameSnapshot;
    const model = buildFrameObjectModel(snapshot);

    const allObjects = flattenAll(model.objects);
    const textObjects = allObjects.filter((o) => o.kind === "text");
    expect(textObjects.length).toBeGreaterThan(0);
    for (const obj of textObjects) {
      expect(obj.nodeIds.length).toBeGreaterThan(0);
      expect(obj.confidence).toBeGreaterThanOrEqual(80);
    }
  });

  it("classifies group elements with children as containers", () => {
    const snapshot = readFixture("info-collapsed") as FrameSnapshot;
    const model = buildFrameObjectModel(snapshot);

    const containers = model.objects.filter((o) => o.kind === "container");
    expect(containers.length).toBeGreaterThan(0);
    for (const c of containers) {
      expect(c.children.length).toBeGreaterThanOrEqual(0);
      expect(c.bounds.w).toBeGreaterThan(0);
    }
  });

  it("classifies vector/image elements as assets", () => {
    const snapshot = readFixture("info-collapsed") as FrameSnapshot;
    const model = buildFrameObjectModel(snapshot);

    const allObjects = flattenAll(model.objects);
    const assets = allObjects.filter((o) => o.kind === "asset");
    expect(assets.length).toBeGreaterThan(0);
  });

  it("generates readable names avoiding generic patterns like '文字 159'", () => {
    const snapshot = readFixture("info-collapsed") as FrameSnapshot;
    const model = buildFrameObjectModel(snapshot);

    const allObjects = flattenAll(model.objects);
    const textObjects = allObjects.filter((o) => o.kind === "text");
    for (const obj of textObjects) {
      expect(obj.name).not.toMatch(/^文字\s*\d+$/);
    }
  });

  it("resolves all nodes (no unresolved nodes for standard fixture)", () => {
    const snapshot = readFixture("info-collapsed") as FrameSnapshot;
    const model = buildFrameObjectModel(snapshot);

    expect(model.frameId).toBe(snapshot.frameId);
    const totalNodes = snapshot.elements.length;
    const resolvedCount = flattenAll(model.objects).reduce((s, o) => s + o.nodeIds.length, 0);
    expect(resolvedCount).toBe(totalNodes);
    expect(model.unresolvedNodeIds).toHaveLength(0);
  });

  it("works with ZeroVisualSnapshot input", () => {
    const zeroSnap: import("../src").ZeroVisualSnapshot = {
      schemaVersion: "motion-copilot.zero-visual-snapshot.v1",
      frameId: "test-1",
      nodeId: "root",
      name: "Test Frame",
      width: 400,
      height: 300,
      screenshotUrl: "https://example.com/shot.png",
      html: "<div></div>",
      css: "",
      assets: [],
      nodes: [
        { nodeId: "n1", name: "容器", kind: "group", bounds: { x: 0, y: 0, w: 400, h: 300 } },
        { nodeId: "n2", name: "标题", kind: "text", bounds: { x: 10, y: 10, w: 100, h: 20 }, text: "Hello" },
        { nodeId: "n3", name: "图标", kind: "image", bounds: { x: 350, y: 10, w: 30, h: 30 } }
      ]
    };
    const model = buildFrameObjectModel(zeroSnap);
    expect(model.frameId).toBe("test-1");
    expect(model.objects.length).toBeGreaterThan(0);

    const allObjects = flattenAll(model.objects);
    const kinds = new Set(allObjects.map((o) => o.kind));
    expect(kinds.has("text") || kinds.has("container") || kinds.has("asset")).toBe(true);
  });

  it("completes within 50ms for large fixture (performance)", () => {
    const snapshot = readFixture("info-collapsed") as FrameSnapshot;
    const bigSnapshot: FrameSnapshot = {
      ...snapshot,
      elements: []
    };
    for (let i = 0; i < 1000; i++) {
      bigSnapshot.elements.push({
        key: `el-${i}`,
        nodeId: `node-${i}`,
        ...(i > 0 && i % 10 !== 0 ? { parentKey: `el-${Math.floor(i / 10) * 10}` } : {}),
        name: i % 3 === 0 ? `文字 ${i}` : i % 3 === 1 ? `矩形 ${i}` : `图片 ${i}`,
        kind: i % 3 === 0 ? "text" : i % 3 === 1 ? "rect" : "image",
        x: (i % 20) * 50,
        y: Math.floor(i / 20) * 40,
        w: 45,
        h: 35,
        opacity: 1,
        zIndex: i,
        ...(i % 3 === 0 ? { text: `文本内容${i}` } : {}),
        ...(i % 3 === 1 ? { style: { background: "#eee", radius: 4 } } : {})
      });
    }

    const start = performance.now();
    const model = buildFrameObjectModel(bigSnapshot);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(50);
    expect(model.objects.length).toBeGreaterThan(0);
  });
});

function flattenAll(objects: Array<{ children: Array<any>; [k: string]: any }>): Array<any> {
  const result: Array<any> = [];
  for (const obj of objects) {
    result.push(obj);
    if (obj.children?.length) result.push(...flattenAll(obj.children));
  }
  return result;
}

describe("Visual QA: export report embedding and key-frame validation", () => {
  function makeVisualSnap(id: string, name: string, nodes: Array<{ nodeId: string; kind: string; text?: string }>): ZeroVisualSnapshot {
    return {
      schemaVersion: "motion-copilot.zero-visual-snapshot.v1",
      frameId: `frame:${id}`,
      nodeId: id,
      name,
      width: 200,
      height: 100,
      screenshotUrl: "data:image/png;base64,iVBOR",
      html: `<div data-node-id="${nodes[0]?.nodeId ?? "n1"}"></div>`,
      css: ".test { color: red; }",
      assets: [],
      nodes: nodes.map((n, i) => ({
        nodeId: n.nodeId,
        kind: n.kind as any,
        name: n.text ?? `node-${i}`,
        bounds: { x: i * 50, y: 0, w: 50, h: 50 },
        ...(n.text ? { text: n.text } : {})
      }))
    };
  }

  it("exportVisualCompositionHtml embeds motion-report JSON when cache exists", () => {
    const from = makeVisualSnap("1", "首帧", [{ nodeId: "a", kind: "text", text: "hello" }]);
    const to = makeVisualSnap("2", "尾帧", [{ nodeId: "b", kind: "text", text: "world" }]);
    const bindings = compileVisualMotionBindings(from, to);
    const intent = compileVisualMotionIntent("淡入");
    const composition = compileVisualMotionComposition({ from, to, bindingResult: bindings, intent });
    const report = createRestorationReport({ from, to, bindings });
    if (composition.document.visualSource?.kind === "zero-visual-morph") {
      composition.document.visualSource.restorationReportCache = {
        report,
        inputHash: report.inputHash,
        bindingHash: report.bindingHash,
        generatedAt: report.generatedAt
      };
    }
    const html = exportCompositionHtml(composition.document.composition!, composition.document);
    expect(html).toContain('id="motion-report"');
    expect(html).toContain('"score"');
    const reportMatch = html.match(/<script type="application\/json" id="motion-report">(.+?)<\/script>/s);
    expect(reportMatch).toBeTruthy();
    const reportContent = reportMatch![1]!;
    expect(reportContent).not.toContain("</");
    const parsed = JSON.parse(reportContent.replaceAll("<\\/", "</"));
    expect(parsed.score).toBeTypeOf("number");
    expect(parsed.metrics).toBeDefined();
  });

  it("exportVisualCompositionHtml does NOT embed report when cache is absent", () => {
    const from = makeVisualSnap("1", "首帧", [{ nodeId: "a", kind: "text", text: "hello" }]);
    const to = makeVisualSnap("2", "尾帧", [{ nodeId: "b", kind: "text", text: "world" }]);
    const bindings = compileVisualMotionBindings(from, to);
    const intent = compileVisualMotionIntent("淡入");
    const composition = compileVisualMotionComposition({ from, to, bindingResult: bindings, intent });
    const html = exportCompositionHtml(composition.document.composition!, composition.document);
    expect(html).not.toContain('id="motion-report"');
  });

  it("mid-progress frame at 0.5 has distinct CSS state from first frame", () => {
    const from = makeVisualSnap("1", "首帧", [
      { nodeId: "a", kind: "text", text: "start" },
      { nodeId: "b", kind: "rect" }
    ]);
    const to = makeVisualSnap("2", "尾帧", [
      { nodeId: "c", kind: "text", text: "end" },
      { nodeId: "d", kind: "rect" }
    ]);
    const bindings = compileVisualMotionBindings(from, to);
    const cssAt0 = createVisualTimelineCss(bindings, 0, "from");
    const cssAt05 = createVisualTimelineCss(bindings, 0.5, "from");
    const cssAt1 = createVisualTimelineCss(bindings, 1, "from");
    expect(cssAt0).not.toBe(cssAt05);
    expect(cssAt05).not.toBe(cssAt1);
  });

  it("report hash changes when userOverrides are added", () => {
    const from = makeVisualSnap("1", "首帧", [{ nodeId: "a", kind: "text" }]);
    const to = makeVisualSnap("2", "尾帧", [{ nodeId: "b", kind: "text" }]);
    const bindings = compileVisualMotionBindings(from, to);
    const r1 = createRestorationReport({ from, to, bindings });
    const r2 = createRestorationReport({ from, to, bindings, userOverrides: [{ fromNodeId: "a", action: "ignore" }] });
    expect(r1.bindingHash).not.toBe(r2.bindingHash);
    expect(r1.inputHash).toBe(r2.inputHash);
  });

  it("report hash changes when html/css/assets change", () => {
    const from1 = makeVisualSnap("1", "首帧", [{ nodeId: "a", kind: "text" }]);
    const to1 = makeVisualSnap("2", "尾帧", [{ nodeId: "b", kind: "text" }]);
    const from2 = { ...from1, html: "<div>changed</div>" };
    const bindings1 = compileVisualMotionBindings(from1, to1);
    const bindings2 = compileVisualMotionBindings(from2, to1);
    const r1 = createRestorationReport({ from: from1, to: to1, bindings: bindings1 });
    const r2 = createRestorationReport({ from: from2, to: to1, bindings: bindings2 });
    expect(r1.inputHash).not.toBe(r2.inputHash);
  });

  it("stores high-fidelity node overrides on visualSource without mutating snapshots", () => {
    const from = makeVisualSnap("1", "首帧", [{ nodeId: "a", kind: "text", text: "start" }]);
    const to = makeVisualSnap("2", "尾帧", [{ nodeId: "b", kind: "text", text: "end" }]);
    const bindings = compileVisualMotionBindings(from, to);
    const intent = compileVisualMotionIntent("淡入");
    const composition = compileVisualMotionComposition({ from, to, bindingResult: bindings, intent });

    if (composition.document.visualSource?.kind !== "zero-visual-morph") {
      throw new Error("expected zero-visual-morph source");
    }

    composition.document.visualSource.nodeOverrides = [
      { nodeId: "a", x: 12, y: 8, width: 88, height: 24, radius: 6, opacity: 0.72 }
    ];

    expect(composition.document.visualSource.nodeOverrides).toEqual([
      { nodeId: "a", x: 12, y: 8, width: 88, height: 24, radius: 6, opacity: 0.72 }
    ]);
    expect(composition.document.visualSource.from.nodes.find((node) => node.nodeId === "a")?.bounds).toEqual({
      x: 0,
      y: 0,
      w: 50,
      h: 50
    });
  });

  it("creates scoped CSS for high-fidelity node overrides", () => {
    const css = createZeroVisualNodeOverrideCss([
      { nodeId: "28:12", x: 10, y: 20, width: 120, height: 32, radius: 16, opacity: 0.5 }
    ]);

    expect(css).toContain('[data-node-id="28:12"]');
    expect(css).toContain("left:10px!important;");
    expect(css).toContain("top:20px!important;");
    expect(css).toContain("width:120px!important;");
    expect(css).toContain("height:32px!important;");
    expect(css).toContain("border-radius:16px!important;");
    expect(css).toContain("opacity:0.5!important;");
  });

  it("scales contained nodes when a high-fidelity group override changes component size", () => {
    const css = createZeroVisualNodeOverrideCss(
      [{ nodeId: "group", x: 200, y: 100, width: 200, height: 100, radius: 12 }],
      [
        {
          nodeId: "group",
          kind: "group",
          bounds: { x: 100, y: 50, w: 100, h: 50 }
        },
        {
          nodeId: "label",
          kind: "text",
          bounds: { x: 110, y: 60, w: 20, h: 10 }
        }
      ]
    );

    expect(css).toContain(
      '[data-node-id="group"]{position:absolute!important;display:block!important;box-sizing:border-box!important;left:200px!important;top:100px!important;width:200px!important;height:100px!important;border-radius:12px!important;overflow:hidden!important;}'
    );
    expect(css).toContain(
      '[data-node-id="label"]{position:absolute!important;display:block!important;box-sizing:border-box!important;left:220px!important;top:120px!important;width:40px!important;height:20px!important;}'
    );
  });

  it("exportVisualCompositionHtml embeds high-fidelity node override CSS", () => {
    const from = makeVisualSnap("1", "首帧", [{ nodeId: "a", kind: "text", text: "start" }]);
    const to = makeVisualSnap("2", "尾帧", [{ nodeId: "b", kind: "text", text: "end" }]);
    const bindings = compileVisualMotionBindings(from, to);
    const intent = compileVisualMotionIntent("淡入");
    const composition = compileVisualMotionComposition({ from, to, bindingResult: bindings, intent });

    if (composition.document.visualSource?.kind !== "zero-visual-morph") {
      throw new Error("expected zero-visual-morph source");
    }
    composition.document.visualSource.nodeOverrides = [{ nodeId: "a", x: 16, width: 96, radius: 8 }];

    const html = exportCompositionHtml(composition.document.composition!, composition.document);
    expect(html).toContain(
      '[data-node-id="a"]{left:16px!important;width:96px!important;border-radius:8px!important;}'
    );
  });
});

describe("P12 E2E regression: 28:19 → 28:2 full pipeline", () => {
  function loadFixture(nodeId: string): ZeroVisualSnapshot {
    const script = rootPath("scripts/zero-visual-snapshot-fixture.mjs");
    const output = execFileSync("node", [script, "--node-id", nodeId], { encoding: "utf8" });
    return normalizeZeroVisualSnapshot(JSON.parse(output));
  }

  it("generates timeline from rich fixture with correct binding structure", () => {
    const from = loadFixture("28:19");
    const to = loadFixture("28:2");
    expect(from.nodes.length).toBeGreaterThan(10);
    expect(to.nodes.length).toBeGreaterThan(10);

    const bindings = compileVisualMotionBindings(from, to);
    expect(bindings.bindings.length).toBeGreaterThan(0);
    expect(bindings.enter.length + bindings.exit.length + bindings.unresolved.length).toBeGreaterThan(0);

    const intent = compileVisualMotionIntent("胶囊宽度展开，状态文字错峰淡入");
    const composition = compileVisualMotionComposition({ from, to, bindingResult: bindings, intent });
    expect(composition.document.visualSource?.kind).toBe("zero-visual-morph");
    expect(composition.steps.length).toBeGreaterThan(0);
    expect(composition.document.composition?.steps.length).toBe(composition.steps.length);
  });

  it("produces standalone-playable export HTML with all required elements", () => {
    const from = loadFixture("28:19");
    const to = loadFixture("28:2");
    const bindings = compileVisualMotionBindings(from, to);
    const intent = compileVisualMotionIntent("胶囊宽度展开");
    const composition = compileVisualMotionComposition({ from, to, bindingResult: bindings, intent });

    const report = createRestorationReport({ from, to, bindings });
    if (composition.document.visualSource?.kind === "zero-visual-morph") {
      composition.document.visualSource.restorationReportCache = {
        report,
        inputHash: report.inputHash,
        bindingHash: report.bindingHash,
        generatedAt: report.generatedAt
      };
    }

    const html = exportCompositionHtml(composition.document.composition!, composition.document);
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("mc-zero-stage");
    expect(html).toContain("mc-progress");
    expect(html).toContain("data-total-duration");
    expect(html).toContain("mc-zero-from");
    expect(html).toContain("mc-zero-to");
    expect(html).toContain('id="motion-report"');
    expect(html).toContain("data-node-id");
    expect(html.length).toBeGreaterThan(2000);
  });

  it("fades out ignored collapsed-status fragments in the exported standalone HTML", () => {
    const from = loadFixture("28:19");
    const to = loadFixture("28:2");
    const bindings = compileVisualMotionBindings(from, to);
    expect((bindings.ignored ?? []).length).toBeGreaterThan(0);

    const intent = compileVisualMotionIntent("胶囊宽度展开，状态文字错峰淡入");
    const composition = compileVisualMotionComposition({ from, to, bindingResult: bindings, intent });
    const html = exportCompositionHtml(composition.document.composition!, composition.document);

    for (const item of bindings.ignored ?? []) {
      const selector = `.mc-zero-from [data-node-id="${item.nodeId}"]`;
      expect(html).toContain(selector);
      const ruleLine = html.split("\n").find((line) => line.includes(selector) && line.includes("animation:"));
      expect(ruleLine, `expected fade animation for ignored node ${item.nodeId}`).toBeTruthy();
    }
    // Each ignored fragment must end fully transparent in its keyframe.
    expect(html).toContain("opacity:0;}");
  });

  it("timeline CSS varies across progress 0 → 0.5 → 1", () => {
    const from = loadFixture("28:19");
    const to = loadFixture("28:2");
    const bindings = compileVisualMotionBindings(from, to);

    const css0 = createVisualTimelineCss(bindings, 0, "from");
    const css50 = createVisualTimelineCss(bindings, 0.5, "from");
    const css100 = createVisualTimelineCss(bindings, 1, "from");
    expect(css0).not.toBe(css50);
    expect(css50).not.toBe(css100);
    expect(css0).not.toBe(css100);
  });

  it("fades out collapsed-status-fragment ignored nodes in the from-layer (first-frame 渐隐)", () => {
    const from = loadFixture("28:19");
    const to = loadFixture("28:2");
    const bindings = compileVisualMotionBindings(from, to);

    // Real device produces exit=0 but several ignored collapsed-status-fragment
    // nodes; those first-frame-only fragments must fade out instead of staying opaque.
    expect((bindings.ignored ?? []).length).toBeGreaterThan(0);

    const fromAt50 = createVisualTimelineCss(bindings, 0.5, "from");
    const fromAt100 = createVisualTimelineCss(bindings, 1, "from");
    for (const item of bindings.ignored ?? []) {
      expect(fromAt50).toContain(`[data-node-id="${item.nodeId}"]{opacity:0.5!important;`);
      expect(fromAt100).toContain(`[data-node-id="${item.nodeId}"]`);
      const ruleAt100 = fromAt100
        .split("\n")
        .find((line) => line.startsWith(`[data-node-id="${item.nodeId}"]`));
      expect(ruleAt100).toContain("display:none!important;");
    }

    // The live stage plays through the track variant, so it must fade them too.
    const intent = compileVisualMotionIntent("胶囊宽度展开，状态文字错峰淡入");
    const composition = compileVisualMotionComposition({ from, to, bindingResult: bindings, intent });
    const track = composition.document.composition!;
    const trackFromAt50 = createVisualTimelineCssForTrack(bindings, track, 0.5, "from");
    const trackFromAt100 = createVisualTimelineCssForTrack(bindings, track, 1, "from");
    for (const item of bindings.ignored ?? []) {
      const ruleAt50 = trackFromAt50
        .split("\n")
        .find((line) => line.startsWith(`[data-node-id="${item.nodeId}"]`));
      expect(ruleAt50).toContain("opacity:0.5!important;");
      const ruleAt100 = trackFromAt100
        .split("\n")
        .find((line) => line.startsWith(`[data-node-id="${item.nodeId}"]`));
      expect(ruleAt100).toContain("display:none!important;");
    }
  });

  it("restoration report identifies known issues in status bar fixture", () => {
    const from = loadFixture("28:19");
    const to = loadFixture("28:2");
    const bindings = compileVisualMotionBindings(from, to);
    const report = createRestorationReport({ from, to, bindings });
    const statusFragmentNodeIds = ["28:36", "28:37", "28:39", "28:40", "28:42", "28:43"];

    expect(report.score).toBeGreaterThanOrEqual(85);
    expect(report.score).toBeLessThanOrEqual(100);
    expect(bindings.exit.map((node) => node.nodeId)).not.toEqual(expect.arrayContaining(statusFragmentNodeIds));
    expect(bindings.ignored).toEqual(
      expect.arrayContaining(
        statusFragmentNodeIds.map((nodeId) =>
          expect.objectContaining({
            nodeId,
            reason: "collapsed-status-fragment"
          })
        )
      )
    );
    for (const nodeId of statusFragmentNodeIds) {
      expect(report.issues).not.toEqual(expect.arrayContaining([expect.objectContaining({ nodeId })]));
    }
    expect(bindings.bindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          nodeId: "28:34",
          toNodeId: "28:12",
          confidence: expect.any(Number),
          reasons: expect.arrayContaining(["pill-background"])
        })
      ])
    );
    expect(bindings.bindings.find((binding) => binding.nodeId === "28:34")?.confidence).toBeGreaterThanOrEqual(75);
    expect(report.metrics.nodeCoverage.value).toBeTypeOf("number");
    expect(report.metrics.nodeCoverage.value).toBeGreaterThanOrEqual(80);
    expect(report.metrics.visualRisk.value).toBeTypeOf("number");
    expect(report.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(report.inputHash).toBeTruthy();
    expect(report.bindingHash).toBeTruthy();
  });
});

describe("inlineZeroVisualAssets", () => {
  it("replaces http URLs with data URIs in html and assets", async () => {
    const snapshot = normalizeZeroVisualSnapshot({
      schemaVersion: "motion-copilot.zero-visual-snapshot.v1",
      frameId: "inline-test",
      nodeId: "inline-test",
      name: "inline",
      width: 100,
      height: 100,
      screenshotUrl: "data:image/png;base64,iVBOR",
      html: '<div data-node-id="inline-test"><img data-node-id="img1" src="http://localhost:27618/assets/icon.svg" /></div>',
      css: "",
      assets: [{ id: "a1", type: "svg", url: "http://localhost:27618/assets/icon.svg", nodeId: "img1" }],
      nodes: [
        { nodeId: "inline-test", name: "root", kind: "group", bounds: { x: 0, y: 0, w: 100, h: 100 } },
        { nodeId: "img1", name: "icon", kind: "vector", bounds: { x: 10, y: 10, w: 24, h: 24 } }
      ]
    });

    const mockFetcher: AssetFetcher = async (url) => {
      if (url.includes("icon.svg")) {
        const svgContent = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';
        return { data: new TextEncoder().encode(svgContent), mime: "image/svg+xml" };
      }
      throw new Error("not found");
    };

    const result = await inlineZeroVisualAssets(snapshot, mockFetcher);
    expect(result.errors).toHaveLength(0);
    expect(result.snapshot.html).not.toContain("http://localhost");
    expect(result.snapshot.html).toContain("data:image/svg+xml;base64,");
    expect(result.snapshot.assets[0]!.url).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it("collects errors for failed fetches without breaking others", async () => {
    const snapshot = normalizeZeroVisualSnapshot({
      schemaVersion: "motion-copilot.zero-visual-snapshot.v1",
      frameId: "inline-err",
      nodeId: "inline-err",
      name: "err",
      width: 100,
      height: 100,
      screenshotUrl: "data:image/png;base64,iVBOR",
      html: '<div data-node-id="inline-err"><img data-node-id="i1" src="http://localhost:27618/a.png" /><img data-node-id="i2" src="http://localhost:27618/b.png" /></div>',
      css: "",
      assets: [
        { id: "a1", type: "png", url: "http://localhost:27618/a.png", nodeId: "i1" },
        { id: "a2", type: "png", url: "http://localhost:27618/b.png", nodeId: "i2" }
      ],
      nodes: [
        { nodeId: "inline-err", name: "root", kind: "group", bounds: { x: 0, y: 0, w: 100, h: 100 } },
        { nodeId: "i1", name: "img1", kind: "image", bounds: { x: 0, y: 0, w: 50, h: 50 } },
        { nodeId: "i2", name: "img2", kind: "image", bounds: { x: 50, y: 0, w: 50, h: 50 } }
      ]
    });

    const mockFetcher: AssetFetcher = async (url) => {
      if (url.includes("a.png")) throw new Error("timeout");
      return { data: new Uint8Array([137, 80, 78, 71]), mime: "image/png" };
    };

    const result = await inlineZeroVisualAssets(snapshot, mockFetcher);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.url).toContain("a.png");
    expect(result.snapshot.html).toContain("http://localhost:27618/a.png");
    expect(result.snapshot.html).toContain("data:image/png;base64,");
    expect(result.snapshot.assets[1]!.url).toMatch(/^data:image\/png;base64,/);
  });

  it("skips assets that are already data URIs", async () => {
    const snapshot = normalizeZeroVisualSnapshot({
      schemaVersion: "motion-copilot.zero-visual-snapshot.v1",
      frameId: "inline-skip",
      nodeId: "inline-skip",
      name: "skip",
      width: 100,
      height: 100,
      screenshotUrl: "data:image/png;base64,iVBOR",
      html: '<div data-node-id="inline-skip"><img data-node-id="i1" src="data:image/png;base64,existing" /></div>',
      css: "",
      assets: [{ id: "a1", type: "png", url: "data:image/png;base64,existing", nodeId: "i1" }],
      nodes: [
        { nodeId: "inline-skip", name: "root", kind: "group", bounds: { x: 0, y: 0, w: 100, h: 100 } },
        { nodeId: "i1", name: "img", kind: "image", bounds: { x: 0, y: 0, w: 50, h: 50 } }
      ]
    });

    let fetchCalled = false;
    const mockFetcher: AssetFetcher = async () => {
      fetchCalled = true;
      return { data: new Uint8Array([]), mime: "image/png" };
    };

    const result = await inlineZeroVisualAssets(snapshot, mockFetcher);
    expect(fetchCalled).toBe(false);
    expect(result.errors).toHaveLength(0);
    expect(result.snapshot.assets[0]!.url).toBe("data:image/png;base64,existing");
  });
});
