import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const homeRouteSource = readFileSync(new URL("./HomeRoute.tsx", import.meta.url), "utf8");
const homeStyles = readFileSync(new URL("../styles/home.css", import.meta.url), "utf8");
const generationOverlayStyles = homeStyles.slice(
  homeStyles.indexOf(".generation-progress-backdrop"),
  homeStyles.indexOf(".upload-options")
);

describe("HomeRoute reference-guided generation wiring", () => {
  it("loads hydrated Top 3 references before calling the generation API", () => {
    expect(homeRouteSource).toContain("loadControlledGenerationCandidates");
    expect(homeRouteSource).toContain("onLoadComponentSource");
    expect(homeRouteSource).toContain(
      "generateReferenceGuidedComponent({ brief, components: generationCandidates })"
    );
    expect(homeRouteSource).not.toContain("正在基于 Top 3 参考案例生成...");
    expect(homeRouteSource).not.toContain("generateControlledComponent({ brief, components: generationCandidates })");
    expect(homeRouteSource).not.toContain("generateControlledComponent({ brief, components })");
  });

  it("does not block generation when no reference candidates match the brief", () => {
    expect(homeRouteSource).not.toContain("没有可用于参考生成的候选组件");
    expect(homeRouteSource).not.toMatch(/generationCandidates\.length\s*===\s*0[\s\S]{0,160}return;/);
    expect(homeRouteSource).toContain(
      "generateReferenceGuidedComponent({ brief, components: generationCandidates })"
    );
  });

  it("keeps generation results as drafts and shows an in-between progress overlay", () => {
    expect(homeRouteSource).toContain("AtomicMotionPanel");
    expect(homeRouteSource).toContain("generateAtomicMotionComponent");
    expect(homeRouteSource).toContain("atomicMotionTriggerRule(firstAtomicElement?.id ?? \"\", firstAtomicElement?.variants[0])");
    expect(homeRouteSource).toContain("function selectAtomicVariant(variant: string)");
    expect(homeRouteSource).toContain("atomicMotionTriggerRule(atomicElementId, variant)");
    expect(homeRouteSource).toContain("atomicMotionPanel=");
    expect(homeRouteSource).toContain("onGenerateAtomicMotion={generateAtomicMotionDraft}");
    expect(homeRouteSource).not.toContain("isAtomicMotionOpen");
    expect(homeRouteSource).not.toContain("setIsAtomicMotionOpen");
    expect(homeRouteSource).toContain("GenerationProgressOverlay");
    expect(homeRouteSource).toContain('type GenerationOverlayPhase = "compact" | "expanding" | "revealing"');
    expect(homeRouteSource).toContain("MIN_GENERATION_OVERLAY_MS");
    expect(homeRouteSource).toContain("SLOW_GENERATION_OVERLAY_MS");
    expect(homeRouteSource).toContain("GENERATION_OVERLAY_EXPAND_MS");
    expect(homeRouteSource).toContain("GENERATION_OVERLAY_REVEAL_MS");
    expect(homeRouteSource).toContain("isGenerationOverlayOpen");
    expect(homeRouteSource).toContain("generationOverlayPhase");
    expect(homeRouteSource).toContain("setGenerationOverlayPhase(\"compact\")");
    expect(homeRouteSource).toContain("setGenerationOverlayPhase(\"expanding\")");
    expect(homeRouteSource).toContain("setGenerationOverlayPhase(\"revealing\")");
    expect(homeRouteSource).toContain("isSlow={isGenerationSlow}");
    expect(homeStyles).toContain(".generation-editor-loading-shell.is-slow");
    expect(homeRouteSource).toContain("flushSync");
    expect(homeRouteSource).toContain("setIsGenerationOverlayOpen(true)");
    expect(homeRouteSource).toContain("await waitForGenerationOverlayFirstFrame()");
    expect(homeRouteSource).toContain("await keepGenerationOverlayVisibleSince(overlayStartedAt)");
    expect(homeRouteSource).toContain("await revealGeneratedComponent(result.component, overlayStartedAt)");
    expect(homeRouteSource).toContain("isOpen={isGenerationOverlayOpen}");
    expect(homeRouteSource).toContain("phase={generationOverlayPhase}");
    expect(homeRouteSource).toContain("generationStatus={isGenerationOverlayOpen ? null : generationStatus}");
    expect(homeRouteSource).toContain("onGeneratedComponentReady(component)");
    expect(homeRouteSource).toContain("onSelectVariant={selectAtomicVariant}");
    expect(homeRouteSource).not.toContain("allowedTriggers={atomicMotionTriggerRule(atomicElementId, atomicVariant).allowedTriggers}");
    expect(homeRouteSource).not.toContain("onSelectTrigger={setAtomicTrigger}");
    expect(homeRouteSource).toContain("setIsGenerationOverlayOpen(false)");
    expect(homeRouteSource).not.toContain("isOpen={isGenerating}");
    expect(homeRouteSource).not.toContain("onComponentAdded(result.component)");
  });

  it("receives the discovery tab mode from the app so editor back navigation preserves it", () => {
    expect(homeRouteSource).toContain("briefMode: BriefPanelMode");
    expect(homeRouteSource).toContain("onBriefModeChange: (mode: BriefPanelMode) => void");
    expect(homeRouteSource).not.toContain('useState<BriefPanelMode>("recommend")');
    expect(homeRouteSource).toContain("onBriefModeChange(mode)");
    expect(homeRouteSource).toContain("mode={briefMode}");
  });

  it("presents generation as an abstract staged skeleton instead of concrete editor content", () => {
    expect(homeRouteSource).toContain("generation-editor-loading-shell");
    expect(homeRouteSource).toContain("generation-loading-title-main");
    expect(homeRouteSource).toContain("generation-thinking-panel");
    expect(homeRouteSource).toContain("generation-thinking-heading");
    expect(homeRouteSource).toContain("GENERATION_THINKING_SKELETON_ROWS");
    expect(homeRouteSource).toContain("GENERATION_THINKING_ROW_REVEAL_MS");
    expect(homeRouteSource).toContain("generation-thinking-skeleton-row");
    expect(homeRouteSource).toContain("animationDelay");
    expect(homeRouteSource).toContain("generation-loading-preview-core");
    expect(homeRouteSource).toContain("generation-loading-control-skeleton");
    expect(homeRouteSource).not.toContain("理解场景、风格与组件目标");
    expect(homeRouteSource).not.toContain("读取候选源码与可替换图层");
    expect(homeRouteSource).not.toContain("写入参数并校验预览结果");
    expect(homeRouteSource).not.toContain(">关闭<");
    expect(homeRouteSource).not.toContain(">生成预览<");
    expect(homeRouteSource).not.toContain(">播放<");
    expect(homeRouteSource).not.toContain(">暂停<");
    expect(homeRouteSource).not.toContain(">重播<");
    expect(homeRouteSource).not.toContain(">导出 HTML<");
    expect(homeRouteSource).not.toContain(">导出 ZIP 工程<");
    expect(homeRouteSource).not.toContain(">模型思考中<");
    expect(homeRouteSource).not.toContain(">Plus<");
    expect(homeRouteSource).not.toContain(">Pro<");
    expect(homeRouteSource).not.toContain(">速度<");
    expect(homeRouteSource).not.toContain(">替换素材与文案<");
    expect(homeRouteSource).toContain("generation-loading-preview-frame");
    expect(homeRouteSource).toContain("generation-loading-inspector");
    expect(homeRouteSource).toContain("generation-loading-controls");
    expect(homeStyles).not.toContain("clip-path: inset(44% 46% round 8px)");
    expect(generationOverlayStyles).toContain("transition:");
    expect(generationOverlayStyles).toContain("opacity 420ms ease");
    expect(homeStyles).toContain("@keyframes generation-module-reveal");
    expect(homeStyles).toContain("@keyframes generation-background-scan");
    expect(homeStyles).toContain(".generation-thinking-panel");
    expect(homeStyles).toContain(".generation-thinking-skeleton-row");
    expect(homeStyles).toContain("@keyframes generation-thinking-skeleton-reveal");
    expect(homeStyles).not.toContain(".generation-progress-step");
    expect(homeStyles).not.toContain("@keyframes generation-step-flash");
    expect(homeStyles).toContain(".generation-loading-inspector");
    expect(homeStyles).toContain(".generation-loading-preview-frame");
    expect(homeStyles).toContain("@keyframes generation-skeleton-sheen");
  });

  it("stages the generation loading overlay from compact modal to fullscreen reveal", () => {
    expect(generationOverlayStyles).toContain(".generation-progress-backdrop.is-compact");
    expect(generationOverlayStyles).toContain(".generation-progress-backdrop.is-expanding");
    expect(generationOverlayStyles).toContain(".generation-progress-backdrop.is-revealing");
    expect(generationOverlayStyles).toContain("width: min(920px, calc(100vw - 48px))");
    expect(generationOverlayStyles).toContain("height: min(620px, calc(100svh - 48px))");
    expect(generationOverlayStyles).toContain("background: transparent");
    expect(generationOverlayStyles).toContain("rgba(255, 255, 255, 0.98)");
    expect(generationOverlayStyles).toContain(".generation-progress-backdrop.is-compact::before");
    expect(generationOverlayStyles).toContain("animation: none");
    expect(generationOverlayStyles).not.toContain("rgba(255, 255, 255, 0.68)");
    expect(generationOverlayStyles).toContain("height: 100svh");
    expect(generationOverlayStyles).toContain("opacity: 0");
    expect(generationOverlayStyles).toContain("pointer-events: none");
    expect(generationOverlayStyles).toContain("@keyframes generation-compact-pop");
  });

  it("uses a light purple skeleton palette for the generation loading overlay", () => {
    expect(generationOverlayStyles).toContain("#ffffff 0%");
    expect(generationOverlayStyles).toContain("#fbf7ff");
    expect(generationOverlayStyles).toContain("#f7efff");
    expect(generationOverlayStyles).toContain("#7e22ce");
    expect(generationOverlayStyles).toContain("rgba(126, 34, 206");
    expect(generationOverlayStyles).toContain("rgba(216, 180, 254");
    expect(generationOverlayStyles).toContain("rgba(255, 255, 255, 0.84)");
    expect(generationOverlayStyles).not.toContain("#09050f");
    expect(generationOverlayStyles).not.toContain("#1b1028");
    expect(generationOverlayStyles).not.toContain("#050308");
    expect(generationOverlayStyles).not.toContain("rgba(24, 13, 42");
    expect(generationOverlayStyles).not.toContain("rgba(125, 211, 252");
    expect(generationOverlayStyles).not.toContain("rgba(34, 211, 238");
    expect(generationOverlayStyles).not.toContain("rgba(56, 189, 248");
    expect(generationOverlayStyles).not.toContain("#38bdf8");
  });
});
