import type { MotionPrinciple } from "./schema";

export const motionPrinciples: MotionPrinciple[] = [
  {
    id: "principle-motion-value",
    type: "principle",
    title: "动效价值三分法",
    summary: "动效不应只是装饰，应服务于引导聚焦、反馈确认和空间逻辑。",
    rule: "推荐动效必须至少命中引导聚焦、反馈确认、空间逻辑之一，否则默认不推荐。",
    constraints: ["避免为了动而动", "优先传递状态变化和认知线索"],
    appliesTo: ["button", "card", "modal", "content", "feedback", "navigation", "loading", "icon", "list"],
    goals: ["attention", "feedback", "spatial-logic", "efficiency"],
    pageTypes: ["all"],
    tags: ["价值", "引导聚焦", "反馈确认", "空间逻辑", "基础原则"],
    sourceRefs: [
      {
        sourceId: "motion-design-spec",
        sourceTitle: "动效设计规范系统（ing~）",
        pageRange: "1",
        quote: "UI动效不仅仅是装饰，而是界面在时间维度上的设计。"
      }
    ]
  },
  {
    id: "principle-z-axis-layer",
    type: "principle",
    title: "Z 轴层级稳定性原则",
    summary: "顶层悬浮控件要稳定，中层核心操作可更丰富，底层容器氛围通常从属联动。",
    rule: "层级越高，越克制稳定；层级越低，越应避免独立抢注意力。",
    constraints: ["顶层控件使用高阻尼和无回弹", "中层核心操作可使用低阻尼和适度回弹", "底层氛围不独立运动"],
    appliesTo: ["navigation", "button", "card", "modal", "content"],
    goals: ["trust", "feedback", "spatial-logic"],
    pageTypes: ["all"],
    tags: ["Z轴", "层级", "稳定", "回弹", "阻尼"],
    sourceRefs: [
      {
        sourceId: "motion-design-spec",
        sourceTitle: "动效设计规范系统（ing~）",
        pageRange: "2-3",
        quote: "界面 Z 轴层级决定了元素运动的稳定性、个性。"
      }
    ]
  },
  {
    id: "principle-duration-area",
    type: "principle",
    title: "面积占比时长原则",
    summary: "小组件应快速响应，中大型组件需要更多时间缓冲。",
    rule: "小型组件建议 100-200ms，中大型组件建议 200-300ms。",
    constraints: [
      "按钮、单选、多选、加购等短时长",
      "卡片、列表、容器等中大型元素可稍长",
      "原则上避免无原因超过 300ms"
    ],
    appliesTo: ["button", "icon", "card", "list", "modal", "content"],
    goals: ["efficiency", "attention", "feedback"],
    pageTypes: ["all"],
    tags: ["时长", "面积", "100ms", "200ms", "300ms", "效率"],
    sourceRefs: [
      {
        sourceId: "motion-design-spec",
        sourceTitle: "动效设计规范系统（ing~）",
        pageRange: "8-9",
        quote: "动效的快慢，由物体在屏幕上占据的面积大小决定。"
      }
    ]
  },
  {
    id: "principle-enter-exit-asymmetry",
    type: "principle",
    title: "进出场非对称原则",
    summary: "进场是为了展示信息，离场是为了腾出空间。",
    rule: "进场可使用 200-300ms 吸引注意；退出和关闭应更短，通常 0-100ms。",
    constraints: ["进场慢于离场", "关闭反馈不要拖慢任务", "临时组件退出优先效率"],
    appliesTo: ["modal", "card", "content", "feedback"],
    goals: ["attention", "efficiency", "spatial-logic"],
    pageTypes: ["all"],
    tags: ["进场", "退出", "关闭", "非对称", "效率"],
    sourceRefs: [
      {
        sourceId: "motion-design-spec",
        sourceTitle: "动效设计规范系统（ing~）",
        pageRange: "9-10",
        quote: "进场出现和离场退出的时间是不对称的。"
      }
    ]
  },
  {
    id: "principle-bounce-physical-property",
    type: "principle",
    title: "回弹属性判定原则",
    summary: "空间属性变化可以回弹，效果属性变化不宜回弹。",
    rule: "位移、变形、大小、圆角变化可考虑回弹；颜色、状态、透明度变化默认不回弹。",
    constraints: ["核心操作层可适度回弹", "顶层、底层、状态变更保持克制", "支付/删除/确认类动效避免夸张回弹"],
    appliesTo: ["button", "card", "modal", "feedback", "content"],
    goals: ["feedback", "trust", "efficiency"],
    pageTypes: ["all"],
    tags: ["回弹", "空间属性", "透明度", "状态变化", "物理"],
    sourceRefs: [
      {
        sourceId: "motion-design-spec",
        sourceTitle: "动效设计规范系统（ing~）",
        pageRange: "10",
        quote: "并非所有动效都需要回弹。"
      }
    ]
  },
  {
    id: "principle-human-empathy-lightweight",
    type: "principle",
    title: "人文共情轻量优先原则",
    summary: "趣味动效应轻量、服务功能，并保持全链路一致。",
    rule: "趣味化设计不能压过功能目标；原子动态时长优先控制在 100-300ms。",
    constraints: ["轻量优先", "功能大于趣味", "一致性统一", "品牌透传"],
    appliesTo: ["button", "icon", "feedback", "loading", "card"],
    goals: ["emotion", "feedback", "retention", "conversion"],
    pageTypes: ["commerce", "home", "product-detail", "checkout", "logistics", "review"],
    tags: ["人文共情", "轻量", "趣味", "品牌", "100-300ms"],
    sourceRefs: [
      {
        sourceId: "human-empathy-research",
        sourceTitle: "人文共情-创造更有温度的用户体验-动态化趣味性场景设计预研",
        pageRange: "2-3",
        quote: "轻量优先、功能大于趣味、一致性统一、品牌透传。"
      }
    ]
  }
];
