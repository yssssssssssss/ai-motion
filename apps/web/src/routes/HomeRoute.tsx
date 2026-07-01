import { useMemo, useState } from "react";
import { flushSync } from "react-dom";
import {
  recommendComponents,
  type BriefParseResult,
  type MotionComponent,
  type MotionComponentMetadata,
  type MotionTrigger,
  type Recommendation
} from "@motion-tool/core";
import { AtomicMotionPanel } from "../features/brief/AtomicMotionPanel";
import { BriefPanel, type BriefPanelMode } from "../features/brief/BriefPanel";
import { ComponentCandidates } from "../features/library/ComponentCandidates";
import { ComponentFeed } from "../features/library/ComponentFeed";
import { ConfirmParamsPanel } from "../features/import/ConfirmParamsPanel";
import { ConfirmLayersPanel } from "../features/import/ConfirmLayersPanel";
import { DesignSpecSelect } from "../features/import/DesignSpecSelect";
import { ImportChecklistPanel } from "../features/import/ImportChecklistPanel";
import { UploadMetadataPanel } from "../features/import/UploadMetadataPanel";
import { UnifiedUploadPanel } from "../features/import/UnifiedUploadPanel";
import { parseBrief } from "../services/briefParserClient";
import {
  atomicMotionTriggerRule,
  generateAtomicMotionComponent,
  motionSkillElements
} from "../services/atomicMotionGeneration";
import { isNonAtomicMotionComponent } from "../services/componentScope";
import { loadControlledGenerationCandidates } from "../services/generationCandidates";
import { generateReferenceGuidedComponent } from "../services/referenceGuidedGenerationClient";

type ImportPhase = "idle" | "confirm-params" | "confirm-layers" | "fill-metadata";
type GenerationOverlayPhase = "compact" | "expanding" | "revealing";

type HomeRouteProps = {
  components: MotionComponent[];
  isLibraryLoading?: boolean;
  restoreComponentId?: string | null;
  briefMode: BriefPanelMode;
  onBriefModeChange: (mode: BriefPanelMode) => void;
  onSelectComponent: (componentId: string) => void;
  onLoadComponentSource: (component: MotionComponent) => Promise<MotionComponent>;
  onRestoreComplete?: () => void;
  importFlow: {
    phase: ImportPhase;
    importWarnings: import("@motion-tool/core").ImportWarning[];
    suggestedParams: import("@motion-tool/core").MotionParam[];
    selectedParamIds: Set<string>;
    suggestedLayers: import("@motion-tool/core").MotionLayer[];
    selectedReplaceableLayerIds: Set<string>;
    selectedDesignSpecId: string | null;
    metadataDefaults: MotionComponentMetadata | null;
    importFiles: (files: Record<string, string>) => void;
    importComponentDraft: (component: MotionComponent) => void;
    toggleParam: (id: string) => void;
    toggleLayer: (id: string) => void;
    setSelectedDesignSpecId: (id: string | null) => void;
    confirmParams: () => void;
    confirmLayers: () => void;
    submitMetadata: (metadata: MotionComponentMetadata) => MotionComponent | null;
    cancelImport: () => void;
  };
  onComponentAdded: (component: MotionComponent) => void;
  onGeneratedComponentReady: (component: MotionComponent) => void;
};

const DEFAULT_BRIEF = "我想要一个适合软件服务首页的文字入场动效";
const GENERATION_THINKING_SKELETON_ROWS = [
  { label: "占位行 1", width: "78%" },
  { label: "占位行 2", width: "70%" },
  { label: "占位行 3", width: "62%" },
  { label: "占位行 4", width: "54%" },
  { label: "占位行 5", width: "46%" }
];
const GENERATION_LOADING_FIELDS = ["76%", "64%", "82%", "58%"];
const GENERATION_LOADING_CONTROLS = ["76px", "76px", "76px", "126px", "152px"];
const GENERATION_THINKING_ROW_REVEAL_MS = 180;
const MIN_GENERATION_OVERLAY_MS = 1800;
const SLOW_GENERATION_OVERLAY_MS = 8000;
const GENERATION_OVERLAY_EXPAND_MS = 620;
const GENERATION_OVERLAY_REVEAL_MS = 420;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function waitForGenerationOverlayFirstFrame(): Promise<void> {
  await wait(80);
}

async function keepGenerationOverlayVisibleSince(startedAt: number): Promise<void> {
  const remainingMs = MIN_GENERATION_OVERLAY_MS - (Date.now() - startedAt);
  if (remainingMs > 0) {
    await wait(remainingMs);
  }
}

function GenerationProgressOverlay({
  isOpen,
  isSlow,
  phase
}: {
  isOpen: boolean;
  isSlow: boolean;
  phase: GenerationOverlayPhase;
}) {
  if (!isOpen) return null;

  const backdropClassName = `generation-progress-backdrop is-${phase}`;
  const shellClassName = `generation-editor-loading-shell${isSlow ? " is-slow" : ""}`;

  return (
    <div className={backdropClassName} role="dialog" aria-modal="true" aria-label="正在生成组件草稿">
      <div className={shellClassName}>
        <header className="generation-loading-header">
          <span className="generation-loading-close" aria-hidden="true" />
          <div className="generation-loading-title" aria-hidden="true">
            <span className="generation-loading-title-kicker" />
            <span className="generation-loading-title-main" />
            <span className="generation-loading-title-sub" />
          </div>
          <span className="generation-loading-save" aria-hidden="true" />
        </header>
        <div className="generation-loading-body">
          <section className="generation-loading-preview-area" aria-label="生成预览占位">
            <div className="generation-loading-preview-frame">
              <span className="generation-loading-preview-core" aria-hidden="true" />
              <span className="generation-loading-preview-orbit" aria-hidden="true" />
              <span className="generation-loading-preview-sheen" aria-hidden="true" />
            </div>
            <div className="generation-loading-controls" aria-hidden="true">
              {GENERATION_LOADING_CONTROLS.map((width, index) => (
                <span
                  className="generation-loading-control-skeleton"
                  style={{ animationDelay: `${index * 70}ms`, width }}
                  key={`${width}-${index}`}
                />
              ))}
            </div>
          </section>
          <aside className="generation-loading-inspector" aria-label="参数面板加载占位">
            <div className="generation-loading-panel-header" aria-hidden="true">
              <span className="generation-loading-panel-kicker" />
              <span className="generation-loading-panel-title" />
            </div>
            <div className="generation-thinking-panel" aria-label="模型思考过程">
              <div className="generation-thinking-header" aria-hidden="true">
                <span className="generation-thinking-pulse" aria-hidden="true" />
                <span className="generation-thinking-heading" />
              </div>
              <div className="generation-thinking-skeleton-list">
                {GENERATION_THINKING_SKELETON_ROWS.map((row, index) => (
                  <div
                    className="generation-thinking-skeleton-row"
                    style={{ animationDelay: `${index * GENERATION_THINKING_ROW_REVEAL_MS}ms` }}
                    aria-label={row.label}
                    key={row.label}
                  >
                    <span className="generation-thinking-skeleton-dot" aria-hidden="true" />
                    <span
                      className="generation-thinking-skeleton-line"
                      style={{ width: row.width }}
                      aria-hidden="true"
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="generation-loading-tabs" aria-hidden="true">
              <span />
              <span />
            </div>
            <div className="generation-loading-reset" aria-hidden="true" />
            <div className="generation-loading-slider-group" aria-hidden="true">
              <div className="generation-loading-field-row">
                <span className="generation-loading-field-label" />
                <span className="generation-loading-field-value" />
              </div>
              <div className="generation-loading-speed-options">
                <span />
                <strong />
                <span />
              </div>
              <div className="generation-loading-slider">
                <span />
              </div>
            </div>
            <div className="generation-loading-divider" />
            <div className="generation-loading-panel-header" aria-hidden="true">
              <span className="generation-loading-panel-kicker" />
              <span className="generation-loading-panel-title is-short" />
            </div>
            <div className="generation-loading-fields" aria-hidden="true">
              {GENERATION_LOADING_FIELDS.map((width, index) => (
                <div className="generation-loading-input" key={`${width}-${index}`}>
                  <span style={{ width }} />
                  <i />
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

export function HomeRoute({
  components,
  isLibraryLoading = false,
  restoreComponentId,
  briefMode,
  onBriefModeChange,
  onSelectComponent,
  onLoadComponentSource,
  onRestoreComplete,
  importFlow,
  onComponentAdded,
  onGeneratedComponentReady
}: HomeRouteProps) {
  const [brief, setBrief] = useState(DEFAULT_BRIEF);
  const [isBriefPristine, setIsBriefPristine] = useState(true);
  const [parseResult, setParseResult] = useState<BriefParseResult | null>(null);
  const [isRecommending, setIsRecommending] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGenerationOverlayOpen, setIsGenerationOverlayOpen] = useState(false);
  const [generationOverlayPhase, setGenerationOverlayPhase] = useState<GenerationOverlayPhase>("compact");
  const [isGenerationSlow, setIsGenerationSlow] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const nonAtomicComponents = useMemo(
    () => components.filter(isNonAtomicMotionComponent),
    [components]
  );
  const firstAtomicElement = motionSkillElements.find((element) => element.active) ?? motionSkillElements[0];
  const [atomicElementId, setAtomicElementId] = useState(firstAtomicElement?.id ?? "");
  const [atomicVariant, setAtomicVariant] = useState(firstAtomicElement?.variants[0] ?? "");
  const firstAtomicTriggerRule = atomicMotionTriggerRule(firstAtomicElement?.id ?? "", firstAtomicElement?.variants[0]);
  const [atomicTrigger, setAtomicTrigger] = useState<MotionTrigger>(firstAtomicTriggerRule.defaultTrigger);

  const aiMatchIds = useMemo(
    () => new Set(recommendations.map((item) => item.componentId)),
    [recommendations]
  );
  function updateBrief(value: string) {
    setIsBriefPristine(false);
    setBrief(value);
    setGenerationStatus(null);
  }

  function clearDefaultBrief() {
    if (!isBriefPristine || brief !== DEFAULT_BRIEF) return;
    setBrief("");
    setIsBriefPristine(false);
  }

  async function runRecommend() {
    setIsRecommending(true);
    const result = await parseBrief(brief);
    setParseResult(result);
    setRecommendations(recommendComponents({ intent: result.intent, components: nonAtomicComponents }));
    setIsRecommending(false);
  }

  async function revealGeneratedComponent(component: MotionComponent, overlayStartedAt: number) {
    await keepGenerationOverlayVisibleSince(overlayStartedAt);
    setGenerationOverlayPhase("expanding");
    await wait(GENERATION_OVERLAY_EXPAND_MS);
    onGeneratedComponentReady(component);
    await waitForGenerationOverlayFirstFrame();
    setGenerationOverlayPhase("revealing");
    await wait(GENERATION_OVERLAY_REVEAL_MS);
  }

  async function runGenerate() {
    if (!brief.trim()) {
      setGenerationStatus("请输入需要生成的动效需求");
      return;
    }

    let overlayStartedAt = Date.now();
    let slowTimer: number | undefined;

    flushSync(() => {
      setIsGenerationOverlayOpen(true);
      setGenerationOverlayPhase("compact");
      setIsGenerationSlow(false);
      setGenerationStatus(null);
    });
    await waitForGenerationOverlayFirstFrame();
    overlayStartedAt = Date.now();
    setIsGenerating(true);
    slowTimer = window.setTimeout(() => setIsGenerationSlow(true), SLOW_GENERATION_OVERLAY_MS);
    try {
      const generationCandidates = await loadControlledGenerationCandidates({
        brief,
        components: nonAtomicComponents,
        onLoadComponentSource
      });

      const result = await generateReferenceGuidedComponent({ brief, components: generationCandidates });
      if (!result.validation.valid) {
        setGenerationStatus("生成未通过门禁，请调整需求或补充参考组件");
        return;
      }
      setGenerationStatus("草稿已生成，保存后入库");
      await revealGeneratedComponent(result.component, overlayStartedAt);
    } catch (error) {
      setGenerationStatus(error instanceof Error ? error.message : "参考生成失败");
    } finally {
      if (slowTimer !== undefined) {
        window.clearTimeout(slowTimer);
      }
      await keepGenerationOverlayVisibleSince(overlayStartedAt);
      setIsGenerationOverlayOpen(false);
      setGenerationOverlayPhase("compact");
      setIsGenerationSlow(false);
      setIsGenerating(false);
    }
  }

  function changeBriefMode(mode: BriefPanelMode) {
    onBriefModeChange(mode);
    setGenerationStatus(null);
  }

  function selectAtomicElement(elementId: string) {
    const element = motionSkillElements.find((item) => item.id === elementId);
    const variant = element?.variants[0] ?? "";
    const triggerRule = atomicMotionTriggerRule(elementId, variant);
    setAtomicElementId(elementId);
    setAtomicVariant(variant);
    setAtomicTrigger(triggerRule.defaultTrigger);
  }

  function selectAtomicVariant(variant: string) {
    const triggerRule = atomicMotionTriggerRule(atomicElementId, variant);
    setAtomicVariant(variant);
    setAtomicTrigger(triggerRule.defaultTrigger);
  }

  function generateAtomicMotionDraft() {
    try {
      const component = generateAtomicMotionComponent({
        elementId: atomicElementId,
        variant: atomicVariant,
        trigger: atomicTrigger
      });
      onGeneratedComponentReady(component);
      setGenerationStatus("原子动效草稿已生成，保存后入库");
    } catch (error) {
      setGenerationStatus(error instanceof Error ? error.message : "原子动效生成失败");
    }
  }

  function handleMetadataSubmit(metadata: MotionComponentMetadata) {
    const component = importFlow.submitMetadata(metadata);
    if (component) {
      setIsUploadOpen(false);
      onComponentAdded(component);
    }
  }

  function openUploadDialog() {
    setIsUploadOpen(true);
  }

  function closeUploadDialog() {
    importFlow.cancelImport();
    setIsUploadOpen(false);
  }

  return (
    <main className="home-shell">
      <div className="home-header">
        <div>
          <p className="brand-mark">智能动效</p>
          <h1>智能动效组件工作台</h1>
        </div>
        <button className="home-upload-button" type="button" onClick={openUploadDialog}>
          上传组件
        </button>
      </div>
      <BriefPanel
        mode={briefMode}
        brief={brief}
        parseResult={parseResult}
        isLoading={briefMode === "generate" ? isGenerating : isRecommending}
        isDisabled={isLibraryLoading}
        generationStatus={isGenerationOverlayOpen ? null : generationStatus}
        onModeChange={changeBriefMode}
        onBriefChange={updateBrief}
        onBriefFocus={clearDefaultBrief}
        onRecommend={runRecommend}
        onGenerate={runGenerate}
        onGenerateAtomicMotion={generateAtomicMotionDraft}
        atomicMotionPanel={
          <AtomicMotionPanel
            elements={motionSkillElements}
            selectedElementId={atomicElementId}
            selectedVariant={atomicVariant}
            onSelectElement={selectAtomicElement}
            onSelectVariant={selectAtomicVariant}
          />
        }
      />
      <GenerationProgressOverlay
        isOpen={isGenerationOverlayOpen}
        isSlow={isGenerationSlow}
        phase={generationOverlayPhase}
      />
      <ComponentCandidates
        recommendations={recommendations}
        components={nonAtomicComponents}
        hasSearched={parseResult !== null}
        onLoadComponentSource={onLoadComponentSource}
        onSelect={onSelectComponent}
      />
      <ComponentFeed
        components={components}
        scope={briefMode === "atomic" ? "atomic-motion" : "non-atomic"}
        isLoading={isLibraryLoading}
        aiMatchIds={aiMatchIds}
        onLoadComponentSource={onLoadComponentSource}
        restoreComponentId={restoreComponentId}
        onSelect={onSelectComponent}
        onRestoreComplete={onRestoreComplete}
      />
      {isUploadOpen && (
        <div className="upload-modal-backdrop" role="presentation" onMouseDown={closeUploadDialog}>
          <div
            className="upload-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="upload-modal-header">
              <div>
                <p className="eyebrow">上传组件</p>
                <h2 id="upload-modal-title">导入动效案例</h2>
              </div>
              <button
                className="upload-modal-close"
                type="button"
                aria-label="关闭上传弹窗"
                onClick={closeUploadDialog}
              >
                关闭
              </button>
            </div>
            {importFlow.phase === "idle" && (
              <UnifiedUploadPanel
                onImportFiles={importFlow.importFiles}
                onVideoComponentReady={importFlow.importComponentDraft}
              />
            )}
            {importFlow.phase === "confirm-params" && (
              <>
                <ImportChecklistPanel
                  phase={importFlow.phase}
                  hasPreview
                  layerCount={importFlow.suggestedLayers.length}
                  confirmedParamCount={importFlow.selectedParamIds.size}
                  selectedDesignSpecId={importFlow.selectedDesignSpecId}
                />
                {importFlow.importWarnings.length > 0 && (
                  <div className="import-warnings">
                    {importFlow.importWarnings.map((warning, index) => (
                      <p key={index} className="warning-text">
                        {warning.message}
                      </p>
                    ))}
                  </div>
                )}
                <ConfirmParamsPanel
                  params={importFlow.suggestedParams}
                  selected={importFlow.selectedParamIds}
                  onToggle={importFlow.toggleParam}
                  onConfirm={importFlow.confirmParams}
                />
              </>
            )}
            {importFlow.phase === "confirm-layers" && (
              <>
                <ImportChecklistPanel
                  phase={importFlow.phase}
                  hasPreview
                  layerCount={importFlow.suggestedLayers.length}
                  confirmedParamCount={importFlow.selectedParamIds.size}
                  selectedDesignSpecId={importFlow.selectedDesignSpecId}
                />
                <DesignSpecSelect
                  value={importFlow.selectedDesignSpecId}
                  onChange={importFlow.setSelectedDesignSpecId}
                />
                <ConfirmLayersPanel
                  layers={importFlow.suggestedLayers}
                  selectedReplaceableLayerIds={importFlow.selectedReplaceableLayerIds}
                  onToggle={importFlow.toggleLayer}
                  onConfirm={importFlow.confirmLayers}
                />
              </>
            )}
            {importFlow.phase === "fill-metadata" && (
              <UploadMetadataPanel
                initialMetadata={importFlow.metadataDefaults ?? undefined}
                onSubmit={handleMetadataSubmit}
                onCancel={closeUploadDialog}
              />
            )}
          </div>
        </div>
      )}
    </main>
  );
}
