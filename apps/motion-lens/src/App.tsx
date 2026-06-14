import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, PointerEvent } from "react";
import {
  classifyGoal,
  createFallbackBlueprint,
  createMotionDocument,
  createMotionBlueprint,
  createMotionPreviewSpec,
  fixtureDrafts,
  parseMotionDocument,
  type DesignElement,
  type DesignElementKind,
  type DesignSource,
  type MotionBlueprint,
  type MotionOpportunity
} from "@motion-lens/core";
import { easingLabel, paramLabel, previewTemplateFor, previewTimingStyle, repeatLabel } from "./preview";
import { reviewReportHtml } from "./report";
import { reviewFlagsForOpportunity } from "./reviewFlags";
import { detailTabs, type DetailTabId } from "./detailTabs";
import {
  manualAnnotationOptionFor,
  manualAnnotationOptions,
  type ManualAnnotationKind
} from "./manualAnnotation";

type ViewMode = "blueprint" | "preview";
type ReviewIntent = "designer-review" | "interaction-check" | "growth-review";
type UploadedImage = {
  source: DesignSource;
  dataUrl: string;
  analysisDataUrl: string;
  analysisSource: DesignSource;
};
type ModelConfig = {
  endpoint: string;
  model: string;
  hasApiKey: boolean;
  mode: "llm-ready" | "fallback-only";
  timeoutMs: number;
};
type DraftSelection = {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
};
type PendingManualSelection = {
  bounds: DesignElement["bounds"];
  menuStyle: CSSProperties;
};
type RationalGateResult = {
  passed: boolean;
  reasons: string[];
};
const manualMenuWidthPx = 208;
const manualMenuHeightPx = 260;
const manualMenuMarginPx = 8;
const manualPendingWarning = "已完成手动标注；点击「AI 分析手动标注」后生成机会点。";

const reviewIntents: Array<{ value: ReviewIntent; label: string; goalSuffix: string }> = [
  { value: "designer-review", label: "设计师评审", goalSuffix: "输出标注、理由、推荐参数和知识依据" },
  { value: "interaction-check", label: "交互走查", goalSuffix: "优先检查反馈、状态变化和操作确定性" },
  { value: "growth-review", label: "转化优化", goalSuffix: "优先检查关键转化入口、注意力和风险控制" }
];
const pageTypeOptions: Array<{ value: string; label: string }> = [
  { value: "commerce", label: "电商首页/频道页" },
  { value: "product-detail", label: "商品详情页" },
  { value: "checkout", label: "下单/支付页" },
  { value: "form", label: "表单填写页" },
  { value: "modal", label: "弹窗/浮层" },
  { value: "ai", label: "AI 结果页" },
  { value: "dashboard", label: "数据看板" },
  { value: "marketing", label: "营销活动页" },
  { value: "search", label: "搜索/缺省页" },
  { value: "logistics", label: "物流/履约页" },
  { value: "review", label: "评价/反馈页" }
];
const fixedDraftFrameRatio = 1120 / 760;
const maxAnalysisImageSide = 1600;

function firstOpportunity(opportunities: MotionOpportunity[]): MotionOpportunity | undefined {
  return opportunities[0];
}

function selectedOpportunity(
  opportunities: MotionOpportunity[],
  selectedId: string
): MotionOpportunity | undefined {
  if (!selectedId) return undefined;
  return opportunities.find((opportunity) => opportunity.id === selectedId);
}

function elementFor(blueprint: MotionBlueprint, opportunity: MotionOpportunity): DesignElement | undefined {
  return blueprint.elements.find((element) => element.id === opportunity.elementId);
}

function opportunityForElement(blueprint: MotionBlueprint, elementId: string): MotionOpportunity | undefined {
  return blueprint.opportunities.find((opportunity) => opportunity.elementId === elementId);
}

function createManualPendingBlueprint(input: {
  source: DesignSource;
  goalText: string;
  pageType: string;
  elements: DesignElement[];
  warnings: string[];
}): MotionBlueprint {
  return {
    version: "0.1",
    source: input.source,
    context: {
      pageType: input.pageType,
      goalText: input.goalText,
      inferredGoal: classifyGoal(input.goalText, input.pageType)
    },
    elements: input.elements,
    opportunities: [],
    diagnostics: {
      warnings: input.warnings.length > 0 ? input.warnings : [manualPendingWarning],
      noMotionSuggestions: [],
      analysisMode: "hybrid"
    }
  };
}

function hasFallbackRecommendation(blueprint: MotionBlueprint): boolean {
  return (
    blueprint.diagnostics.analysisMode === "fallback" ||
    blueprint.opportunities.some((opportunity) => opportunity.recommendationSource !== "llm-opportunity") ||
    blueprint.diagnostics.warnings.some((warning) => /fallback|兜底|本地推荐|本地规则/.test(warning))
  );
}

function rationalGateFor(blueprint: MotionBlueprint, opportunity: MotionOpportunity): RationalGateResult {
  const reasons: string[] = [];
  const element = elementFor(blueprint, opportunity);
  const noMotion = blueprint.diagnostics.noMotionSuggestions.find(
    (suggestion) => suggestion.elementId === opportunity.elementId
  );

  if (!element || element.isDecorative) {
    reasons.push("对应元素不可评审或偏装饰。");
  }
  if (noMotion) {
    reasons.push(`已命中不建议动效：${noMotion.reason}`);
  }
  if (opportunity.confidence < 0.55) {
    reasons.push("模型置信度偏低。");
  }
  if (opportunity.score < 60) {
    reasons.push("适配分低于理性过滤阈值。");
  }
  if (
    blueprint.diagnostics.analysisMode === "hybrid" &&
    (!opportunity.knowledgeRefs || opportunity.knowledgeRefs.length === 0)
  ) {
    reasons.push("缺少可追溯知识依据。");
  }
  if (opportunity.strategy === "attention" && opportunity.recommendedParams.repeat === "loop") {
    reasons.push("强调类动效不应作为交付建议循环播放。");
  }
  if (opportunity.reason.trim().length < 12) {
    reasons.push("推荐理由不足以支撑动效收益。");
  }

  return {
    passed: reasons.length === 0,
    reasons
  };
}

function markerStyle(blueprint: MotionBlueprint, element: DesignElement): CSSProperties {
  return {
    left: `${(element.bounds.x / blueprint.source.width) * 100}%`,
    top: `${(element.bounds.y / blueprint.source.height) * 100}%`,
    width: `${(element.bounds.width / blueprint.source.width) * 100}%`,
    height: `${(element.bounds.height / blueprint.source.height) * 100}%`
  };
}

function boundsStyle(source: DesignSource, bounds: DesignElement["bounds"]): CSSProperties {
  return {
    left: `${(bounds.x / source.width) * 100}%`,
    top: `${(bounds.y / source.height) * 100}%`,
    width: `${(bounds.width / source.width) * 100}%`,
    height: `${(bounds.height / source.height) * 100}%`
  };
}

function draftSurfaceStyle(source: DesignSource): CSSProperties {
  const sourceRatio = source.width / source.height;
  return {
    aspectRatio: `${source.width} / ${source.height}`,
    ...(sourceRatio >= fixedDraftFrameRatio ? { width: "100%" } : { height: "100%" })
  };
}

function reviewGoalText(goalText: string, intent: ReviewIntent): string {
  const intentConfig = reviewIntents.find((item) => item.value === intent) ?? reviewIntents[0];
  return [goalText.trim(), intentConfig?.goalSuffix].filter(Boolean).join("；");
}

function diagnosticMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "AI 分析失败。";
  if (/401|403|鉴权|unauthorized|forbidden|api key/i.test(message)) {
    return `模型鉴权失败：${message}`;
  }
  if (/502|503|504|gateway|timeout|超时/i.test(message)) {
    return `模型服务暂不可用：${message}`;
  }
  if (/schema|JSON|格式|无效/i.test(message)) {
    return `模型返回格式异常：${message}`;
  }
  if (/知识|引用|knowledge/i.test(message)) {
    return `知识依据不足：${message}`;
  }
  return message;
}

function modelModeLabel(config: ModelConfig | null): string {
  if (!config) return "读取中";
  return config.mode === "llm-ready" ? "可调用模型" : "仅兜底";
}

function recommendationSourceLabel(source: MotionOpportunity["recommendationSource"]): string {
  if (source === "llm-opportunity") return "AI 原生推荐";
  if (source === "llm-candidate-rule-recommendation") return "AI 识别 + 规则推荐";
  if (source === "manual-pending") return "待 AI 分析";
  return "本地兜底";
}

function downloadHtml(filename: string, html: string) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function adoptedKnowledgeRefs(blueprint: MotionBlueprint): NonNullable<MotionOpportunity["knowledgeRefs"]> {
  const refs = new Map<string, NonNullable<MotionOpportunity["knowledgeRefs"]>[number]>();
  for (const opportunity of blueprint.opportunities) {
    for (const ref of opportunity.knowledgeRefs ?? []) {
      refs.set(`${ref.id}-${ref.pageRange}`, ref);
    }
  }
  return [...refs.values()];
}

function blueprintInput(fixtureId: string, goalText: string, pageType?: string) {
  return {
    fixtureId,
    goalText,
    ...(pageType ? { pageType } : {})
  };
}

function goalLabel(goal: MotionBlueprint["context"]["inferredGoal"]): string {
  if (goal === "ctr") return "点击";
  if (goal === "cvr") return "转化";
  if (goal === "clarity") return "清晰";
  if (goal === "trust") return "信任";
  if (goal === "feedback") return "反馈";
  return "留存";
}

function stageLabel(stage: MotionOpportunity["decisionStage"]): string {
  if (stage === "discover") return "发现";
  if (stage === "understand") return "理解";
  if (stage === "evaluate") return "评估";
  if (stage === "decide") return "决策";
  if (stage === "act") return "行动";
  return "反馈";
}

function frictionLabel(friction: MotionOpportunity["friction"]): string {
  if (friction === "attention") return "注意力";
  if (friction === "understanding") return "理解";
  if (friction === "trust") return "信任";
  if (friction === "confidence") return "信心";
  return "动机";
}

function strategyLabel(strategy: MotionOpportunity["strategy"]): string {
  if (strategy === "attention") return "吸引注意";
  if (strategy === "guidance") return "引导理解";
  if (strategy === "trust") return "建立信任";
  if (strategy === "feedback") return "反馈确认";
  return "奖励激励";
}

function boundsFieldLabel(field: keyof DesignElement["bounds"]): string {
  if (field === "x") return "横向";
  if (field === "y") return "纵向";
  if (field === "width") return "宽度";
  return "高度";
}

function manualElementSignals(
  kind: DesignElementKind,
  bounds: DesignElement["bounds"],
  source: DesignSource
): Pick<DesignElement, "interactiveLikelihood" | "visualWeight"> {
  const areaRatio = (bounds.width * bounds.height) / (source.width * source.height);
  const centerY = (bounds.y + bounds.height / 2) / source.height;
  const visualWeight = clampNumber(0.36 + areaRatio * 1.6 + (centerY < 0.48 ? 0.12 : 0), 0.32, 0.92);

  if (kind === "button" || kind === "modal" || kind === "form" || kind === "nav") {
    return {
      interactiveLikelihood: 1,
      visualWeight: kind === "button" || kind === "nav" ? clampNumber(visualWeight, 0.42, 0.82) : visualWeight
    };
  }

  if (kind === "feedback") {
    return {
      interactiveLikelihood: 0.56,
      visualWeight
    };
  }

  if (kind === "content") {
    return {
      interactiveLikelihood: areaRatio > 0.16 ? 0.26 : 0.14,
      visualWeight: clampNumber(visualWeight - 0.08, 0.28, 0.78)
    };
  }

  return {
    interactiveLikelihood: centerY < 0.58 || areaRatio > 0.18 ? 0.62 : 0.42,
    visualWeight
  };
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function readImage(file: File): Promise<UploadedImage> {
  return new Promise((resolve, reject) => {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      reject(new Error("仅支持 PNG、JPG、WebP。"));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("图片读取失败。"));
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      const image = new Image();
      image.onerror = () => reject(new Error("图片尺寸读取失败。"));
      image.onload = () => {
        const source: DesignSource = {
          kind: "image",
          id: `upload-${Date.now()}`,
          name: file.name,
          width: image.naturalWidth,
          height: image.naturalHeight
        };
        const scale = Math.min(1, maxAnalysisImageSide / Math.max(source.width, source.height));
        const analysisWidth = Math.max(1, Math.round(source.width * scale));
        const analysisHeight = Math.max(1, Math.round(source.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = analysisWidth;
        canvas.height = analysisHeight;
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("图片分析预处理失败。"));
          return;
        }
        context.drawImage(image, 0, 0, analysisWidth, analysisHeight);
        resolve({
          dataUrl,
          source,
          analysisDataUrl: scale < 1 ? canvas.toDataURL("image/jpeg", 0.86) : dataUrl,
          analysisSource:
            scale < 1
              ? {
                  ...source,
                  id: `${source.id}-analysis`,
                  width: analysisWidth,
                  height: analysisHeight
                }
              : source
        });
      };
      image.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("文件读取失败。"));
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.readAsText(file);
  });
}

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function reviewExportPayload(blueprint: MotionBlueprint, uploadedImage: UploadedImage | null) {
  return createMotionDocument({
    blueprint,
    ...(uploadedImage ? { imageDataUrl: uploadedImage.dataUrl } : {})
  });
}

function pointInSource(event: PointerEvent<HTMLDivElement>, source: DesignSource): { x: number; y: number } {
  const rect = event.currentTarget.getBoundingClientRect();
  const relativeX = clampNumber((event.clientX - rect.left) / rect.width, 0, 1);
  const relativeY = clampNumber((event.clientY - rect.top) / rect.height, 0, 1);
  return {
    x: relativeX * source.width,
    y: relativeY * source.height
  };
}

function manualMenuFrameStyle(
  source: DesignSource,
  bounds: DesignElement["bounds"],
  surfaceElement: HTMLDivElement
): CSSProperties {
  const surfaceRect = surfaceElement.getBoundingClientRect();
  const frameRect = surfaceElement.closest(".draft-frame")?.getBoundingClientRect() ?? surfaceRect;
  const scaleX = surfaceRect.width / source.width;
  const scaleY = surfaceRect.height / source.height;
  const targetLeft = surfaceRect.left - frameRect.left + bounds.x * scaleX;
  const targetTop = surfaceRect.top - frameRect.top + bounds.y * scaleY;
  const targetRight = targetLeft + bounds.width * scaleX;
  const targetBottom = targetTop + bounds.height * scaleY;
  const opensRight = targetRight + manualMenuMarginPx + manualMenuWidthPx <= frameRect.width;
  const opensBelow = targetBottom + manualMenuMarginPx + manualMenuHeightPx <= frameRect.height;
  const desiredX = opensRight
    ? targetRight + manualMenuMarginPx
    : targetLeft - manualMenuWidthPx - manualMenuMarginPx;
  const desiredY = opensBelow
    ? targetBottom + manualMenuMarginPx
    : targetTop - manualMenuHeightPx - manualMenuMarginPx;
  const x = clampNumber(
    desiredX,
    manualMenuMarginPx,
    frameRect.width - manualMenuWidthPx - manualMenuMarginPx
  );
  const y = clampNumber(
    desiredY,
    manualMenuMarginPx,
    frameRect.height - manualMenuHeightPx - manualMenuMarginPx
  );

  return {
    left: `${x}px`,
    top: `${y}px`,
    width: `${manualMenuWidthPx}px`
  };
}

function boundsFromSelection(selection: DraftSelection): DesignElement["bounds"] {
  const x = Math.min(selection.startX, selection.currentX);
  const y = Math.min(selection.startY, selection.currentY);
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(Math.abs(selection.currentX - selection.startX)),
    height: Math.round(Math.abs(selection.currentY - selection.startY))
  };
}

function normalizeBounds(bounds: DesignElement["bounds"], source: DesignSource): DesignElement["bounds"] {
  const minWidth = Math.min(24, source.width);
  const minHeight = Math.min(24, source.height);
  const width = clampNumber(bounds.width, minWidth, source.width);
  const height = clampNumber(bounds.height, minHeight, source.height);
  return {
    x: Math.round(clampNumber(bounds.x, 0, source.width - width)),
    y: Math.round(clampNumber(bounds.y, 0, source.height - height)),
    width: Math.round(width),
    height: Math.round(height)
  };
}

function MockDraft({ fixtureId }: { fixtureId: string }) {
  return (
    <div className={`mock-draft mock-${fixtureId}`} aria-hidden="true">
      <div className="mock-nav">
        <strong>MotionLens 样例</strong>
        <span>概览</span>
        <span>操作</span>
      </div>
      <div className="mock-hero">
        <span className="mock-kicker" />
        <span className="mock-title" />
        <span className="mock-title short" />
        <span className="mock-line" />
        <span className="mock-line" />
        <span className="mock-line short" />
        <span className="mock-cta" />
      </div>
      <div className="mock-visual" />
      <div className="mock-grid">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="mock-feedback" />
    </div>
  );
}

function Preview({
  blueprint,
  opportunity,
  isPaused
}: {
  blueprint: MotionBlueprint;
  opportunity: MotionOpportunity;
  isPaused: boolean;
}) {
  const spec = createMotionPreviewSpec(blueprint, opportunity.id);
  if (!spec) return <p className="empty-state">当前机会点暂不支持预览。</p>;
  const template = previewTemplateFor(spec, opportunity);
  const timingStyle = previewTimingStyle(opportunity, template, { paused: isPaused });
  const cardClassName = isPaused ? "preview-card is-paused" : "preview-card";

  if (template === "cta" || template === "press") {
    return (
      <div className={cardClassName}>
        <button className={`preview-button preview-${template}`} type="button" style={timingStyle}>
          {spec.title}
        </button>
        <p>{paramLabel(opportunity)} · 预览循环播放</p>
      </div>
    );
  }

  if (template === "spotlight") {
    return (
      <div className={cardClassName}>
        <div className="preview-spotlight" style={timingStyle}>
          <span />
          <strong>{spec.title}</strong>
          <small>重点区域</small>
        </div>
        <p>{paramLabel(opportunity)} · 预览循环播放</p>
      </div>
    );
  }

  if (template === "cart") {
    return (
      <div className={cardClassName}>
        <div className="preview-commerce preview-cart" style={timingStyle}>
          <span className="preview-product" />
          <span className="preview-cart-target" />
          <strong>{spec.title}</strong>
        </div>
        <p>{paramLabel(opportunity)} · 预览循环播放</p>
      </div>
    );
  }

  if (template === "favorite" || template === "rating") {
    return (
      <div className={cardClassName}>
        <div className={`preview-icon-motion preview-${template}`} style={timingStyle}>
          <span />
          <strong>{spec.title}</strong>
        </div>
        <p>{paramLabel(opportunity)} · 预览循环播放</p>
      </div>
    );
  }

  if (template === "ceremony") {
    return (
      <div className={cardClassName}>
        <div className="preview-ceremony" style={timingStyle}>
          <span />
          <i />
          <i />
          <i />
          <strong>{spec.title}</strong>
        </div>
        <p>{paramLabel(opportunity)} · 预览循环播放</p>
      </div>
    );
  }

  if (template === "progress") {
    return (
      <div className={cardClassName}>
        <div className="preview-progress" style={timingStyle}>
          <span />
          <span />
          <span />
          <strong>{spec.title}</strong>
        </div>
        <p>{paramLabel(opportunity)} · 预览循环播放</p>
      </div>
    );
  }

  if (template === "empty") {
    return (
      <div className={cardClassName}>
        <div className="preview-empty" style={timingStyle}>
          <span />
          <strong>{spec.title}</strong>
          <small />
        </div>
        <p>{paramLabel(opportunity)} · 预览循环播放</p>
      </div>
    );
  }

  if (template === "badge") {
    return (
      <div className={cardClassName}>
        <div className="preview-badge" style={timingStyle}>
          <span />
          <i>利益点</i>
          <strong>{spec.title}</strong>
        </div>
        <p>{paramLabel(opportunity)} · 预览循环播放</p>
      </div>
    );
  }

  if (template === "toast") {
    return (
      <div className={cardClassName}>
        <div className="preview-toast" style={timingStyle}>
          <strong>{spec.title}</strong>
          <span />
        </div>
        <p>{paramLabel(opportunity)} · 预览循环播放</p>
      </div>
    );
  }

  if (template === "modal") {
    return (
      <div className={cardClassName}>
        <div className="preview-modal" style={timingStyle}>
          <strong>{spec.title}</strong>
          <span />
          <span />
        </div>
        <p>{paramLabel(opportunity)} · 预览循环播放</p>
      </div>
    );
  }

  return (
    <div className={cardClassName}>
      <div className={`preview-sequence preview-${template}`} style={timingStyle}>
        <span />
        <span />
        <span />
      </div>
      <p>{paramLabel(opportunity)} · 预览循环播放</p>
    </div>
  );
}

export function App() {
  const [fixtureId, setFixtureId] = useState(fixtureDrafts[0]?.id ?? "commerce-product");
  const fixture = fixtureDrafts.find((item) => item.id === fixtureId) ?? fixtureDrafts[0];
  const [pageType, setPageType] = useState(fixture?.pageType ?? "commerce");
  const [goalText, setGoalText] = useState(fixture?.defaultGoalText ?? "");
  const [reviewIntent, setReviewIntent] = useState<ReviewIntent>("designer-review");
  const [uploadedImage, setUploadedImage] = useState<UploadedImage | null>(null);
  const [importedBlueprint, setImportedBlueprint] = useState<MotionBlueprint | null>(null);
  const [manualElements, setManualElements] = useState<DesignElement[]>([]);
  const [pendingManualElementIds, setPendingManualElementIds] = useState<string[]>([]);
  const [analysisWarnings, setAnalysisWarnings] = useState<string[]>([]);
  const [draftSelection, setDraftSelection] = useState<DraftSelection | null>(null);
  const [pendingManualSelection, setPendingManualSelection] = useState<PendingManualSelection | null>(null);
  const [isManualAnnotationEnabled, setIsManualAnnotationEnabled] = useState(false);
  const [hiddenOpportunityIds, setHiddenOpportunityIds] = useState<string[]>([]);
  const [isRationalGateEnabled, setIsRationalGateEnabled] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("blueprint");
  const [previewReplayKey, setPreviewReplayKey] = useState(0);
  const [isPreviewPaused, setIsPreviewPaused] = useState(false);
  const [modelConfig, setModelConfig] = useState<ModelConfig | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<DetailTabId>("recommendation");
  const effectiveGoalText = reviewGoalText(goalText, reviewIntent);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/motion-lens/config")
      .then((response) => (response.ok ? response.json() : undefined))
      .then((config: ModelConfig | undefined) => {
        if (!cancelled && config) setModelConfig(config);
      })
      .catch(() => {
        if (!cancelled) setModelConfig(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const blueprint = useMemo(() => {
    if (importedBlueprint && !uploadedImage) {
      return importedBlueprint;
    }

    if (uploadedImage) {
      if (importedBlueprint) {
        return importedBlueprint;
      }

      if (manualElements.length === 0) {
        return createFallbackBlueprint({
          source: uploadedImage.source,
          goalText: effectiveGoalText,
          pageType
        });
      }

      return createManualPendingBlueprint({
        source: uploadedImage.source,
        goalText: effectiveGoalText,
        pageType,
        elements: manualElements,
        warnings: analysisWarnings
      });
    }
    return createMotionBlueprint(blueprintInput(fixtureId, effectiveGoalText, pageType));
  }, [
    analysisWarnings,
    effectiveGoalText,
    fixtureId,
    importedBlueprint,
    manualElements,
    pageType,
    uploadedImage
  ]);
  const [selectedId, setSelectedId] = useState("");
  const userVisibleOpportunities = blueprint.opportunities.filter(
    (opportunity) => !hiddenOpportunityIds.includes(opportunity.id)
  );
  const rationalGateResults = useMemo(
    () =>
      new Map(
        userVisibleOpportunities.map((opportunity) => [
          opportunity.id,
          rationalGateFor(blueprint, opportunity)
        ])
      ),
    [blueprint, userVisibleOpportunities]
  );
  const visibleOpportunities = isRationalGateEnabled
    ? userVisibleOpportunities.filter((opportunity) => rationalGateResults.get(opportunity.id)?.passed)
    : userVisibleOpportunities;
  const pendingManualElements = uploadedImage
    ? manualElements.filter((element) => pendingManualElementIds.includes(element.id))
    : [];
  const isManualAnalysisPending = pendingManualElements.length > 0;
  const rationalGateFiltered = isRationalGateEnabled
    ? userVisibleOpportunities.filter((opportunity) => !rationalGateResults.get(opportunity.id)?.passed)
    : [];
  const usedKnowledgeRefs = useMemo(() => adoptedKnowledgeRefs(blueprint), [blueprint]);
  const selected = isManualAnalysisPending
    ? undefined
    : (selectedOpportunity(visibleOpportunities, selectedId) ?? firstOpportunity(visibleOpportunities));
  const selectedElement = selected ? elementFor(blueprint, selected) : undefined;
  const selectedManualElement =
    uploadedImage && selectedElement
      ? manualElements.find((element) => element.id === selectedElement.id)
      : undefined;

  function showPreview() {
    setIsPreviewPaused(false);
    setPreviewReplayKey((current) => current + 1);
    setViewMode("preview");
  }

  function togglePreviewPlayback() {
    setIsPreviewPaused((current) => !current);
  }

  function updateSelectedOpportunity(patch: Partial<MotionOpportunity>) {
    if (!selected) return;
    const nextBlueprint: MotionBlueprint = {
      ...blueprint,
      opportunities: blueprint.opportunities.map((opportunity) =>
        opportunity.id === selected.id ? { ...opportunity, ...patch } : opportunity
      )
    };
    setImportedBlueprint(nextBlueprint);
    setAnalysisWarnings(nextBlueprint.diagnostics.warnings);
  }

  function updateSelectedParams(patch: Partial<MotionOpportunity["recommendedParams"]>) {
    if (!selected) return;
    updateSelectedOpportunity({
      recommendedParams: {
        ...selected.recommendedParams,
        ...patch
      }
    });
    if (viewMode === "preview") setIsPreviewPaused(false);
  }

  async function rerunSelectedOpportunity() {
    if (!uploadedImage || !selectedElement || isAnalyzingImage) return;
    setIsAnalyzingImage(true);
    setUploadMessage("AI 正在重新分析当前机会点...");
    try {
      const response = await fetch("/api/motion-lens/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          source: uploadedImage.source,
          analysisSource: uploadedImage.analysisSource,
          imageDataUrl: uploadedImage.dataUrl,
          analysisImageDataUrl: uploadedImage.analysisDataUrl,
          goalText: effectiveGoalText,
          pageType,
          seedElements: [selectedElement]
        })
      });
      const payload = (await response.json()) as {
        mode?: "llm" | "fallback";
        message?: string;
        blueprint?: MotionBlueprint;
        error?: string;
      };
      if (!response.ok || !payload.blueprint) {
        throw new Error(payload.error || "AI 分析失败。");
      }
      setImportedBlueprint(payload.blueprint);
      setManualElements(payload.blueprint.elements);
      setAnalysisWarnings(payload.blueprint.diagnostics.warnings);
      setSelectedId(opportunityForElement(payload.blueprint, selectedElement.id)?.id ?? "");
      setUploadMessage(payload.message ?? "AI 已重新分析当前机会点。");
    } catch (error) {
      setUploadMessage(diagnosticMessage(error));
    } finally {
      setIsAnalyzingImage(false);
    }
  }

  function analyzeFixture() {
    setImportedBlueprint(null);
    setAnalysisWarnings([]);
    setPendingManualElementIds([]);
    if (uploadedImage) {
      setSelectedId("");
      setHiddenOpportunityIds([]);
      setViewMode("blueprint");
      return;
    }

    setSelectedId("");
    setHiddenOpportunityIds([]);
    setViewMode("blueprint");
  }

  function selectFixture(nextFixtureId: string) {
    const nextFixture = fixtureDrafts.find((item) => item.id === nextFixtureId);
    if (!nextFixture) return;
    setFixtureId(nextFixture.id);
    setImportedBlueprint(null);
    setPageType(nextFixture.pageType);
    setGoalText(nextFixture.defaultGoalText);
    setSelectedId("");
    setHiddenOpportunityIds([]);
    setManualElements([]);
    setPendingManualElementIds([]);
    setAnalysisWarnings([]);
    setUploadedImage(null);
    setPendingManualSelection(null);
    setIsManualAnnotationEnabled(false);
    setUploadMessage("");
    setViewMode("blueprint");
  }

  async function uploadDraft(file: File | undefined) {
    if (!file) return;
    try {
      const image = await readImage(file);
      setUploadedImage(image);
      setImportedBlueprint(null);
      setManualElements([]);
      setPendingManualElementIds([]);
      setAnalysisWarnings([]);
      setPendingManualSelection(null);
      setIsManualAnnotationEnabled(false);
      setIsAnalyzingImage(false);
      setSelectedId("");
      setHiddenOpportunityIds([]);
      setViewMode("blueprint");
      setUploadMessage(`${image.source.name} · ${image.source.width} x ${image.source.height}`);
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : "图片上传失败。");
    }
  }

  async function analyzeUploadedImage() {
    if (!uploadedImage || isAnalyzingImage) return;
    setIsAnalyzingImage(true);
    setUploadMessage("AI 正在分析稿件...");

    try {
      const response = await fetch("/api/motion-lens/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          source: uploadedImage.source,
          analysisSource: uploadedImage.analysisSource,
          imageDataUrl: uploadedImage.dataUrl,
          analysisImageDataUrl: uploadedImage.analysisDataUrl,
          goalText: effectiveGoalText,
          pageType
        })
      });
      const payload = (await response.json()) as {
        mode?: "llm" | "fallback";
        message?: string;
        blueprint?: MotionBlueprint;
        error?: string;
      };

      if (!response.ok || !payload.blueprint) {
        throw new Error(payload.error || "AI 分析失败。");
      }

      setImportedBlueprint(payload.blueprint);
      setAnalysisWarnings(payload.blueprint.diagnostics.warnings);
      setManualElements(payload.blueprint.elements);
      setPendingManualElementIds([]);
      setPendingManualSelection(null);
      setSelectedId("");
      setHiddenOpportunityIds([]);
      setViewMode("blueprint");
      setUploadMessage(
        `${uploadedImage.source.name} · ${uploadedImage.source.width} x ${uploadedImage.source.height} · ${
          payload.message ?? (payload.mode === "llm" ? "AI 分析完成。" : "已使用兜底分析。")
        }`
      );
    } catch (error) {
      setUploadMessage(diagnosticMessage(error));
    } finally {
      setIsAnalyzingImage(false);
    }
  }

  function createManualElement(bounds: DesignElement["bounds"], kind: ManualAnnotationKind) {
    if (!uploadedImage) return;
    const option = manualAnnotationOptionFor(kind);
    const id = `manual-${kind}-${Date.now()}`;
    const normalizedBounds = normalizeBounds(bounds, uploadedImage.source);
    const signals = manualElementSignals(option.elementKind, normalizedBounds, uploadedImage.source);
    const nextElement: DesignElement = {
      id,
      kind: option.elementKind,
      label: option.defaultLabel,
      bounds: normalizedBounds,
      confidence: 1,
      text: `人工标注类型：${option.label}`,
      ...signals
    };
    const nextElements = [...manualElements, nextElement];
    setManualElements(nextElements);
    setPendingManualElementIds((current) => [...current, id]);
    setAnalysisWarnings([manualPendingWarning]);
    setPendingManualSelection(null);
    setHiddenOpportunityIds([]);
    setSelectedId("");
    setViewMode("blueprint");
    setUploadMessage(
      `${uploadedImage.source.name} · 已添加 ${nextElements.length} 个手动标注，点击 AI 分析手动标注后生成机会点。`
    );
  }

  async function analyzeManualElements() {
    if (!uploadedImage || manualElements.length === 0 || isAnalyzingImage) return;
    const preferredElementId = pendingManualElementIds[0] ?? manualElements[manualElements.length - 1]?.id;
    setIsAnalyzingImage(true);
    setUploadMessage("AI 正在分析手动标注区域...");

    try {
      const response = await fetch("/api/motion-lens/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          source: uploadedImage.source,
          analysisSource: uploadedImage.analysisSource,
          imageDataUrl: uploadedImage.dataUrl,
          analysisImageDataUrl: uploadedImage.analysisDataUrl,
          goalText: effectiveGoalText,
          pageType,
          seedElements: manualElements
        })
      });
      const payload = (await response.json()) as {
        mode?: "llm" | "fallback";
        message?: string;
        blueprint?: MotionBlueprint;
        error?: string;
      };

      if (!response.ok || !payload.blueprint) {
        throw new Error(payload.error || "AI 分析失败。");
      }
      if (payload.mode === "fallback" || hasFallbackRecommendation(payload.blueprint)) {
        throw new Error(payload.message || "AI 未返回完整模型推荐，已停止展示 fallback。");
      }

      setImportedBlueprint(payload.blueprint);
      setAnalysisWarnings(payload.blueprint.diagnostics.warnings);
      setManualElements(payload.blueprint.elements);
      setPendingManualElementIds([]);
      setSelectedId(
        (preferredElementId ? opportunityForElement(payload.blueprint, preferredElementId)?.id : undefined) ??
          payload.blueprint.opportunities[0]?.id ??
          ""
      );
      setUploadMessage(
        `${uploadedImage.source.name} · ${uploadedImage.source.width} x ${uploadedImage.source.height} · ${
          payload.message ?? (payload.mode === "llm" ? "AI 已分析手动标注区域。" : "已使用兜底分析。")
        }`
      );
    } catch (error) {
      setAnalysisWarnings(["AI 手动标注分析失败；未展示 fallback，请检查模型配置后重试。"]);
      setUploadMessage(diagnosticMessage(error));
    } finally {
      setIsAnalyzingImage(false);
    }
  }

  function startDraftSelection(event: PointerEvent<HTMLDivElement>) {
    if (!uploadedImage || viewMode !== "blueprint" || !isManualAnnotationEnabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointInSource(event, uploadedImage.source);
    setPendingManualSelection(null);
    setDraftSelection({
      startX: point.x,
      startY: point.y,
      currentX: point.x,
      currentY: point.y
    });
  }

  function updateDraftSelection(event: PointerEvent<HTMLDivElement>) {
    if (!uploadedImage || !draftSelection) return;
    const point = pointInSource(event, uploadedImage.source);
    setDraftSelection((current) =>
      current
        ? {
            ...current,
            currentX: point.x,
            currentY: point.y
          }
        : null
    );
  }

  function finishDraftSelection(event: PointerEvent<HTMLDivElement>) {
    if (!uploadedImage || !draftSelection) return;
    const bounds = boundsFromSelection(draftSelection);
    const normalizedBounds = normalizeBounds(bounds, uploadedImage.source);
    const menuStyle = manualMenuFrameStyle(uploadedImage.source, normalizedBounds, event.currentTarget);
    setDraftSelection(null);
    setPendingManualSelection({ bounds: normalizedBounds, menuStyle });
  }

  function updateManualElementBounds(elementId: string, field: keyof DesignElement["bounds"], value: number) {
    if (!uploadedImage) return;
    setImportedBlueprint(null);
    setAnalysisWarnings([manualPendingWarning]);
    setPendingManualElementIds((current) =>
      current.includes(elementId) ? current : [...current, elementId]
    );
    setManualElements((current) =>
      current.map((element) => {
        if (element.id !== elementId) return element;
        const nextBounds = { ...element.bounds, [field]: value };
        return { ...element, bounds: normalizeBounds(nextBounds, uploadedImage.source) };
      })
    );
  }

  function deleteSelectedOpportunity() {
    if (!selected) return;
    if (uploadedImage) {
      if (importedBlueprint) {
        setImportedBlueprint({
          ...importedBlueprint,
          elements: importedBlueprint.elements.filter((element) => element.id !== selected.elementId),
          opportunities: importedBlueprint.opportunities.filter(
            (opportunity) => opportunity.id !== selected.id
          )
        });
      }
      setManualElements((current) => current.filter((element) => element.id !== selected.elementId));
      setPendingManualElementIds((current) =>
        current.filter((elementId) => elementId !== selected.elementId)
      );
    } else {
      setHiddenOpportunityIds((current) =>
        current.includes(selected.id) ? current : [...current, selected.id]
      );
    }
    setSelectedId("");
    setPendingManualSelection(null);
    setViewMode("blueprint");
  }

  async function importReview(file: File | undefined) {
    if (!file) return;
    try {
      const document = parseMotionDocument(JSON.parse(await readTextFile(file)) as unknown);
      const nextBlueprint = document.blueprint;
      setGoalText(nextBlueprint.context.goalText);
      setPageType(nextBlueprint.context.pageType);
      setManualElements(nextBlueprint.elements);
      setPendingManualElementIds([]);
      setAnalysisWarnings(nextBlueprint.diagnostics.warnings);
      setPendingManualSelection(null);
      setSelectedId("");
      setHiddenOpportunityIds([]);
      setViewMode("blueprint");

      if (document.assets?.imageDataUrl && nextBlueprint.source.kind === "image") {
        setUploadedImage({
          source: nextBlueprint.source,
          dataUrl: document.assets.imageDataUrl,
          analysisDataUrl: document.assets.imageDataUrl,
          analysisSource: nextBlueprint.source
        });
        setImportedBlueprint(null);
        setUploadMessage(
          `${nextBlueprint.source.name} · ${nextBlueprint.source.width} x ${nextBlueprint.source.height}`
        );
      } else {
        setUploadedImage(null);
        setImportedBlueprint(nextBlueprint);
        setUploadMessage("已导入蓝图；未包含图片资源。");
      }
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : "评审 JSON 导入失败。");
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <h1>MotionLens</h1>
            <p>动效机会洞察 · 设计师评审版</p>
          </div>
        </div>
        <span className="status-dot">AI 辅助 P1</span>
      </header>

      <section className="workspace">
        <aside className="left-panel">
          <section className="panel-section">
            <p className="eyebrow">稿件样例</p>
            <select value={fixtureId} onChange={(event) => selectFixture(event.target.value)}>
              {fixtureDrafts.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </section>

          <section className="panel-section">
            <p className="eyebrow">分析配置</p>
            <label className="field-label">
              <span>评审目标</span>
              <select
                value={reviewIntent}
                onChange={(event) => setReviewIntent(event.target.value as ReviewIntent)}
              >
                {reviewIntents.map((item) => (
                  <option value={item.value} key={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label">
              <span>业务目标</span>
              <textarea value={goalText} onChange={(event) => setGoalText(event.target.value)} />
            </label>
            <label className="field-label">
              <span>页面类型</span>
              <select value={pageType} onChange={(event) => setPageType(event.target.value)}>
                {pageTypeOptions.map((item) => (
                  <option value={item.value} key={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="switch-row config-switch">
              <span>开启理性过滤</span>
              <input
                type="checkbox"
                checked={isRationalGateEnabled}
                onChange={(event) => setIsRationalGateEnabled(event.target.checked)}
              />
            </label>
            <p className="muted-copy">先保留完整分析结果；开启后隐藏收益不足、缺少依据或风险过高的机会点。</p>
            <button className="primary-button" type="button" onClick={analyzeFixture}>
              重新分析
            </button>
          </section>

          <section className="panel-section">
            <p className="eyebrow">真实图片</p>
            <label className="upload-box">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => void uploadDraft(event.target.files?.[0])}
              />
              <span>上传设计稿</span>
            </label>
            <p className="muted-copy">
              {uploadMessage || "上传后可分析整张稿件；如已手动框选，请使用下方「AI 分析手动标注」。"}
            </p>
            {uploadedImage ? (
              <button
                className="primary-button"
                type="button"
                onClick={() => void analyzeUploadedImage()}
                disabled={isAnalyzingImage}
              >
                {isAnalyzingImage ? "AI 分析中..." : "AI 分析整张稿件"}
              </button>
            ) : null}
            <label className="upload-box secondary-upload">
              <input
                type="file"
                accept="application/json"
                onChange={(event) => void importReview(event.target.files?.[0])}
              />
              <span>导入评审 JSON</span>
            </label>
          </section>

          {uploadedImage ? (
            <section className="panel-section">
              <p className="eyebrow">手动标注</p>
              <label className="switch-row">
                <span>开启手动标注</span>
                <input
                  type="checkbox"
                  checked={isManualAnnotationEnabled}
                  onChange={(event) => {
                    setIsManualAnnotationEnabled(event.target.checked);
                    setDraftSelection(null);
                    setPendingManualSelection(null);
                  }}
                />
              </label>
              <p className="muted-copy">开启后，在稿件上拖拽框选区域，松开后在选框旁选择元素类型。</p>
              {isManualAnalysisPending ? (
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => void analyzeManualElements()}
                  disabled={isAnalyzingImage}
                >
                  {isAnalyzingImage ? "AI 分析中..." : "AI 分析手动标注"}
                </button>
              ) : null}
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setManualElements([]);
                  setPendingManualElementIds([]);
                  setAnalysisWarnings([]);
                  setSelectedId("");
                  setPendingManualSelection(null);
                }}
              >
                清空手动标注
              </button>
            </section>
          ) : null}

          <section className="panel-section">
            <p className="eyebrow">蓝图摘要</p>
            <div className="metric-grid">
              <div>
                <strong>{blueprint.elements.length}</strong>
                <span>识别元素</span>
              </div>
              <div>
                <strong>{visibleOpportunities.length}</strong>
                <span>机会点</span>
              </div>
              <div>
                <strong>{goalLabel(blueprint.context.inferredGoal)}</strong>
                <span>目标</span>
              </div>
              <div>
                <strong>{firstOpportunity(visibleOpportunities)?.score ?? "-"}</strong>
                <span>最高适配</span>
              </div>
            </div>
            {isRationalGateEnabled ? (
              <div className="gate-summary">
                <strong>理性过滤已开启</strong>
                <span>
                  已保留 {visibleOpportunities.length} 个，过滤 {rationalGateFiltered.length} 个。
                </span>
                {rationalGateFiltered.slice(0, 3).map((opportunity) => {
                  const gate = rationalGateResults.get(opportunity.id);
                  return (
                    <p key={opportunity.id}>
                      {opportunity.patternName}：{gate?.reasons[0] ?? "未通过理性过滤。"}
                    </p>
                  );
                })}
              </div>
            ) : null}
          </section>

          <section className="panel-section">
            <p className="eyebrow">诊断</p>
            <div className="diagnostic-list">
              {(blueprint.diagnostics.warnings.length > 0
                ? blueprint.diagnostics.warnings
                : ["暂无诊断信息。"]
              ).map((warning) => (
                <p className="muted-copy" key={warning}>
                  {warning}
                </p>
              ))}
            </div>
            {blueprint.diagnostics.noMotionSuggestions.length > 0 ? (
              <div className="no-motion-list">
                {blueprint.diagnostics.noMotionSuggestions.slice(0, 3).map((item) => (
                  <div key={item.elementId}>
                    <strong>{item.label}</strong>
                    <span>{item.reason}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          <section className="panel-section">
            <p className="eyebrow">模型配置</p>
            <div className="config-list">
              <span>
                模型 <strong>{modelConfig?.model ?? "读取中"}</strong>
              </span>
              <span>
                状态 <strong>{modelModeLabel(modelConfig)}</strong>
              </span>
              <span>
                Key <strong>{modelConfig?.hasApiKey ? "已配置" : "未配置"}</strong>
              </span>
              <span>
                超时 <strong>{modelConfig ? `${Math.round(modelConfig.timeoutMs / 1000)}s` : "-"}</strong>
              </span>
              <span className="config-endpoint">
                Endpoint <strong>{modelConfig?.endpoint ?? "-"}</strong>
              </span>
            </div>
          </section>

          <section className="panel-section">
            <p className="eyebrow">知识依据</p>
            {usedKnowledgeRefs.length > 0 ? (
              <div className="knowledge-summary">
                {usedKnowledgeRefs.slice(0, 6).map((ref) => (
                  <span key={`${ref.id}-${ref.pageRange}`}>
                    {ref.title} · {ref.pageRange}
                  </span>
                ))}
              </div>
            ) : (
              <p className="muted-copy">当前机会点暂无模型知识引用；样例或兜底结果可能只使用本地规则。</p>
            )}
          </section>
        </aside>

        <section className="stage-panel">
          <div className="stage-toolbar">
            <div>
              <h2>{viewMode === "blueprint" ? "稿件标注" : "动效预览"}</h2>
              <p>
                {viewMode === "blueprint"
                  ? "按优先级标出 3-5 个可评审机会点。"
                  : selected
                    ? paramLabel(selected)
                    : "当前蓝图暂无可预览机会点。"}
              </p>
            </div>
            <div className="stage-actions">
              <div className="segmented">
                <button
                  className={viewMode === "blueprint" ? "is-active" : ""}
                  type="button"
                  onClick={() => setViewMode("blueprint")}
                >
                  蓝图
                </button>
                <button
                  className={viewMode === "preview" ? "is-active" : ""}
                  type="button"
                  onClick={showPreview}
                >
                  预览
                </button>
              </div>
              {viewMode === "preview" && selected ? (
                <button className="playback-button" type="button" onClick={togglePreviewPlayback}>
                  {isPreviewPaused ? "继续" : "暂停"}
                </button>
              ) : null}
            </div>
          </div>

          <div className="canvas-wrap">
            <div className="draft-frame">
              {viewMode === "preview" && selected ? (
                <Preview
                  blueprint={blueprint}
                  opportunity={selected}
                  isPaused={isPreviewPaused}
                  key={`${selected.id}-${previewReplayKey}`}
                />
              ) : (
                <div
                  className={
                    uploadedImage && isManualAnnotationEnabled ? "draft-surface is-markable" : "draft-surface"
                  }
                  onPointerDown={uploadedImage && isManualAnnotationEnabled ? startDraftSelection : undefined}
                  onPointerMove={
                    uploadedImage && isManualAnnotationEnabled ? updateDraftSelection : undefined
                  }
                  onPointerUp={uploadedImage && isManualAnnotationEnabled ? finishDraftSelection : undefined}
                  onPointerCancel={() => setDraftSelection(null)}
                  style={draftSurfaceStyle(blueprint.source)}
                >
                  {uploadedImage ? (
                    <img
                      className="uploaded-draft"
                      src={uploadedImage.dataUrl}
                      alt={uploadedImage.source.name}
                      draggable={false}
                    />
                  ) : (
                    <MockDraft fixtureId={fixtureId} />
                  )}
                  {viewMode === "blueprint" && visibleOpportunities.length > 0 ? (
                    <div className={selected ? "marker-layer has-active" : "marker-layer"}>
                      {visibleOpportunities.map((opportunity) => {
                        const element = elementFor(blueprint, opportunity);
                        if (!element) return null;
                        return (
                          <button
                            type="button"
                            className={opportunity.id === selected?.id ? "marker is-active" : "marker"}
                            style={markerStyle(blueprint, element)}
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedId(opportunity.id);
                            }}
                            key={opportunity.id}
                          >
                            <span>
                              {opportunity.priority} · {element.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : uploadedImage ? null : (
                    <div className="fallback-overlay">
                      <strong>暂无机会点</strong>
                      <p>{blueprint.diagnostics.warnings[0] ?? "请切换样例或接入视觉模型后生成机会点。"}</p>
                    </div>
                  )}
                  {viewMode === "blueprint" && uploadedImage && pendingManualElements.length > 0 ? (
                    <div className="manual-marker-layer">
                      {pendingManualElements.map((element) => (
                        <div
                          className="manual-marker"
                          style={boundsStyle(uploadedImage.source, element.bounds)}
                          key={element.id}
                        >
                          <span>{element.label} · 待分析</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {uploadedImage && draftSelection ? (
                    <div
                      className="selection-box"
                      style={boundsStyle(uploadedImage.source, boundsFromSelection(draftSelection))}
                    />
                  ) : null}
                  {uploadedImage && pendingManualSelection ? (
                    <div
                      className="selection-box is-pending"
                      style={boundsStyle(uploadedImage.source, pendingManualSelection.bounds)}
                    />
                  ) : null}
                </div>
              )}
              {viewMode === "blueprint" && uploadedImage && pendingManualSelection ? (
                <div
                  className="manual-kind-menu"
                  style={pendingManualSelection.menuStyle}
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  {manualAnnotationOptions.map((item) => (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        createManualElement(pendingManualSelection.bounds, item.kind);
                      }}
                      key={item.kind}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <aside className="right-panel">
          <section className="panel-section">
            <p className="eyebrow">机会点</p>
            <div className="opportunity-list">
              {visibleOpportunities.length === 0 ? (
                <p className="empty-state">
                  {isRationalGateEnabled ? "理性过滤后暂无机会点。" : "当前蓝图没有自动机会点。"}
                </p>
              ) : null}
              {visibleOpportunities.map((opportunity) => {
                const reviewFlags = reviewFlagsForOpportunity(blueprint, opportunity);
                return (
                  <button
                    className={opportunity.id === selected?.id ? "opportunity is-active" : "opportunity"}
                    type="button"
                    onClick={() => {
                      setSelectedId(opportunity.id);
                      setViewMode("blueprint");
                    }}
                    key={opportunity.id}
                  >
                    <span className="opportunity-head">
                      <strong>{opportunity.priority}</strong>
                      <b>{opportunity.patternName}</b>
                      <em>{opportunity.score} 适配</em>
                    </span>
                    <span className={`source-pill source-${opportunity.recommendationSource}`}>
                      {recommendationSourceLabel(opportunity.recommendationSource)}
                    </span>
                    {reviewFlags.length > 0 ? (
                      <span className="review-flag-list" aria-label="复核提示">
                        {reviewFlags.map((flag) => (
                          <span className="review-flag" title={flag.reason} key={flag.label}>
                            {flag.label}
                          </span>
                        ))}
                      </span>
                    ) : null}
                    {opportunity.id === selected?.id ? (
                      <small>
                        {frictionLabel(opportunity.friction)} · {strategyLabel(opportunity.strategy)} ·
                        知识依据 {opportunity.knowledgeRefs?.length ?? 0}
                      </small>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="panel-section detail-section">
            <p className="eyebrow">详情</p>
            {selected ? (
              <>
                <div className="detail-heading">
                  <div>
                    <h3>{selectedElement?.label ?? "未知元素"}</h3>
                    <p>{selected.patternName}</p>
                  </div>
                  <span>
                    {selected.priority} · {selected.score}
                  </span>
                </div>
                <div className={`source-banner source-${selected.recommendationSource}`}>
                  {recommendationSourceLabel(selected.recommendationSource)}
                </div>

                <div className="detail-tabs" role="tablist" aria-label="机会点详情">
                  {detailTabs.map((tab) => (
                    <button
                      className={activeDetailTab === tab.id ? "detail-tab is-active" : "detail-tab"}
                      type="button"
                      role="tab"
                      aria-selected={activeDetailTab === tab.id}
                      onClick={() => setActiveDetailTab(tab.id)}
                      key={tab.id}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {activeDetailTab === "recommendation" ? (
                  <>
                    <p className="section-title">
                      推荐内容 <span>系统结论</span>
                    </p>
                    <div className="detail-card conclusion-card">
                      <div className="conclusion-block">
                        <span>推荐动效</span>
                        <strong>{selected.patternName}</strong>
                      </div>
                      <div className="conclusion-block">
                        <span>推荐理由</span>
                        <p>{selected.reason}</p>
                      </div>
                      <div className="conclusion-block">
                        <span>备选动效</span>
                        {selected.alternativeRecommendations &&
                        selected.alternativeRecommendations.length > 0 ? (
                          <div className="alternative-list">
                            {selected.alternativeRecommendations.map((item) => (
                              <article key={`${item.patternId}-${item.patternName}`}>
                                <strong>{item.patternName}</strong>
                                <p>{item.reason}</p>
                                <small>
                                  {paramLabel({ ...selected, recommendedParams: item.recommendedParams })}
                                </small>
                              </article>
                            ))}
                          </div>
                        ) : (
                          <p>当前机会点暂无合适备选动效。</p>
                        )}
                      </div>
                      <div className="conclusion-block">
                        <span>运动说明</span>
                        <p>{selected.recommendedParams.transform ?? "模型未返回具体动作轨迹。"}</p>
                      </div>
                      <div className="conclusion-block">
                        <span>风险约束</span>
                        <ul className="risk-list">
                          {selected.risks.map((risk) => (
                            <li key={risk}>{risk}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </>
                ) : null}

                {activeDetailTab === "evidence" ? (
                  <>
                    <p className="section-title">
                      评审依据 <span>模型解释</span>
                    </p>
                    {selected.reviewEvidence ? (
                      <div className="detail-card evidence-card">
                        <div>
                          <span>为什么选它</span>
                          <p>{selected.reviewEvidence.whyThisMotion}</p>
                        </div>
                        <div>
                          <span>为什么不是其他动效</span>
                          <p>{selected.reviewEvidence.whyNotAlternatives}</p>
                        </div>
                        <div>
                          <span>是否可以不动</span>
                          <p>{selected.reviewEvidence.noMotionAssessment}</p>
                        </div>
                        <div>
                          <span>同屏差异</span>
                          <p>{selected.reviewEvidence.differentiation}</p>
                        </div>
                        <div>
                          <span>触发时机</span>
                          <p>{selected.reviewEvidence.trigger}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="empty-state">当前机会点暂无模型评审依据。</p>
                    )}
                  </>
                ) : null}

                {activeDetailTab === "preview" ? (
                  <>
                    <p className="section-title">
                      预览参数 <span>{viewMode === "preview" ? "正在驱动预览" : "可调"}</span>
                    </p>
                    <div
                      className={
                        viewMode === "preview"
                          ? "detail-card parameter-card is-live"
                          : "detail-card parameter-card"
                      }
                    >
                      <label className="range-label">
                        <span>
                          时长 <strong>{selected.recommendedParams.durationMs}ms</strong>
                        </span>
                        <input
                          type="range"
                          value={selected.recommendedParams.durationMs}
                          min={80}
                          max={800}
                          step={20}
                          onChange={(event) =>
                            updateSelectedParams({ durationMs: Number(event.target.value) })
                          }
                        />
                      </label>
                      <div className="parameter-grid">
                        <label>
                          <span>缓动</span>
                          <select
                            value={selected.recommendedParams.easing}
                            onChange={(event) =>
                              updateSelectedParams({
                                easing: event.target.value as MotionOpportunity["recommendedParams"]["easing"]
                              })
                            }
                          >
                            {(["standard", "decelerate", "accelerate", "sharp", "spring"] as const).map(
                              (item) => (
                                <option value={item} key={item}>
                                  {easingLabel(item)}
                                </option>
                              )
                            )}
                          </select>
                        </label>
                      </div>
                      <label className="range-label">
                        <span>
                          延迟 <strong>{selected.recommendedParams.delayMs ?? 0}ms</strong>
                        </span>
                        <input
                          type="range"
                          value={selected.recommendedParams.delayMs ?? 0}
                          min={0}
                          max={1000}
                          step={20}
                          onChange={(event) => updateSelectedParams({ delayMs: Number(event.target.value) })}
                        />
                      </label>
                      <div className="param-list">
                        <span>{selected.recommendedParams.durationMs}ms</span>
                        <span>延迟 {selected.recommendedParams.delayMs ?? 0}ms</span>
                        <span>{easingLabel(selected.recommendedParams.easing)}</span>
                        <span>建议重复 {repeatLabel(selected.recommendedParams.repeat)}</span>
                      </div>
                    </div>
                    {selectedManualElement && uploadedImage ? (
                      <div className="layout-controls">
                        <p className="eyebrow">标注位置</p>
                        {(["x", "y", "width", "height"] as const).map((field) => (
                          <label key={field}>
                            <span>{boundsFieldLabel(field)}</span>
                            <input
                              type="number"
                              value={selectedManualElement.bounds[field]}
                              min={
                                field === "width"
                                  ? Math.min(24, uploadedImage.source.width)
                                  : field === "height"
                                    ? Math.min(24, uploadedImage.source.height)
                                    : 0
                              }
                              max={
                                field === "x" || field === "width"
                                  ? uploadedImage.source.width
                                  : uploadedImage.source.height
                              }
                              onChange={(event) =>
                                updateManualElementBounds(
                                  selectedManualElement.id,
                                  field,
                                  Number(event.target.value)
                                )
                              }
                            />
                          </label>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : null}

                {activeDetailTab === "analysis" ? (
                  <>
                    <p className="section-title">
                      分析维度 <span>只读</span>
                    </p>
                    <div className="detail-card">
                      <div className="analysis-grid">
                        <span>
                          阶段 <strong>{stageLabel(selected.decisionStage)}</strong>
                        </span>
                        <span>
                          阻力 <strong>{frictionLabel(selected.friction)}</strong>
                        </span>
                        <span>
                          策略 <strong>{strategyLabel(selected.strategy)}</strong>
                        </span>
                        <span>
                          知识依据 <strong>{selected.knowledgeRefs?.length ?? 0} 条</strong>
                        </span>
                        <span>
                          来源 <strong>{recommendationSourceLabel(selected.recommendationSource)}</strong>
                        </span>
                      </div>
                    </div>
                    {selected.knowledgeRefs && selected.knowledgeRefs.length > 0 ? (
                      <div className="knowledge-ref-list">
                        <p className="eyebrow">知识依据</p>
                        {selected.knowledgeRefs.map((ref) => (
                          <span key={`${ref.id}-${ref.pageRange}`}>
                            {ref.title} · {ref.source} · {ref.pageRange}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="empty-state">当前机会点暂无模型知识引用。</p>
                    )}
                  </>
                ) : null}
                <button className="danger-button" type="button" onClick={deleteSelectedOpportunity}>
                  删除当前机会点
                </button>
                {uploadedImage ? (
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => void rerunSelectedOpportunity()}
                    disabled={isAnalyzingImage}
                  >
                    重新分析当前机会点
                  </button>
                ) : null}
                <button className="primary-button" type="button" onClick={showPreview}>
                  查看动效预览
                </button>
              </>
            ) : (
              <>
                <h3>{isManualAnalysisPending ? "手动标注待分析" : "等待视觉分析"}</h3>
                <p>
                  {isManualAnalysisPending
                    ? `已标注 ${pendingManualElements.length} 个区域，点击左侧「AI 分析手动标注」后生成模型推荐。`
                    : blueprint.diagnostics.warnings[0]}
                </p>
              </>
            )}
            <button
              className="secondary-button"
              type="button"
              onClick={() =>
                downloadJson(
                  `motionlens-${blueprint.source.id}.json`,
                  reviewExportPayload(blueprint, uploadedImage)
                )
              }
            >
              导出评审 JSON
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() =>
                downloadHtml(
                  `motionlens-${blueprint.source.id}.html`,
                  reviewReportHtml(blueprint, uploadedImage)
                )
              }
            >
              导出评审 HTML
            </button>
          </section>
        </aside>
      </section>
    </main>
  );
}
