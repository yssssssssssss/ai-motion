import type { MotionPatternKnowledge } from "./schema";

export const motionPatternKnowledge: MotionPatternKnowledge[] = [
  {
    id: "pattern-cta-one-shot-highlight",
    type: "pattern",
    title: "CTA 一次性强调",
    summary: "用于低视觉权重的主操作入口，短促强调一次，不循环吸睛。",
    params: { durationMs: [180, 240], easing: ["decelerate", "standard"], repeat: "none" },
    avoidWhen: ["页面已有多个强营销动效", "支付确认、删除确认等高风险决策", "需要用户长时间阅读的内容区"],
    appliesTo: ["button"],
    goals: ["attention", "conversion"],
    pageTypes: ["commerce", "product-detail", "checkout"],
    tags: ["CTA", "按钮", "注意力", "转化", "一次性"],
    sourceRefs: [
      {
        sourceId: "motion-design-spec",
        sourceTitle: "动效设计规范系统（ing~）",
        pageRange: "1, 8-10",
        quote: "引导用户视线，明确层级关系。"
      }
    ]
  },
  {
    id: "pattern-button-press-feedback",
    type: "pattern",
    title: "按钮压感确认",
    summary: "用于点击、提交、加购等微观交互反馈，强调动作已被接收。",
    params: { durationMs: [100, 180], easing: ["spring", "decelerate"], repeat: "none" },
    avoidWhen: ["高风险支付确认里使用夸张回弹", "按钮本身不是核心操作", "反馈被 toast 或页面跳转覆盖"],
    appliesTo: ["button"],
    goals: ["feedback", "conversion"],
    pageTypes: ["commerce", "product-detail", "checkout", "form"],
    tags: ["按钮", "压感", "点击反馈", "加购", "提交"],
    sourceRefs: [
      {
        sourceId: "motion-design-spec",
        sourceTitle: "动效设计规范系统（ing~）",
        pageRange: "4-5, 10",
        quote: "内容反馈解决手感如何，拟真物理反馈拒绝机械感。"
      }
    ]
  },
  {
    id: "pattern-add-to-cart-fly",
    type: "pattern",
    title: "加购飞行动效",
    summary: "用于商品详情或商品列表加购，让商品或粒子飞入购物车，强化仪式感和反馈。",
    params: { durationMs: [240, 360], easing: ["decelerate", "spring"], repeat: "none" },
    avoidWhen: ["购物车入口不可见", "页面性能压力高", "一次性加购多个商品且会造成轨迹混乱"],
    appliesTo: ["button", "card"],
    goals: ["feedback", "conversion", "emotion"],
    pageTypes: ["product-detail", "commerce", "cart"],
    tags: ["加购", "购物车", "飞入", "商品详情", "仪式感"],
    sourceRefs: [
      {
        sourceId: "human-empathy-research",
        sourceTitle: "人文共情-创造更有温度的用户体验-动态化趣味性场景设计预研",
        pageRange: "10-12",
        quote: "增加购物车联动动态，收藏引导微动提醒。"
      }
    ]
  },
  {
    id: "pattern-favorite-heartbeat",
    type: "pattern",
    title: "收藏心跳反馈",
    summary: "用于收藏按钮或兴趣反馈，短促心跳强化用户行为感知。",
    params: { durationMs: [160, 260], easing: ["spring", "decelerate"], repeat: "none" },
    avoidWhen: ["收藏不是当前任务核心", "列表中大量收藏按钮同时播放", "图标周围信息密度过高"],
    appliesTo: ["button", "icon"],
    goals: ["feedback", "emotion", "retention"],
    pageTypes: ["commerce", "product-detail", "feed"],
    tags: ["收藏", "心跳", "图标", "趣味", "反馈"],
    sourceRefs: [
      {
        sourceId: "human-empathy-research",
        sourceTitle: "人文共情-创造更有温度的用户体验-动态化趣味性场景设计预研",
        pageRange: "4, 10-12",
        quote: "收藏按钮触发心跳微动效，强化用户收藏行为感知。"
      }
    ]
  },
  {
    id: "pattern-staggered-card-reveal",
    type: "pattern",
    title: "卡片分组入场",
    summary: "用于商品流、瀑布流、卡片组加载，建立阅读顺序。",
    params: { durationMs: [220, 320], easing: ["decelerate", "standard"], repeat: "none" },
    avoidWhen: ["首屏核心信息已经稳定展示", "卡片数量过多导致总延迟过长", "用户滚动时阻塞阅读"],
    appliesTo: ["card", "list"],
    goals: ["attention", "efficiency"],
    pageTypes: ["commerce", "feed", "home"],
    tags: ["卡片", "商品流", "瀑布流", "出现时序", "阅读顺序"],
    sourceRefs: [
      {
        sourceId: "motion-design-spec",
        sourceTitle: "动效设计规范系统（ing~）",
        pageRange: "4-5, 8-9",
        quote: "出现时序避免信息瞬间堆叠，引导用户按顺序看。"
      }
    ]
  },
  {
    id: "pattern-progressive-content-reveal",
    type: "pattern",
    title: "内容渐进揭示",
    summary: "用于内容区、说明区、AI 结果等信息密度较高区域，降低理解成本。",
    params: { durationMs: [240, 360], easing: ["standard", "decelerate"], repeat: "none" },
    avoidWhen: ["长文本逐字播放", "动效阻塞用户滚动", "内容已经处于用户阅读焦点"],
    appliesTo: ["content", "card"],
    goals: ["spatial-logic", "efficiency"],
    pageTypes: ["ai", "content", "product-detail", "marketing"],
    tags: ["内容", "渐进", "理解", "AI结果", "阅读"],
    sourceRefs: [
      {
        sourceId: "motion-design-spec",
        sourceTitle: "动效设计规范系统（ing~）",
        pageRange: "4-5",
        quote: "有先有后，重点突出，避免信息瞬间堆叠。"
      }
    ]
  },
  {
    id: "pattern-payment-success-ceremony",
    type: "pattern",
    title: "支付成功仪式感",
    summary: "用于支付成功、下单成功等完成态，通过礼花、打包、品牌 IP 传递正向情绪。",
    params: { durationMs: [300, 600], easing: ["decelerate", "standard"], repeat: "none" },
    avoidWhen: ["支付确认前", "网络状态不确定", "遮挡下一步关键操作"],
    appliesTo: ["feedback", "modal", "icon"],
    goals: ["emotion", "retention", "feedback"],
    pageTypes: ["checkout", "order-success"],
    tags: ["支付成功", "礼花", "打包", "仪式感", "情绪"],
    sourceRefs: [
      {
        sourceId: "human-empathy-research",
        sourceTitle: "人文共情-创造更有温度的用户体验-动态化趣味性场景设计预研",
        pageRange: "13-15",
        quote: "可增加场景过渡动画，如礼花/彩蛋/优惠/打包等实际场景。"
      }
    ]
  }
];
