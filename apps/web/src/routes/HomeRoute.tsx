import { useMemo, useState } from "react";
import {
  recommendComponents,
  type BriefParseResult,
  type MotionComponent,
  type MotionComponentMetadata,
  type Recommendation
} from "@motion-tool/core";
import { BriefPanel } from "../features/brief/BriefPanel";
import { ComponentCandidates } from "../features/library/ComponentCandidates";
import { ComponentFeed } from "../features/library/ComponentFeed";
import { ImportPanel } from "../features/import/ImportPanel";
import { ConfirmParamsPanel } from "../features/import/ConfirmParamsPanel";
import { UploadMetadataPanel } from "../features/import/UploadMetadataPanel";
import { parseBrief } from "../services/briefParserClient";

type ImportPhase = "idle" | "confirm-params" | "fill-metadata";

type HomeRouteProps = {
  components: MotionComponent[];
  restoreComponentId?: string | null;
  onSelectComponent: (componentId: string) => void;
  onRestoreComplete?: () => void;
  importFlow: {
    phase: ImportPhase;
    importWarnings: import("@motion-tool/core").ImportWarning[];
    suggestedParams: import("@motion-tool/core").MotionParam[];
    selectedParamIds: Set<string>;
    importFiles: (files: Record<string, string>) => void;
    toggleParam: (id: string) => void;
    confirmParams: () => void;
    submitMetadata: (metadata: MotionComponentMetadata) => MotionComponent | null;
    cancelImport: () => void;
  };
  onComponentAdded: (component: MotionComponent) => void;
};

const DEFAULT_BRIEF = "我想要一个适合软件服务首页的文字入场动效";

export function HomeRoute({
  components,
  restoreComponentId,
  onSelectComponent,
  onRestoreComplete,
  importFlow,
  onComponentAdded
}: HomeRouteProps) {
  const [brief, setBrief] = useState(DEFAULT_BRIEF);
  const [isBriefPristine, setIsBriefPristine] = useState(true);
  const [parseResult, setParseResult] = useState<BriefParseResult | null>(null);
  const [isRecommending, setIsRecommending] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  const aiMatchIds = useMemo(
    () => new Set(recommendations.map((item) => item.componentId)),
    [recommendations]
  );

  function updateBrief(value: string) {
    setIsBriefPristine(false);
    setBrief(value);
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
    setRecommendations(recommendComponents({ intent: result.intent, components }));
    setIsRecommending(false);
  }

  function handleMetadataSubmit(metadata: MotionComponentMetadata) {
    const component = importFlow.submitMetadata(metadata);
    if (component) onComponentAdded(component);
  }

  return (
    <main className="home-shell">
      <div className="home-header">
        <div>
          <p className="brand-mark">智能动效</p>
          <h1>智能动效组件工作台</h1>
        </div>
        <nav className="home-nav" aria-label="首页导航">
          <a href="#recommend">智能推荐</a>
          <a href="#feed">组件库</a>
          <a href="#import">上传</a>
        </nav>
      </div>
      <BriefPanel
        brief={brief}
        parseResult={parseResult}
        isLoading={isRecommending}
        onBriefChange={updateBrief}
        onBriefFocus={clearDefaultBrief}
        onRecommend={runRecommend}
      />
      <ComponentCandidates
        recommendations={recommendations}
        components={components}
        onSelect={onSelectComponent}
      />
      <ComponentFeed
        components={components}
        aiMatchIds={aiMatchIds}
        restoreComponentId={restoreComponentId}
        onSelect={onSelectComponent}
        onRestoreComplete={onRestoreComplete}
      />
      <ImportPanel
        onImport={importFlow.importFiles}
        disabled={importFlow.phase !== "idle"}
      />
      {importFlow.phase === "confirm-params" && (
        <>
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
      {importFlow.phase === "fill-metadata" && (
        <UploadMetadataPanel
          onSubmit={handleMetadataSubmit}
          onCancel={importFlow.cancelImport}
        />
      )}
    </main>
  );
}