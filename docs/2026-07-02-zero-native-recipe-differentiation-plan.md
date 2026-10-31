# Zero 原生动效方案差异化修复计划

日期：2026-07-02

## 背景

Motion Copilot 的 Zero 原生首尾帧链路已经具备文件级首尾帧发现、首尾帧读取、智能推荐、recipe 应用、HTML 导出和 harness 诊断能力。

当前真机测试暴露出一个关键产品问题：当用户选择页面 4 的 `多选项-首帧` / `多选项-尾帧` 时，推荐出的多个动效方案在视觉上高度相似，基本都是渐隐渐显。虽然 UI 上能看到 `遮罩揭示`、`容器优先`、`内容错峰` 等不同方案名，但用户几乎感受不到不同动效语言。

这会直接削弱 Zero 原生帧间模块的核心价值：用户不是只需要“能动”，而是需要根据首尾帧差异选择不同的、可感知的、规范内的动效表达。

## 真实问题诊断

以当前 5177 端口读取到的 `33:36 -> 33:35` 为例：

- 首帧：`多选项-首帧`，12 个图层，尺寸约 `219.78 x 44`
- 尾帧：`多选项-尾帧`，24 个图层，尺寸约 `219.78 x 141.4`
- Binding 结果：`matched 10`，`enter 12`，`exit 1`，`unresolved 1`
- 场景分类：`modal-enter`，置信度约 `0.93`
- 当前推荐第一名：`mask-reveal`
- Gate 状态：`degraded / safe-fade-unmatched`

代码层面的直接原因：

1. `compileZeroLayerMotionComposition` 中的 `enterStep` / `exitStep` 默认只做 opacity：
   - enter：`opacity 0 -> 1`
   - exit：`opacity 1 -> 0`
2. 大量新增的下拉菜单内容没有首帧对应物，因此被建模为 enter 图层。
3. 多数 recipe 对 enter/exit 的改写仍然只改变 `duration / delay / opacity / scale`，没有提供明确的空间行为。
4. `exportZeroLayerCompositionHtml` 的 enter/exit CSS 只消费 `transform + opacity`，如果 recipe 没有生成明显 `x/y/scale/width/height` 差异，最终导出就会趋同。
5. 当前 harness 已能提示 recipe 相似风险，但还没有把“差异度不足”作为强约束阻断。

一句话根因：当前 recipe 系统主要是在同一套 enter/exit fade 基础上调时长和延迟，没有针对下拉展开、容器扩展、内容错峰等场景生成真正不同的空间运动策略。

## 目标

1. 让页面 4 这类“触发控件 + 下拉内容展开”的场景至少产生 4 类可明显感知的动效方案。
2. 保持 Zero 尾帧严格还原：无论动效过程如何，最后一帧必须等于 Zero 尾帧。
3. 保持 motion corridor 原则：动效过程不明显越出首尾帧定义的空间范围。
4. 把 recipe 差异度纳入 harness，防止后续又出现“方案名不同、效果相同”。
5. 不接入 LLM 写动画代码，不新增端口，不影响 `apps/web` 和 `apps/motion-lens`。

## 非目标

- 不重做 Zero MCP 读取链路。
- 不改变文件级首尾帧发现规则。
- 不合并低保真、高保真、Zero 原生三套链路。
- 不让用户手写 CSS 或 keyframe。
- 不追求所有场景一次性达到电影级动效，只先解决明显同质化问题。

## 推荐方案

采用“场景策略层 + recipe 差异化参数 + harness 门禁”的方案。

当前链路：

```text
Zero 首尾帧
  -> compileZeroLayerMotionBindings
  -> buildZeroMotionSpec
  -> recommendZeroLayerRecipes
  -> applyZeroLayerMotionRecipe
  -> export HTML
```

调整后链路：

```text
Zero 首尾帧
  -> compileZeroLayerMotionBindings
  -> buildZeroMotionSpec
  -> classifyInteractionPattern
  -> recommendZeroLayerRecipes
  -> createRecipeMotionStrategy
  -> applyZeroLayerMotionRecipe
  -> createZeroLayerRecipeSampleReport
  -> export HTML
```

核心变化：

- 在 scene type 之上新增 interaction pattern：例如 `dropdown-reveal`、`popover-enter`、`container-expand`、`state-switch`。
- 每个 recipe 不再只拿通用参数，而是拿到可执行的 motion strategy。
- enter/exit 图层必须支持不同空间行为：滑入、裁切、展开、锚点出现、错峰。
- harness 对 recipe 之间的 signature 做差异度检查。

## 场景策略设计

### 1. dropdown-reveal

适用条件：

- 尾帧高度明显大于首帧。
- 尾帧新增图层主要位于首帧下方。
- 新增图层面积占比较高。

视觉表现：

- 下拉容器从触发控件下缘向下展开。
- 容器高度从 0 或 35% 到 100%。
- 内容在容器展开后按 y 顺序错峰出现。

适用 recipe：

- `mask-reveal`
- `container-first`
- 新增 `dropdown-reveal`

### 2. anchored-popover

适用条件：

- 尾帧新增一组浮层或菜单。
- 新增内容与首帧主控件存在空间锚点关系。

视觉表现：

- 新增内容从锚点附近轻微 `translateY(-8~-16px)` 到最终位置。
- 容器有轻微 `scaleY` 或 `scale`。
- 内容跟随进入。

适用 recipe：

- `spring-expand`
- `focus-guide`
- 新增 `anchored-popover`

### 3. container-then-content

适用条件：

- 有明显容器层或背景层。
- 内容新增较多。

视觉表现：

- 先让容器完成尺寸变化。
- 再让内容分批出现。
- 适合强调结构稳定和层级清晰。

适用 recipe：

- `container-first`
- `content-stagger`

### 4. cascade-items

适用条件：

- 尾帧有多个同类 item。
- item 有明显 y 顺序。

视觉表现：

- item 按 y 坐标依次进入。
- 每个 item 有轻微下滑或上滑。
- 容器可先出现或同步出现。

适用 recipe：

- `content-stagger`
- `list-reorder`

### 5. direct-morph

适用条件：

- matched 图层较多且低风险。
- 首尾帧主要是尺寸、位置、圆角、透明度变化。

视觉表现：

- 直接做几何 morph。
- enter/exit 保持克制。

适用 recipe：

- `smooth-morph`
- `axis-expand`

## Recipe 差异化要求

每个推荐方案必须在至少一个维度上与其他方案有可感知差异：

- 空间方向：上/下/左/右/轴向展开。
- 容器行为：高度展开、宽度展开、scaleY、clip reveal。
- 内容行为：整体出现、分组出现、逐项错峰。
- 节奏结构：先容器后内容、先内容后容器、同步完成。
- 缓动语言：standard、decelerate、sharp，但不能只靠缓动制造差异。

针对 `33:36 -> 33:35`，至少应形成这些体感不同方案：

| 方案             | 预期体感                                  |
| ---------------- | ----------------------------------------- |
| dropdown-reveal  | 下拉菜单从 tab 下方展开，容器高度逐步打开 |
| container-first  | 白色菜单容器先撑开，列表内容随后出现      |
| content-stagger  | 三个 action item 依次滑入                 |
| anchored-popover | 下拉层从触发点轻微弹出并落位              |
| smooth-morph     | 整体平滑过渡，保守但不作为强差异主方案    |

## 代码落点

### Core

- `packages/motion-copilot-core/src/zeroLayerMorph/zeroMotionSpec.ts`
  - 补充 interaction pattern 所需的派生特征。
  - 标记新增内容是否位于首帧主控件下方。

- 新增 `packages/motion-copilot-core/src/zeroLayerMorph/zeroMotionInteractionPattern.ts`
  - 输出 `dropdown-reveal`、`anchored-popover` 等 pattern。
  - 返回 reasons，供 UI 和 harness 展示。

- `packages/motion-copilot-core/src/zeroLayerMorph/zeroLayerMotionRecipes.ts`
  - 新增 `dropdown-reveal`、`anchored-popover`。
  - 重写 `mask-reveal`、`container-first`、`content-stagger` 的 enter/exit 空间行为。

- `packages/motion-copilot-core/src/zeroLayerMorph/adaptZeroLayerRecipeParameters.ts`
  - 增加 `enterOffsetX/Y`、`clipAxis`、`clipFromRatio`、`transformOrigin`、`containerPhaseRatio`。
  - 参数必须受 corridor 限制。

- `packages/motion-copilot-core/src/zeroLayerMorph/exportZeroLayerCompositionHtml.ts`
  - enter/exit keyframe 支持 width/height。
  - 支持 `transform-origin`。
  - 支持针对容器层的 clip/overflow reveal。

- `packages/motion-copilot-core/src/zeroLayerMorph/createZeroLayerRecipeSampleReport.ts`
  - 增加 recipe signature。
  - 对 signature 过近的 recipe 输出 warning 或 fail。

### App

- `apps/motion-copilot/src/features/zeroLayerMorph/ZeroLayerMorphPanel.tsx`
  - 推荐卡片展示 pattern 名称和差异点。
  - 对低差异方案展示提示。
  - 推荐排序优先展示体感差异更强的方案。

- `apps/motion-copilot/src/styles.css`
  - 增加推荐卡片上的 pattern / signature 标签样式。

## Harness 设计

新增 recipe motion signature：

```ts
type ZeroLayerRecipeMotionSignature = {
  recipeId: string;
  geometryStepCount: number;
  fadeOnlyStepCount: number;
  enterTransformCount: number;
  clipRevealCount: number;
  staggerSpreadMs: number;
  dominantAxis: "x" | "y" | "mixed" | "none";
  phaseCount: number;
  signatureKey: string;
};
```

差异度规则：

- 推荐列表前 3 个 recipe 的 `signatureKey` 不能相同。
- 前 3 个 recipe 中至少 2 个必须存在非 fade-only 的 enter 行为。
- 对 `dropdown-reveal` 场景，至少一个 recipe 必须包含 clip/height reveal。
- 对多 item 场景，至少一个 recipe 必须包含 stagger spread。

失败时输出：

- 哪些 recipe 同质。
- 同质原因：全部 fade-only、无 enter transform、无 stagger、无 clip reveal。
- 建议使用哪个更强方案。

## UI 展示建议

推荐卡片不只显示 recipe 名称，还显示具体行为：

- `下拉展开 · 容器高度 35% -> 100% · item 错峰 54ms`
- `容器先行 · 容器 0-60% 完成 · 内容 60-100% 出现`
- `内容错峰 · 3 组 item 依次滑入 · y 轴 -12px`
- `锚点浮层 · 从 tab 下缘弹出 · scaleY 0.96 -> 1`

这样用户能理解差异，也能在真机中预期自己将看到什么。

## 验收标准

### 自动化验收

- 对 `33:36 -> 33:35` 生成的推荐前 3 个 recipe signature 不相同。
- `dropdown-reveal` 场景至少有一个 recipe 产生 height/clip reveal。
- `content-stagger` 至少产生 3 个不同 delay 的 enter item。
- `anchored-popover` 至少产生 enter y offset 或 scaleY。
- 所有 recipe 最后一帧仍严格等于 Zero 尾帧。
- `exportZeroLayerCompositionHtml` 在 `mc-progress=1` 时仍通过尾帧还原检查。

### 真机验收

1. 打开 5177。
2. 点击 `发现文件首尾帧`。
3. 选择页面 4 的 `多选项`。
4. 分别应用推荐方案：
   - 下拉展开
   - 容器优先
   - 内容错峰
   - 锚点浮层
5. 观察至少 3 个方案存在明显不同视觉体感。
6. 下载 HTML，在真机打开验证与应用内预览一致。
7. 动效结束后尾帧与 Zero 尾帧一致。

## 风险与规避

### 风险 1：过程动效越出尾帧空间

规避：

- 所有 offset 和 clip 初始值从首尾帧 corridor 推导。
- overshoot 默认禁用。
- harness 继续检查尾帧和过程采样。

### 风险 2：新增 clip/height reveal 影响尾帧还原

规避：

- `progress=1` 强制恢复尾帧 width/height/opacity/transform。
- 只在动画 keyframe 中使用 clip/height，不修改 Zero source。

### 风险 3：recipe 数量增加导致推荐混乱

规避：

- 推荐区只展示前 3-4 个高差异方案。
- 更多方案仍保留在“更多动效方案”中。
- UI 显示 pattern 和差异点，避免纯名称堆叠。

### 风险 4：真实 Zero 图层命名不稳定

规避：

- 不依赖子图层命名判断 dropdown。
- 主要基于几何、层级、enter/exit 分布和 y 坐标判断。

## 推荐实施顺序

1. 先做 harness signature，先让“同质化”可测。
2. 再做 interaction pattern 分类。
3. 再补 `dropdown-reveal` 和 `anchored-popover` 两个新 recipe。
4. 再改造已有 `mask-reveal / container-first / content-stagger`。
5. 最后更新 UI 和真机 checklist。

这个顺序能避免只靠主观视觉调参，也能把后续回归挡住。
