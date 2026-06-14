import { motionCases } from "./cases";
import { motionPatternKnowledge } from "./patterns";
import { motionPrinciples } from "./principles";
import { motionRiskRules } from "./riskRules";
import type { KnowledgeQuery, KnowledgeSearchHit, MotionKnowledgeItem } from "./schema";

export const motionKnowledgeItems: MotionKnowledgeItem[] = [
  ...motionPrinciples,
  ...motionPatternKnowledge,
  ...motionCases,
  ...motionRiskRules
];

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s,，。；;:：/|、()（）[\]{}"'`]+/u)
    .map((token) => token.trim())
    .filter(Boolean);
}

function fieldText(item: MotionKnowledgeItem): string {
  return [
    item.id,
    item.title,
    item.summary,
    item.tags.join(" "),
    item.appliesTo.join(" "),
    item.goals.join(" "),
    item.pageTypes.join(" ")
  ].join(" ");
}

export function retrieveMotionKnowledge(query: KnowledgeQuery = {}): KnowledgeSearchHit[] {
  const limit = query.limit ?? 8;
  const queryTokens = tokenize(query.query ?? "");

  return motionKnowledgeItems
    .map((item) => {
      const matchedBy: string[] = [];
      let score = 0;

      if (query.elementKind && item.appliesTo.includes(query.elementKind)) {
        score += 4;
        matchedBy.push(`elementKind:${query.elementKind}`);
      }

      if (query.goal && item.goals.includes(query.goal)) {
        score += 3;
        matchedBy.push(`goal:${query.goal}`);
      }

      if (query.pageType && (item.pageTypes.includes(query.pageType) || item.pageTypes.includes("all"))) {
        score += 2;
        matchedBy.push(`pageType:${query.pageType}`);
      }

      const haystack = fieldText(item).toLowerCase();
      for (const token of queryTokens) {
        if (haystack.includes(token)) {
          score += 1;
          matchedBy.push(`query:${token}`);
        }
      }

      return { item, score, matchedBy };
    })
    .filter((hit) => hit.score > 0)
    .sort((left, right) => right.score - left.score || left.item.id.localeCompare(right.item.id))
    .slice(0, limit);
}
