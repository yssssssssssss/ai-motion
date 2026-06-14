import type { MotionBlueprint, MotionOpportunity } from "@motion-lens/core";
import { paramLabel } from "./preview";

type UploadedReportImage = {
  source: {
    name: string;
  };
  dataUrl: string;
};

export function reviewReportHtml(
  blueprint: MotionBlueprint,
  uploadedImage: UploadedReportImage | null
): string {
  const rows = blueprint.opportunities.map(opportunityRow(blueprint)).join("");
  const markers = blueprint.opportunities.map(opportunityMarker(blueprint)).join("");
  const imageBlock = uploadedImage
    ? `<section class="section"><h2>标注稿件</h2><div class="image-wrap"><img src="${uploadedImage.dataUrl}" alt="${escapeHtml(uploadedImage.source.name)}">${markers}</div></section>`
    : "";
  const riskItems = riskSummary(blueprint)
    .map(
      (item) =>
        `<li><strong>${escapeHtml(item.patternName)}</strong><span>${escapeHtml(item.risk)}</span></li>`
    )
    .join("");
  const noMotionItems = blueprint.diagnostics.noMotionSuggestions
    .map(
      (item) => `<li><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.reason)}</span></li>`
    )
    .join("");
  const diagnosticItems = blueprint.diagnostics.warnings
    .map((warning) => `<li><span>${escapeHtml(warning)}</span></li>`)
    .join("");
  const evidenceItems = blueprint.opportunities.map(evidenceItem(blueprint)).filter(Boolean).join("");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>MotionLens 评审报告</title>
  <style>
    body { margin: 32px; color: #151a17; font: 14px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    h1 { margin: 0 0 8px; font-size: 24px; }
    h2 { margin: 0 0 12px; font-size: 18px; }
    .meta { color: #68736d; margin-bottom: 20px; }
    .summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 0 0 24px; }
    .summary div { border: 1px solid #d9ded8; border-radius: 8px; padding: 10px; }
    .summary strong { display: block; font-size: 18px; }
    .summary span { color: #68736d; font-size: 12px; }
    .section { margin-top: 24px; break-inside: avoid; }
    .image-wrap { position: relative; display: inline-block; max-width: 100%; }
    img { display: block; max-width: 100%; max-height: 720px; object-fit: contain; border: 1px solid #d9ded8; border-radius: 8px; }
    .marker { position: absolute; min-width: 20px; min-height: 20px; padding: 1px 5px; border: 2px solid #d9822b; background: rgba(217, 130, 43, 0.18); color: #151a17; font-weight: 800; }
    table { width: 100%; margin-top: 12px; border-collapse: collapse; table-layout: fixed; }
    th, td { padding: 10px; border: 1px solid #d9ded8; vertical-align: top; text-align: left; }
    th { background: #f6f7f4; }
    ul { display: grid; gap: 8px; padding: 0; list-style: none; }
    li { border: 1px solid #d9ded8; border-radius: 8px; padding: 10px; }
    li strong { display: block; }
    li span { color: #68736d; }
    @media print {
      body { margin: 18mm; }
      img { max-height: 560px; }
      table { font-size: 12px; }
      .section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>MotionLens 评审报告</h1>
  <div class="meta">${escapeHtml(blueprint.source.name)} · ${escapeHtml(blueprint.context.pageType)} · ${escapeHtml(blueprint.context.goalText)}</div>
  <div class="summary">
    <div><strong>${blueprint.elements.length}</strong><span>识别元素</span></div>
    <div><strong>${blueprint.opportunities.length}</strong><span>机会点</span></div>
    <div><strong>${blueprint.diagnostics.noMotionSuggestions.length}</strong><span>不建议动效</span></div>
    <div><strong>${blueprint.opportunities[0]?.score ?? "-"}</strong><span>最高适配</span></div>
  </div>
  ${imageBlock}
  <section class="section">
    <h2>机会点明细</h2>
    <table>
      <thead>
        <tr><th>编号</th><th>优先级</th><th>元素</th><th>推荐来源</th><th>推荐动效</th><th>理由</th><th>参数</th><th>知识依据</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </section>
  ${riskItems ? `<section class="section"><h2>风险汇总</h2><ul>${riskItems}</ul></section>` : ""}
  ${evidenceItems ? `<section class="section"><h2>评审依据</h2><ul>${evidenceItems}</ul></section>` : ""}
  ${
    noMotionItems ? `<section class="section"><h2>不建议动效区域</h2><ul>${noMotionItems}</ul></section>` : ""
  }
  ${diagnosticItems ? `<section class="section"><h2>诊断信息</h2><ul>${diagnosticItems}</ul></section>` : ""}
</body>
</html>`;
}

function evidenceItem(blueprint: MotionBlueprint) {
  return (opportunity: MotionOpportunity) => {
    if (!opportunity.reviewEvidence) return "";
    const element = elementFor(blueprint, opportunity);
    return `<li>
      <strong>${escapeHtml(opportunity.patternName)} / ${escapeHtml(element?.label ?? opportunity.elementId)}</strong>
      <span>为什么选它：${escapeHtml(opportunity.reviewEvidence.whyThisMotion)}</span><br>
      <span>为什么不是其他动效：${escapeHtml(opportunity.reviewEvidence.whyNotAlternatives)}</span><br>
      <span>是否可以不动：${escapeHtml(opportunity.reviewEvidence.noMotionAssessment)}</span><br>
      <span>同屏差异：${escapeHtml(opportunity.reviewEvidence.differentiation)}</span><br>
      <span>触发时机：${escapeHtml(opportunity.reviewEvidence.trigger)}</span>
    </li>`;
  };
}

function opportunityRow(blueprint: MotionBlueprint) {
  return (opportunity: MotionOpportunity, index: number) => {
    const element = elementFor(blueprint, opportunity);
    const alternatives = alternativeSummary(opportunity);
    const refs =
      opportunity.knowledgeRefs
        ?.map((ref) => `${escapeHtml(ref.title)} / ${escapeHtml(ref.pageRange)}`)
        .join("<br>") ?? "-";
    return `<tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(opportunity.priority)}</td>
      <td>${escapeHtml(element?.label ?? opportunity.elementId)}</td>
      <td>${escapeHtml(recommendationSourceLabel(opportunity.recommendationSource))}</td>
      <td>${escapeHtml(opportunity.patternName)}${alternatives ? `<br><small>${alternatives}</small>` : ""}</td>
      <td>${escapeHtml(opportunity.reason)}</td>
      <td>${escapeHtml(paramLabel(opportunity))}</td>
      <td>${refs}</td>
    </tr>`;
  };
}

function alternativeSummary(opportunity: MotionOpportunity): string {
  if (!opportunity.alternativeRecommendations?.length) return "";
  return opportunity.alternativeRecommendations
    .map((item) => {
      const params = paramLabel({ ...opportunity, recommendedParams: item.recommendedParams });
      return `备选：${escapeHtml(item.patternName)}（${escapeHtml(item.reason)}；${escapeHtml(params)}）`;
    })
    .join("<br>");
}

function recommendationSourceLabel(source: MotionOpportunity["recommendationSource"]): string {
  if (source === "llm-opportunity") return "AI 原生推荐";
  if (source === "llm-candidate-rule-recommendation") return "AI 识别 + 规则推荐";
  if (source === "manual-pending") return "待 AI 分析";
  return "本地兜底";
}

function opportunityMarker(blueprint: MotionBlueprint) {
  return (opportunity: MotionOpportunity, index: number) => {
    const element = elementFor(blueprint, opportunity);
    if (!element) return "";
    return `<span class="marker" style="left:${(element.bounds.x / blueprint.source.width) * 100}%;top:${(element.bounds.y / blueprint.source.height) * 100}%;width:${(element.bounds.width / blueprint.source.width) * 100}%;height:${(element.bounds.height / blueprint.source.height) * 100}%;">${index + 1}</span>`;
  };
}

function riskSummary(blueprint: MotionBlueprint): Array<{ patternName: string; risk: string }> {
  return blueprint.opportunities.flatMap((opportunity) =>
    opportunity.risks.map((risk) => ({
      patternName: opportunity.patternName,
      risk
    }))
  );
}

function elementFor(blueprint: MotionBlueprint, opportunity: MotionOpportunity) {
  return blueprint.elements.find((element) => element.id === opportunity.elementId);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
