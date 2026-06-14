import { motionKnowledgeItems } from "./retrieval";
import type { KnowledgeSourceId, MotionKnowledgeItem } from "./schema";
import { knowledgeSources } from "./sources";

export type KnowledgeValidationIssue = {
  severity: "error" | "warning";
  itemId?: string;
  message: string;
};

export type KnowledgeProductionManifest = {
  generatedAt: string;
  sourceCount: number;
  itemCount: number;
  countsByType: Record<MotionKnowledgeItem["type"], number>;
  countsBySource: Record<KnowledgeSourceId, number>;
  issues: KnowledgeValidationIssue[];
};

export function createKnowledgeProductionManifest(now: Date = new Date()): KnowledgeProductionManifest {
  return {
    generatedAt: now.toISOString(),
    sourceCount: Object.keys(knowledgeSources).length,
    itemCount: motionKnowledgeItems.length,
    countsByType: countByType(motionKnowledgeItems),
    countsBySource: countBySource(motionKnowledgeItems),
    issues: validateMotionKnowledgeBase(motionKnowledgeItems)
  };
}

export function validateMotionKnowledgeBase(
  items: MotionKnowledgeItem[] = motionKnowledgeItems
): KnowledgeValidationIssue[] {
  const issues: KnowledgeValidationIssue[] = [];
  const seenIds = new Set<string>();

  for (const item of items) {
    if (seenIds.has(item.id)) {
      issues.push({ severity: "error", itemId: item.id, message: "知识条目 id 重复。" });
    }
    seenIds.add(item.id);

    if (!item.title.trim() || !item.summary.trim()) {
      issues.push({ severity: "error", itemId: item.id, message: "知识条目缺少标题或摘要。" });
    }

    if (item.sourceRefs.length === 0) {
      issues.push({ severity: "error", itemId: item.id, message: "知识条目缺少来源引用。" });
    }

    for (const ref of item.sourceRefs) {
      if (!knowledgeSources[ref.sourceId]) {
        issues.push({ severity: "error", itemId: item.id, message: `未知来源：${ref.sourceId}` });
      }
      if (!ref.pageRange.trim() || ref.pageRange === "未标注") {
        issues.push({ severity: "warning", itemId: item.id, message: "来源引用缺少页码范围。" });
      }
      if (!ref.quote.trim()) {
        issues.push({ severity: "warning", itemId: item.id, message: "来源引用缺少短摘录。" });
      }
    }

    if (item.appliesTo.length === 0 || item.goals.length === 0) {
      issues.push({ severity: "warning", itemId: item.id, message: "知识条目缺少适用元素或目标标签。" });
    }

    if (item.type === "pattern" && item.params.durationMs[0] > item.params.durationMs[1]) {
      issues.push({ severity: "error", itemId: item.id, message: "动效模式时长范围无效。" });
    }
  }

  return issues;
}

function countByType(items: MotionKnowledgeItem[]): Record<MotionKnowledgeItem["type"], number> {
  return {
    principle: items.filter((item) => item.type === "principle").length,
    pattern: items.filter((item) => item.type === "pattern").length,
    case: items.filter((item) => item.type === "case").length,
    "risk-rule": items.filter((item) => item.type === "risk-rule").length
  };
}

function countBySource(items: MotionKnowledgeItem[]): Record<KnowledgeSourceId, number> {
  const counts = Object.fromEntries(Object.keys(knowledgeSources).map((sourceId) => [sourceId, 0])) as Record<
    KnowledgeSourceId,
    number
  >;

  for (const item of items) {
    for (const ref of item.sourceRefs) {
      if (ref.sourceId in counts) {
        counts[ref.sourceId] += 1;
      }
    }
  }

  return counts;
}
