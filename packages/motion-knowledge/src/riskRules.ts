import type { MotionRiskRule } from "./schema";

export const motionRiskRules: MotionRiskRule[] = [
  {
    id: "risk-visual-noise",
    type: "risk-rule",
    title: "避免多处动效同时进行",
    summary: "多个动效同时播放会制造视觉噪点，分散核心内容注意力。",
    risk: "用户无法判断当前应关注哪里，导致感知割裂。",
    mitigation: "同屏只保留一个主强调动效，其余使用静态或极短反馈。",
    appliesTo: ["button", "card", "content", "feedback", "icon"],
    goals: ["attention", "efficiency"],
    pageTypes: ["all"],
    tags: ["视觉噪点", "同时播放", "注意力", "风险"],
    sourceRefs: [
      {
        sourceId: "motion-design-spec",
        sourceTitle: "动效设计规范系统（ing~）",
        pageRange: "1-2",
        quote: "视觉噪点多，多处动效同时进行。"
      }
    ]
  },
  {
    id: "risk-performance-heavy-motion",
    type: "risk-rule",
    title: "避免高性能消耗动效",
    summary: "复杂动效容易导致低端机型卡顿、掉帧。",
    risk: "性能不稳定会破坏操作信任感。",
    mitigation: "优先使用 transform 与 opacity；大面积动效控制数量和时长。",
    appliesTo: ["card", "modal", "content", "loading", "list"],
    goals: ["efficiency", "trust"],
    pageTypes: ["all"],
    tags: ["性能", "掉帧", "transform", "opacity", "风险"],
    sourceRefs: [
      {
        sourceId: "motion-design-spec",
        sourceTitle: "动效设计规范系统（ing~）",
        pageRange: "1",
        quote: "滥用高性能消耗的动效，导致低端机型卡顿、掉帧。"
      }
    ]
  },
  {
    id: "risk-looping-attention",
    type: "risk-rule",
    title: "避免循环吸睛",
    summary: "强调类动效应一次性触发，不应持续循环。",
    risk: "循环动效会压过用户的阅读和操作任务。",
    mitigation: "仅在首次进入、关键状态变化或用户触发后播放一次。",
    appliesTo: ["button", "card", "icon", "feedback"],
    goals: ["attention", "conversion"],
    pageTypes: ["commerce", "product-detail", "checkout", "all"],
    tags: ["循环", "吸睛", "CTA", "风险"],
    sourceRefs: [
      {
        sourceId: "motion-design-spec",
        sourceTitle: "动效设计规范系统（ing~）",
        pageRange: "1, 8-10",
        quote: "杜绝为了动而动的无效设计。"
      }
    ]
  },
  {
    id: "risk-fun-over-function",
    type: "risk-rule",
    title: "功能大于趣味",
    summary: "趣味动效必须服务交互逻辑和用户认知。",
    risk: "过度趣味化会干扰核心购买、支付、搜索等任务。",
    mitigation: "趣味动效仅用于低风险反馈、空状态、完成态、品牌心智场景。",
    appliesTo: ["button", "feedback", "icon", "content", "loading"],
    goals: ["emotion", "retention", "feedback"],
    pageTypes: ["commerce", "search", "checkout", "order", "review"],
    tags: ["趣味", "功能", "人文共情", "风险"],
    sourceRefs: [
      {
        sourceId: "human-empathy-research",
        sourceTitle: "人文共情-创造更有温度的用户体验-动态化趣味性场景设计预研",
        pageRange: "2-3",
        quote: "动态设计服务于交互逻辑与用户认知，不做无意义、过度花哨的动效堆砌。"
      }
    ]
  }
];
