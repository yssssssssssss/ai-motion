# Zero 原生首尾帧候选与场景适配动效计划

日期：2026-07-02

## 背景

Motion Copilot 的 Zero 原生图层帧间链路已经能完成三件核心事：

- 通过 Zero MCP 读取首帧、尾帧图层。
- 使用 deterministic recipe 在首尾帧之间生成动效。
- 通过 harness 检查尾帧还原、过程越界和方案风险。

当前真实使用中的主要问题是：

- 首帧候选、尾帧候选来自已读取快照里的所有可见图层，候选过多，用户难以判断应该选哪一个。
- 智能推荐可以切换 recipe，但不同 recipe 在真机上的差异不明显。
- 当前 recipe 是已有固定模板的选择和套用，还没有根据首尾帧空间变化生成场景适配参数。

本计划只优化 `apps/motion-copilot` 与 `packages/motion-copilot-core` 中的 Zero 原生帧间能力，不影响 `apps/web`、`apps/motion-lens`，不新增端口，不让 LLM 生成动画代码。

## 目标

1. 降低首尾帧选择成本：支持基于命名协议自动识别、置顶和配对 `-首帧` / `-尾帧` 图层。
2. 保留可恢复性：命名不规范时仍能回退到现有候选逻辑和手动 nodeId 输入。
3. 提升动效差异：让 recipe 根据首尾帧差异生成不同参数，而不是只切换固定模板名。
4. 保持 harness 原则：所有动效仍需满足尾帧严格还原、过程不超出首尾帧 corridor、失败可诊断。

## 非目标

- 不接入 LLM 自动写动画代码。
- 不写回 Zero 文件。
- 不改 Zero MCP 服务。
- 不新增独立启动命令或端口。
- 不重做整个帧间页面布局。
- 不把低保真、高保真、Zero 原生三条链路合并。

## 推荐方案

采用“两条主线并行但可独立交付”的方案：

1. 首尾帧候选识别：建立命名协议识别、自动配对、候选分组和回退规则。
2. 场景适配 recipe 参数生成：在现有 recommendation 和 recipe 之间加入 deterministic adapter，根据 MotionSpec 生成具体参数。

两条主线可以独立上线。候选识别先解决“选帧困难”，recipe adapter 再解决“动效差异不足”。

## 首尾帧候选策略

### 命名协议

优先识别以下后缀：

- `-首帧`
- `_首帧`
- ` 首帧`
- `-尾帧`
- `_尾帧`
- ` 尾帧`
- `-from`
- `_from`
- ` from`
- `-to`
- `_to`
- ` to`

中文后缀优先级高于英文后缀。后缀必须出现在图层名末尾，避免误匹配正文文案。

### 自动配对规则

对命名命中的图层提取 base name：

- `信息卡片-首帧` → base name：`信息卡片`
- `信息卡片-尾帧` → base name：`信息卡片`

当同一个 base name 同时存在首帧候选和尾帧候选时，形成一组 frame pair：

- pair label：`信息卡片`
- from nodeId：首帧节点
- to nodeId：尾帧节点
- confidence：命名强匹配

UI 应把 pair 放在候选区域顶部，提供“一键使用这组首尾帧”的操作。

### 候选分层

候选列表分为三层：

1. 推荐首尾帧组合：由命名协议自动配对产生。
2. 命名候选：只命中首帧或只命中尾帧的节点。
3. 其他可选图层：当前逻辑的回退候选。

回退候选要调整排序：

- 优先 `frame` / `group` / `component` / `instance`
- 其次 `rect` / `image`
- 最后 `text` / `vector` / `ellipse` 等细碎图层
- 仍保留可搜索能力

### 回退与错误处理

- 没有命名命中：显示当前候选列表，但提示“未发现命名协议图层”。
- 命名重复：展示多组 pair，按图层面积和层级排序，不自动选择。
- 只有首帧无尾帧：展示单侧命中，要求用户手动补另一侧。
- 手动输入 nodeId 永远保留。

## 场景适配 Recipe 参数生成

### 当前问题

现有 recipe 的核心能力是固定方案切换。它能保证流程确定、可测、可导出，但很多方案在真机上只表现为类似的位移、透明度或形变，因此体感差异不足。

### 新增层级

在 `recommendZeroLayerRecipes` 与 `applyZeroLayerMotionRecipe` 之间加入 adapter：

```text
Zero 首尾帧
  -> compileZeroLayerMotionBindings
  -> buildZeroMotionSpec
  -> recommendZeroLayerRecipes
  -> adaptZeroLayerRecipeParameters
  -> applyZeroLayerMotionRecipe
  -> createZeroLayerRecipeSampleReport
  -> export HTML
```

### 参数来源

adapter 只使用确定性输入：

- 主轴方向：横向、纵向、双轴、局部变化。
- 首尾帧面积变化：展开、收起、轻微状态变化、大面积内容替换。
- 图层数量变化：新增图层、消失图层、稳定图层。
- 主导图层：面积最大且变化最显著的 binding。
- 移动距离：from/to bounds 的 dx、dy。
- corridor：首尾帧整体空间范围。
- 当前 diagnostic gate：是否有越界、尾帧风险、匹配风险。

### 参数类型

不同 recipe 可获得不同参数：

- durationMs：总时长。
- easing：缓动曲线。
- staggerMs：多图层错峰间隔。
- maskAxis：遮罩方向。
- offsetPx：入场/退场位移。
- scaleFrom / scaleTo：缩放幅度。
- opacityFrom / opacityTo：透明度区间。
- overshootRatio：弹性幅度，默认受 corridor 限制。
- emphasisLevel：显著性等级。

### 约束原则

- 尾帧必须严格等于 Zero 尾帧。
- matched 图层的中间态不得超出 from/to corridor，除非 recipe 明确标记允许，并且 harness 通过。
- adapter 不能生成任意 CSS 字符串，只能生成受类型约束的参数。
- 失败时回退到当前 recipe 默认参数。

## UI 调整

### 首尾帧候选区

新增推荐组合区域：

- 标题：`推荐首尾帧`
- 内容：`信息卡片：28:19 -> 28:2`
- 操作：`使用`
- 状态：`命名匹配` / `疑似匹配` / `需确认`

候选列表保留左右两列，但增加分组：

- 命名候选
- 结构候选
- 其他图层

### 智能推荐区

当前智能推荐区域需要增加参数解释：

- 推荐动效：如 `横向展开`
- 适配参数：`主轴 X / 遮罩从左到右 / 内容错峰 48ms / 时长 720ms`
- 显著性评分：用于提示“该方案体感差异弱/中/强”
- 风险提示：如 `已限制 overshoot，避免越出尾帧空间`

## 代码落点

### Core

- `packages/motion-copilot-core/src/zeroLayerMorph/deriveZeroLayerNodeCandidates.ts`
  - 增加命名协议识别。
  - 增加候选分组与优先级。

- 新增 `packages/motion-copilot-core/src/zeroLayerMorph/deriveZeroLayerFramePairs.ts`
  - 从 from/to snapshot 中提取首尾帧 pair。
  - 输出 pair confidence 和 reasons。

- 新增 `packages/motion-copilot-core/src/zeroLayerMorph/adaptZeroLayerRecipeParameters.ts`
  - 根据 MotionSpec 和 recipe id 生成受约束参数。

- 更新 `packages/motion-copilot-core/src/zeroLayerMorph/zeroLayerMotionRecipes.ts`
  - recipe 增加可适配参数 schema。
  - 保留默认参数。

- 更新 `packages/motion-copilot-core/src/zeroLayerMorph/zeroLayerRecipeRecommender.ts`
  - 推荐结果携带 adapted params summary。

- 更新 `packages/motion-copilot-core/src/index.ts`
  - 导出新增能力。

### App

- `apps/motion-copilot/src/features/zeroLayerMorph/ZeroLayerMorphPanel.tsx`
  - 展示推荐首尾帧 pair。
  - 点击 pair 自动写入 from/to nodeId。
  - 展示 adapter 参数摘要。

- `apps/motion-copilot/src/styles.css`
  - 增加候选分组和参数摘要样式。

### Tests

- `packages/motion-copilot-core/test/zeroLayerMorph.test.ts`
  - 候选命名协议测试。
  - 自动配对测试。
  - recipe adapter 参数测试。
  - corridor 约束测试。

- `apps/motion-copilot/src/App.test.tsx`
  - 推荐首尾帧 UI 测试。
  - 点击推荐 pair 更新 nodeId 测试。
  - 智能推荐展示参数摘要测试。

## 验收标准

### 自动化验收

- 命名为 `信息卡片-首帧` 和 `信息卡片-尾帧` 的两个节点会形成推荐 pair。
- 推荐 pair 点击后，首帧 nodeId 与尾帧 nodeId 同时更新。
- 命名不规范时，现有候选逻辑仍可用。
- adapter 对横向展开、纵向展开、状态切换生成不同参数。
- adapter 输出通过类型约束，不生成任意 CSS。
- recipe sample report 仍能检查尾帧还原和 corridor。

### 真机验收

1. 打开 5177 页面，进入 Zero 原生帧间。
2. 读取包含 `-首帧` / `-尾帧` 命名的 Zero 文件。
3. 在候选区看到推荐首尾帧 pair。
4. 点击 pair 后，首帧和尾帧 nodeId 自动填入。
5. 应用智能推荐动效。
6. 对比至少三类场景：
   - 横向展开。
   - 纵向展开。
   - 状态轻变化。
7. 观察动效方案的位移方向、遮罩方向、错峰节奏、显著性评分有明显差异。
8. 动效结束时尾帧严格等于 Zero 尾帧。

## 风险与处理

### 风险 1：命名规范执行不稳定

处理：命名协议只做强推荐，不做唯一入口。保留手动 nodeId 和结构候选回退。

### 风险 2：recipe 参数变化导致越界

处理：adapter 参数必须经过 corridor 约束；harness 报告中增加参数来源和修复建议。

### 风险 3：候选区 UI 变复杂

处理：默认只展示推荐 pair 和前若干个高优先级候选，完整候选通过搜索暴露。

### 风险 4：动效差异仍不明显

处理：增加显著性评分门槛。如果某个 recipe 的 salience 低于阈值，在 UI 中提示“差异弱”，并推荐差异更强的 recipe。

## 回滚方案

- Core 新增函数可独立回退，不改变原始 snapshot 数据结构。
- UI 可隐藏推荐 pair 区域，回到现有手动 nodeId + 候选列表。
- recipe adapter 可通过 feature flag 或默认关闭回退到原 recipe 默认参数。

## 推荐实施顺序

1. 先做首尾帧命名协议和推荐 pair。
2. 再做 recipe adapter 的最小闭环，覆盖横向展开、纵向展开、状态切换三类场景。
3. 最后补 UI 参数解释和真机验收 checklist。

