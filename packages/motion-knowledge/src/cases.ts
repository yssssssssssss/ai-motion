import type { MotionCase } from "./schema";

export const motionCases: MotionCase[] = [
  {
    id: "case-feed-interest-badge",
    type: "case",
    title: "Feed 流利益点动态角标",
    chainStage: "购物前",
    touchpoint: "feed 流商品卡片",
    observedMotion: "兴趣/优惠/推荐标签轻量动态吸引",
    value: "帮助用户在商品流中发现兴趣点，提升浏览效率和点击意愿。",
    summary: "商品流可用利益点角标或推荐标签做轻量动态，但需要控制视觉噪音。",
    appliesTo: ["card", "content"],
    goals: ["attention", "conversion"],
    pageTypes: ["home", "feed", "commerce"],
    tags: ["feed流", "商品卡", "利益点", "标签", "购物前"],
    sourceRefs: [
      {
        sourceId: "human-empathy-research",
        sourceTitle: "人文共情-创造更有温度的用户体验-动态化趣味性场景设计预研",
        pageRange: "3-6",
        quote: "保持角标形式，优化折页动态，增加角标类别。"
      }
    ]
  },
  {
    id: "case-tabbar-bounce-feedback",
    type: "case",
    title: "Tabbar 切换回弹反馈",
    chainStage: "购物前",
    touchpoint: "Tabbar",
    observedMotion: "图标切换回弹与填色反馈",
    value: "提升导航切换的点击感，同时保持底部导航稳定。",
    summary: "Tabbar 属于顶层稳定区域，只适合短促、克制的状态反馈。",
    appliesTo: ["navigation", "icon"],
    goals: ["feedback", "efficiency"],
    pageTypes: ["home", "commerce", "all"],
    tags: ["Tabbar", "导航", "回弹", "点击反馈"],
    sourceRefs: [
      {
        sourceId: "human-empathy-research",
        sourceTitle: "人文共情-创造更有温度的用户体验-动态化趣味性场景设计预研",
        pageRange: "3-7",
        quote: "折中处理，增加回弹与图标填色动画。"
      }
    ]
  },
  {
    id: "case-search-empty-state-ip",
    type: "case",
    title: "搜索缺省页场景化微动画",
    chainStage: "购物前",
    touchpoint: "搜索缺省页",
    observedMotion: "IP + 场域类型 + 情景动画",
    value: "降低空状态挫败感，增加实际场景代入。",
    summary: "缺省页可以承载情绪化动效，但不能干扰用户重新搜索。",
    appliesTo: ["content", "icon", "feedback"],
    goals: ["emotion", "retention"],
    pageTypes: ["search", "empty-state"],
    tags: ["搜索", "缺省页", "IP", "情绪", "购物前"],
    sourceRefs: [
      {
        sourceId: "human-empathy-research",
        sourceTitle: "人文共情-创造更有温度的用户体验-动态化趣味性场景设计预研",
        pageRange: "7-9",
        quote: "增加缺省微动画提升趣味感。"
      }
    ]
  },
  {
    id: "case-product-detail-social-proof",
    type: "case",
    title: "商品详情围观/热卖状态",
    chainStage: "购物中",
    touchpoint: "商品详情商品图区域",
    observedMotion: "多人浏览轮播、悬浮信息、热卖状态提示",
    value: "突出商品热卖感和从众心理，辅助购买决策。",
    summary: "商品图区域可增加热卖或围观状态，但应避免遮挡商品主体。",
    appliesTo: ["card", "content"],
    goals: ["attention", "conversion", "trust"],
    pageTypes: ["product-detail"],
    tags: ["商品详情", "围观", "热卖", "从众心理", "购物中"],
    sourceRefs: [
      {
        sourceId: "human-empathy-research",
        sourceTitle: "人文共情-创造更有温度的用户体验-动态化趣味性场景设计预研",
        pageRange: "10-12",
        quote: "左侧增加其他人状态，突出商品热卖感，增加用户从众心理。"
      }
    ]
  },
  {
    id: "case-logistics-progress-motion",
    type: "case",
    title: "物流进度动态推进",
    chainStage: "购物后",
    touchpoint: "物流节点",
    observedMotion: "进度条动态推进、节点高亮、运输小车状态",
    value: "让履约进度更清晰，减少等待焦虑。",
    summary: "物流场景适合空间逻辑动效，强调当前位置和阶段推进。",
    appliesTo: ["list", "icon", "content"],
    goals: ["spatial-logic", "trust", "emotion"],
    pageTypes: ["logistics", "order"],
    tags: ["物流", "进度", "节点", "小车", "购物后"],
    sourceRefs: [
      {
        sourceId: "human-empathy-research",
        sourceTitle: "人文共情-创造更有温度的用户体验-动态化趣味性场景设计预研",
        pageRange: "16-18",
        quote: "物流进度条动态推进、节点高亮；运输小车动效、确认收货治愈反馈。"
      }
    ]
  },
  {
    id: "case-review-rating-emotion",
    type: "case",
    title: "评分表情与品牌心智",
    chainStage: "购物后",
    touchpoint: "订单评价评分",
    observedMotion: "表情/品牌形象反馈、慢回弹、礼花反馈",
    value: "提升评价过程的趣味性和品牌温度。",
    summary: "评价场景可融入表情或 Joy 形象，但应轻量，不影响评分效率。",
    appliesTo: ["feedback", "icon", "button"],
    goals: ["emotion", "retention", "feedback"],
    pageTypes: ["review", "order"],
    tags: ["评价", "评分", "表情", "Joy", "购物后"],
    sourceRefs: [
      {
        sourceId: "human-empathy-research",
        sourceTitle: "人文共情-创造更有温度的用户体验-动态化趣味性场景设计预研",
        pageRange: "18-20",
        quote: "可融入表情与joy形象，增加品牌心智透传与趣味感。"
      }
    ]
  }
];
