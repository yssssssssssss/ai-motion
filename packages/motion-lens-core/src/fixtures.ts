import type { FixtureDraft } from "./schema";

function source(id: string, name: string): FixtureDraft["source"] {
  return {
    kind: "fixture",
    id,
    name,
    width: 1120,
    height: 760
  };
}

export const fixtureDrafts: FixtureDraft[] = [
  {
    id: "commerce-product",
    name: "电商商品页",
    pageType: "commerce",
    defaultGoalText: "提高购买按钮点击率",
    source: source("commerce-product", "commerce-product.png"),
    elements: [
      {
        id: "buy-cta",
        kind: "button",
        label: "立即购买",
        text: "立即购买",
        bounds: { x: 112, y: 610, width: 196, height: 54 },
        confidence: 0.96,
        visualWeight: 0.62,
        interactiveLikelihood: 0.98
      },
      {
        id: "feature-cards",
        kind: "card",
        label: "卖点卡片组",
        bounds: { x: 650, y: 468, width: 350, height: 176 },
        confidence: 0.88,
        visualWeight: 0.54,
        interactiveLikelihood: 0.32
      },
      {
        id: "success-feedback",
        kind: "feedback",
        label: "购买反馈",
        bounds: { x: 780, y: 642, width: 240, height: 58 },
        confidence: 0.78,
        visualWeight: 0.38,
        interactiveLikelihood: 0.44
      }
    ]
  },
  {
    id: "ai-result",
    name: "AI 结果页",
    pageType: "ai",
    defaultGoalText: "帮助用户理解 AI 生成结果",
    source: source("ai-result", "ai-result.png"),
    elements: [
      {
        id: "prompt-submit",
        kind: "button",
        label: "生成按钮",
        text: "生成",
        bounds: { x: 870, y: 620, width: 132, height: 48 },
        confidence: 0.92,
        visualWeight: 0.5,
        interactiveLikelihood: 0.95
      },
      {
        id: "answer-content",
        kind: "content",
        label: "AI 结果正文",
        bounds: { x: 92, y: 162, width: 690, height: 430 },
        confidence: 0.9,
        visualWeight: 0.76,
        interactiveLikelihood: 0.2
      },
      {
        id: "status-feedback",
        kind: "feedback",
        label: "生成状态",
        bounds: { x: 92, y: 610, width: 310, height: 52 },
        confidence: 0.84,
        visualWeight: 0.42,
        interactiveLikelihood: 0.4
      }
    ]
  },
  {
    id: "dashboard",
    name: "SaaS 数据看板",
    pageType: "dashboard",
    defaultGoalText: "提高关键指标理解效率",
    source: source("dashboard", "dashboard.png"),
    elements: [
      {
        id: "kpi-cards",
        kind: "card",
        label: "KPI 卡片组",
        bounds: { x: 260, y: 128, width: 760, height: 180 },
        confidence: 0.91,
        visualWeight: 0.72,
        interactiveLikelihood: 0.22
      },
      {
        id: "table-actions",
        kind: "button",
        label: "表格操作",
        bounds: { x: 832, y: 648, width: 154, height: 42 },
        confidence: 0.82,
        visualWeight: 0.34,
        interactiveLikelihood: 0.88
      }
    ]
  },
  {
    id: "form-flow",
    name: "表单提交页",
    pageType: "form",
    defaultGoalText: "让提交成功反馈更明确",
    source: source("form-flow", "form-flow.png"),
    elements: [
      {
        id: "submit-button",
        kind: "button",
        label: "提交按钮",
        text: "提交",
        bounds: { x: 720, y: 632, width: 180, height: 48 },
        confidence: 0.95,
        visualWeight: 0.52,
        interactiveLikelihood: 0.98
      },
      {
        id: "form-fields",
        kind: "form",
        label: "表单字段组",
        bounds: { x: 260, y: 170, width: 640, height: 390 },
        confidence: 0.9,
        visualWeight: 0.68,
        interactiveLikelihood: 0.78
      },
      {
        id: "validation-feedback",
        kind: "feedback",
        label: "校验反馈",
        bounds: { x: 260, y: 574, width: 390, height: 44 },
        confidence: 0.78,
        visualWeight: 0.36,
        interactiveLikelihood: 0.42
      }
    ]
  },
  {
    id: "confirm-modal",
    name: "确认弹窗",
    pageType: "modal",
    defaultGoalText: "增强删除确认的信任感",
    source: source("confirm-modal", "confirm-modal.png"),
    elements: [
      {
        id: "modal-container",
        kind: "modal",
        label: "删除确认弹窗",
        bounds: { x: 340, y: 210, width: 440, height: 310 },
        confidence: 0.96,
        visualWeight: 0.82,
        interactiveLikelihood: 0.62
      },
      {
        id: "destructive-cta",
        kind: "button",
        label: "确认删除",
        text: "删除",
        bounds: { x: 588, y: 446, width: 132, height: 42 },
        confidence: 0.92,
        visualWeight: 0.58,
        interactiveLikelihood: 0.96
      }
    ]
  },
  {
    id: "marketing-content",
    name: "内容营销页",
    pageType: "marketing",
    defaultGoalText: "突出价格方案和转化入口",
    source: source("marketing-content", "marketing.png"),
    elements: [
      {
        id: "hero-title",
        kind: "content",
        label: "首屏标题",
        bounds: { x: 96, y: 170, width: 520, height: 138 },
        confidence: 0.88,
        visualWeight: 0.78,
        interactiveLikelihood: 0.08
      },
      {
        id: "pricing-cards",
        kind: "card",
        label: "价格卡片",
        bounds: { x: 116, y: 430, width: 870, height: 210 },
        confidence: 0.88,
        visualWeight: 0.7,
        interactiveLikelihood: 0.5
      },
      {
        id: "pricing-cta",
        kind: "button",
        label: "价格 CTA",
        text: "开始使用",
        bounds: { x: 766, y: 572, width: 150, height: 44 },
        confidence: 0.9,
        visualWeight: 0.48,
        interactiveLikelihood: 0.95
      }
    ]
  }
];

export function fixtureById(fixtureId: string): FixtureDraft | undefined {
  return fixtureDrafts.find((fixture) => fixture.id === fixtureId);
}
