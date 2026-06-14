import type { MotionPattern } from "./schema";

export const motionPatterns: MotionPattern[] = [
  {
    id: "add-to-cart-fly",
    name: "加购飞行动效",
    strategy: "feedback",
    supportedKinds: ["button", "card"],
    frictions: ["attention", "confidence"],
    params: {
      durationMs: 320,
      easing: "spring",
      transform: "product token translate to cart, scale 1 -> 0.72",
      repeat: "none"
    },
    risks: ["购物车入口不可见时不要使用飞行动线。", "避免多个商品同时飞行造成轨迹混乱。"]
  },
  {
    id: "favorite-heartbeat",
    name: "收藏心跳反馈",
    strategy: "reward",
    supportedKinds: ["button"],
    frictions: ["attention", "confidence", "motivation"],
    params: {
      durationMs: 220,
      easing: "spring",
      transform: "icon scale 1 -> 1.18 -> 1",
      repeat: "none"
    },
    risks: ["列表中大量收藏按钮不要同时播放。", "只在用户触发收藏时反馈。"]
  },
  {
    id: "payment-success-ceremony",
    name: "支付成功仪式感",
    strategy: "reward",
    supportedKinds: ["feedback", "modal"],
    frictions: ["confidence", "motivation"],
    params: {
      durationMs: 480,
      easing: "decelerate",
      transform: "success icon pop, confetti light burst",
      repeat: "none"
    },
    risks: ["只用于支付或下单成功之后。", "不要遮挡查看订单、继续购物等下一步操作。"]
  },
  {
    id: "logistics-progress-motion",
    name: "物流进度推进",
    strategy: "guidance",
    supportedKinds: ["content", "feedback"],
    frictions: ["understanding", "confidence"],
    params: {
      durationMs: 360,
      easing: "standard",
      transform: "progress line advance, current node highlight",
      repeat: "none"
    },
    risks: ["不要让运输轨迹循环播放。", "节点状态必须和真实物流阶段一致。"]
  },
  {
    id: "empty-state-scene-motion",
    name: "缺省页场景化微动画",
    strategy: "guidance",
    supportedKinds: ["content", "feedback"],
    frictions: ["understanding", "motivation"],
    params: {
      durationMs: 420,
      easing: "decelerate",
      transform: "illustration subtle entrance, search hint fade in",
      repeat: "limited"
    },
    risks: ["不能干扰用户重新搜索。", "避免纯装饰循环吸睛。"]
  },
  {
    id: "rating-emotion-feedback",
    name: "评分表情反馈",
    strategy: "reward",
    supportedKinds: ["feedback", "button"],
    frictions: ["confidence", "motivation"],
    params: {
      durationMs: 260,
      easing: "spring",
      transform: "emoji expression morph, scale 1 -> 1.12 -> 1",
      repeat: "none"
    },
    risks: ["不要影响评分效率。", "低分反馈保持克制，避免冒犯用户。"]
  },
  {
    id: "feed-interest-badge",
    name: "利益点角标轻动效",
    strategy: "attention",
    supportedKinds: ["card", "content"],
    frictions: ["attention"],
    params: {
      durationMs: 220,
      easing: "decelerate",
      transform: "badge opacity 0 -> 1, y 6px -> 0",
      repeat: "none"
    },
    risks: ["同屏只强调一个利益点。", "不要遮挡商品主体和价格。"]
  },
  {
    id: "cta-one-shot-highlight",
    name: "CTA 一次性强调",
    strategy: "attention",
    supportedKinds: ["button"],
    frictions: ["attention"],
    params: {
      durationMs: 220,
      easing: "decelerate",
      transform: "scale 1 -> 1.04 -> 1",
      repeat: "none"
    },
    risks: ["不要做循环呼吸。", "强调只在首次进入或关键上下文变化时触发。"]
  },
  {
    id: "button-press-success",
    name: "按钮压感确认",
    strategy: "feedback",
    supportedKinds: ["button"],
    frictions: ["confidence"],
    params: {
      durationMs: 160,
      easing: "spring",
      transform: "scale 1 -> 0.94 -> 1",
      repeat: "none"
    },
    risks: ["点击反馈必须短于 200ms。", "不要在高风险支付确认里使用夸张回弹。"]
  },
  {
    id: "staggered-card-reveal",
    name: "卡片分组入场",
    strategy: "guidance",
    supportedKinds: ["card"],
    frictions: ["understanding"],
    params: {
      durationMs: 260,
      delayMs: 80,
      easing: "decelerate",
      transform: "opacity 0 -> 1, y 16px -> 0",
      repeat: "none"
    },
    risks: ["总延迟不要超过 420ms。", "只在进入视区时播放一次。"]
  },
  {
    id: "card-focus-spotlight",
    name: "重点卡片聚焦",
    strategy: "attention",
    supportedKinds: ["card"],
    frictions: ["attention"],
    params: {
      durationMs: 220,
      easing: "decelerate",
      transform: "outline glow, scale 1 -> 1.02 -> 1",
      repeat: "none"
    },
    risks: ["只强调单个主卡片，不要让整组同时闪动。", "避免压过主操作按钮。"]
  },
  {
    id: "stable-modal-transition",
    name: "稳定弹窗转场",
    strategy: "trust",
    supportedKinds: ["modal"],
    frictions: ["trust"],
    params: {
      durationMs: 240,
      easing: "decelerate",
      transform: "opacity 0 -> 1, scale 0.98 -> 1",
      repeat: "none"
    },
    risks: ["确认/支付/删除类弹窗不要使用弹簧。", "遮罩和内容应同步进入。"]
  },
  {
    id: "toast-success-feedback",
    name: "成功反馈提示",
    strategy: "feedback",
    supportedKinds: ["feedback"],
    frictions: ["confidence"],
    params: {
      durationMs: 180,
      easing: "decelerate",
      transform: "opacity 0 -> 1, y 12px -> 0",
      repeat: "none"
    },
    risks: ["Toast 退出不使用回弹。", "不要遮挡下一步主操作。"]
  },
  {
    id: "progressive-reveal",
    name: "内容渐进揭示",
    strategy: "guidance",
    supportedKinds: ["content", "card"],
    frictions: ["understanding"],
    params: {
      durationMs: 300,
      delayMs: 100,
      easing: "standard",
      transform: "section sequence reveal",
      repeat: "none"
    },
    risks: ["长内容不要逐字播放。", "用户滚动时不要阻塞阅读。"]
  },
  {
    id: "restrained-trust-confirm",
    name: "克制信任确认",
    strategy: "trust",
    supportedKinds: ["button", "modal"],
    frictions: ["trust"],
    params: {
      durationMs: 200,
      easing: "standard",
      transform: "opacity 0.92 -> 1",
      repeat: "none"
    },
    risks: ["避免庆祝式反馈。", "保持状态变化可预测。"]
  }
];

export function patternById(patternId: string): MotionPattern | undefined {
  return motionPatterns.find((pattern) => pattern.id === patternId);
}
