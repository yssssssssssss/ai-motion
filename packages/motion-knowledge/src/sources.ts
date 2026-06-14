import type { KnowledgeSourceId } from "./schema";

export const knowledgeSources: Record<KnowledgeSourceId, { title: string; path: string; role: string }> = {
  "motion-design-spec": {
    title: "动效设计规范系统（ing~）",
    path: "/Users/heyunshen/Downloads/动效设计规范系统（ing~）.pdf",
    role: "动效原则、参数、层级、风险约束"
  },
  "human-empathy-research": {
    title: "人文共情-创造更有温度的用户体验-动态化趣味性场景设计预研",
    path: "/Users/heyunshen/Downloads/人文共情-创造更有温度的用户体验-动态化趣味性场景设计预研.pdf",
    role: "电商链路场景、竞品案例、趣味化触点策略"
  }
};
