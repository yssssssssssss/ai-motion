# Zero 原生动效 Harness v2 智能推荐与诊断开发方案

日期：2026-07-02

范围：`apps/motion-copilot`、`packages/motion-copilot-core`、`scripts/zero-layer-diagnose.*`。

关联上下文：

- `docs/2026-07-01-zero-native-motion-productization-plan.md`
- `docs/2026-07-01-zero-native-motion-productization-todolist.md`
- `docs/2026-07-01-zero-motion-harness-todolist.md`
- `/Users/heyunshen/Downloads/Zero原生图层动效_Harness_v2_落地方案.md`

## 1. 背景

Motion Copilot 当前已经具备 Zero 原生图层帧间链路：

```text
Zero 首帧 / 尾帧 nodeId
→ Zero MCP 读取原生图层 snapshot
→ 图层匹配
→ 选择 Zero 原生 recipe
→ 生成 CompositionStep 时间轴
→ 应用内预览 / 导出 HTML
→ harness 检查尾帧还原、corridor、recipe 差异度
```

上一阶段已经解决了“能生成、能导出、能检查”的核心问题，但真机测试和产品体验仍有几个缺口：

- 用户仍然需要在多个 recipe 中自行试错，不知道哪个方案更适合当前首尾帧。
- 不同 recipe 在小位移、小尺寸变化场景下可能体感差异不足。
- 当前报告更偏工程诊断，缺少面向用户的解释与修复建议。
- 对“动效不明显”这类软问题缺少结构化判断。
- 后续如果持续补充 recipe，缺少统一的推荐依据和门禁解释。

本方案目标是把当前 Zero 原生链路升级为 Harness v2：不是让 LLM 生成动画代码，而是让系统基于 Zero 图层数据自动分析场景、推荐 recipe、评估显著度，并给出可理解的修复建议。

## 2. 目标

### 2.1 用户目标

- 用户读取首尾帧后，系统自动推荐 2-3 个适合当前场景的动效方案。
- 用户可以理解为什么推荐这些方案。
- 用户可以继续探索全部 recipe，而不是被默认推荐锁死。
- 当动效不明显、匹配不稳定、recipe 差异不足时，系统能说明原因。
- 用户能基于建议执行下一步，例如切换 recipe、增强错峰、确认图层配对。

### 2.2 工程目标

- 保持 Motion Copilot 独立模块边界，不影响 `apps/web` 和 `apps/motion-lens`。
- 不新增 dev server、端口或运行时。
- 不让 LLM 直接生成动画代码。
- 不新增大型 `.harness/agents/skills/gates/memory` 目录。
- 复用现有 `ZeroLayerMorphSource`、`ZeroLayerDiagnosticReport`、`createZeroLayerRecipeSampleReport` 和 `zeroLayerMotionRecipes`。
- 新能力优先用纯函数实现，方便单测、CLI 和 UI 复用。

## 3. 非目标

- 不写回 Zero 文件。
- 不自动修改用户的 Zero 稿件。
- 不把低保真、高保真、Zero 原生三套入口合并。
- 不接入黑盒视频生成模型。
- 不引入 CLIP / SSIM 作为第一阶段核心评估。
- 不做多 Agent 编排。
- 不做长期历史案例库和失败聚类。
- 不新增独立 `.harness` 工作区。

## 4. 核心原则

### 4.1 Recipe 执行动效，LLM 只做可选建议

动效生成仍然来自确定性 recipe：

```text
Zero 图层数据 + 内置 recipe + deterministic compiler → CompositionStep → HTML 动效
```

LLM 后续可以用于自然语言意图理解、推荐解释、报告润色，但不能直接输出动画代码，也不能跳过 recipe 和 gate。

### 4.2 推荐优先，但不封死探索

默认展示系统推荐的 2-3 个方案，同时保留“查看更多动效”入口。用户可以手动选择任意 recipe，但每次切换都要重新经过 harness 检查。

### 4.3 尾帧严格还原是最高优先级

任何推荐、增强、错峰、强度调节都不能破坏：

- `progress=1` 严格等于 Zero 尾帧。
- matched 图层中间过程不超出首尾帧 corridor。

### 4.4 Soft issue 也要可解释

除了 hard failure，还要解释 soft issue：

- 动效不明显。
- recipe 差异不足。
- 图层匹配置信度低。
- 当前变化过复杂，单个 recipe 覆盖不足。

## 5. 推荐架构

不要新建大而全 `src/harness`，第一阶段直接在现有 Zero 原生模块下扩展：

```text
packages/motion-copilot-core/src/zeroLayerMorph/
  zeroMotionSpec.ts
  zeroMotionSceneClassifier.ts
  zeroLayerRecipeRecommender.ts
  zeroMotionSalience.ts
  zeroMotionRepairAdvisor.ts
```

UI 接入：

```text
apps/motion-copilot/src/features/zeroLayerMorph/ZeroLayerMorphPanel.tsx
apps/motion-copilot/src/styles.css
```

CLI 接入：

```text
scripts/zero-layer-diagnose.ts
scripts/zero-layer-diagnose.mjs
```

导出入口：

```text
packages/motion-copilot-core/src/index.ts
```

## 6. 核心流程

```text
ZeroLayerMorphSource
→ buildZeroMotionSpec
→ classifyZeroMotionScene
→ recommendZeroLayerRecipes
→ applyZeroLayerMotionRecipe
→ createZeroLayerRecipeSampleReport
→ evaluateZeroMotionSalience
→ attributeZeroMotionFailures
→ createZeroMotionRepairAdvice
→ UI 展示 / CLI 输出 / 可选 run artifact
```

这里的关键是：推荐和解释层不替代 recipe，也不替代现有 diagnostic report，而是补充现有 harness 的“决策”和“用户解释”能力。

## 7. 数据模型

### 7.1 ZeroMotionSceneType

```ts
export type ZeroMotionSceneType =
  | "horizontal-expand"
  | "vertical-expand"
  | "list-reorder"
  | "tab-switch"
  | "card-enter"
  | "modal-enter"
  | "complex-state-change"
  | "unknown";
```

### 7.2 ZeroMotionSpec

`ZeroMotionSpec` 是 Harness v2 的中间协议，输入来自 `ZeroLayerMorphSource`，输出服务于推荐、诊断、UI 和 CLI。

```ts
export type ZeroMotionSpec = {
  schemaVersion: "motion-copilot.zero-motion-spec.v1";
  source: {
    fromNodeId: string;
    toNodeId: string;
    fromName: string;
    toName: string;
    fromSize: { width: number; height: number };
    toSize: { width: number; height: number };
  };
  topology: {
    matchedCount: number;
    enterCount: number;
    exitCount: number;
    unresolvedCount: number;
    lowConfidenceCount: number;
    dominantLayerId?: string;
  };
  deltas: {
    stageWidthDelta: number;
    stageHeightDelta: number;
    dominantDx: number;
    dominantDy: number;
    dominantWidthDelta: number;
    dominantHeightDelta: number;
    dominantAreaDeltaRatio: number;
    averageMoveDistance: number;
    enterExitRatio: number;
  };
  scene: {
    type: ZeroMotionSceneType;
    confidence: number;
    reasons: string[];
  };
  risks: ZeroMotionFailureType[];
  summary: string;
};
```

注意：第一阶段不把所有图层明细都塞进 spec，避免结构膨胀。图层明细仍保留在 `ZeroLayerMorphSource` 和 diagnostic/sample report 中。

### 7.3 ZeroMotionFailureType

```ts
export type ZeroMotionFailureType =
  | "under-motion"
  | "recipe-diff-too-small"
  | "tail-mismatch"
  | "corridor-overflow"
  | "low-confidence-match"
  | "motion-too-complex"
  | "low-visual-hierarchy-change"
  | "recipe-runtime-error";
```

### 7.4 ZeroLayerRecipeRecommendation

```ts
export type ZeroLayerRecipeRecommendation = {
  recipeId: ZeroLayerMotionRecipeId;
  score: number;
  reasons: string[];
  warnings: string[];
};

export type ZeroLayerRecipeRecommendationResult = {
  schemaVersion: "motion-copilot.zero-layer-recipe-recommendation.v1";
  sceneType: ZeroMotionSceneType;
  candidates: ZeroLayerRecipeRecommendation[];
  selectedRecipeId?: ZeroLayerMotionRecipeId;
  summary: string;
};
```

### 7.5 ZeroMotionSalienceReport

```ts
export type ZeroMotionSalienceReport = {
  schemaVersion: "motion-copilot.zero-motion-salience.v1";
  score: number;
  diagnosis: "too-subtle" | "balanced" | "too-strong";
  factors: {
    positionDelta: number;
    sizeDelta: number;
    opacityDelta: number;
    enterExit: number;
    stagger: number;
    areaChange: number;
  };
  evidence: string[];
};
```

### 7.6 ZeroMotionRepairAdvice

```ts
export type ZeroMotionRepairAdvice = {
  schemaVersion: "motion-copilot.zero-motion-repair-advice.v1";
  summary: string;
  actions: Array<{
    id: string;
    type: "change-recipe" | "increase-salience" | "confirm-binding" | "simplify-motion" | "keep-safe";
    label: string;
    description: string;
    recipeId?: ZeroLayerMotionRecipeId;
  }>;
  userFacingMessage: string;
};
```

## 8. 场景分类规则

场景分类优先基于 Zero 图层数据，而不是用户主观词。

### 8.1 横向展开

判定特征：

- stage 或 dominant layer 宽度变化明显。
- `dominantWidthDelta > dominantHeightDelta`。
- 新增内容集中在 X 轴方向。

推荐 recipe：

- `container-first`
- `axis-expand`
- `content-stagger`

### 8.2 纵向展开

判定特征：

- stage 或 dominant layer 高度变化明显。
- `dominantHeightDelta > dominantWidthDelta`。
- 新增内容沿 Y 轴堆叠。

推荐 recipe：

- `axis-expand`
- `container-first`
- `mask-reveal`

### 8.3 列表重排

判定特征：

- 多个 matched 图层 Y 坐标变化。
- matched 数量较多。
- enter / exit 数量不一定多，但空间顺序变化明显。

推荐 recipe：

- `list-reorder`
- `content-stagger`
- `smooth-morph`

### 8.4 Tab / 状态切换

判定特征：

- 主容器基本稳定。
- 文案或内容替换明显。
- enter / exit 或低位移 matched 较多。

推荐 recipe：

- `status-switch`
- `focus-guide`
- `content-stagger`

### 8.5 卡片 / 浮层入场

判定特征：

- 尾帧新增大面积层。
- enter 数量明显多于 exit。
- 容器或 overlay 类图层面积较大。

推荐 recipe：

- `mask-reveal`
- `container-first`
- `spring-expand`

### 8.6 复杂状态变化

判定特征：

- matched / enter / exit 都较多。
- 无明确 dominant layer。
- 多方向位移同时存在。

推荐策略：

- 优先推荐稳妥方案。
- 提示“当前变化复杂，建议先选择克制 recipe，再逐步增强”。

推荐 recipe：

- `smooth-morph`
- `content-stagger`
- `focus-guide`

## 9. Recipe 推荐策略

推荐层不是自由生成，而是对现有 recipe 打分。

当前真实 recipe id：

- `smooth-morph`
- `spring-expand`
- `status-switch`
- `container-first`
- `content-stagger`
- `mask-reveal`
- `focus-guide`
- `axis-expand`
- `list-reorder`

### 9.1 打分维度

```text
score =
  sceneMatchScore
  + topologyFitScore
  + saliencePotentialScore
  - lowConfidencePenalty
  - complexityPenalty
```

第一阶段不需要复杂机器学习，使用明确规则即可。

### 9.2 默认推荐数量

- 默认输出 3 个候选。
- 如果可用候选不足，至少输出 1 个安全候选。
- `smooth-morph` 是兜底安全方案。

### 9.3 用户探索

UI 中推荐区只展示 2-3 个“系统推荐”，同时提供“查看更多动效”展开全部 recipe。

用户切换任意 recipe 后：

- 重新应用 recipe。
- 重新计算 sample report。
- 重新计算 salience。
- 重新生成 repair advice。

## 10. 动效显著度

显著度不是 hard gate，而是 soft diagnosis。

### 10.1 输入

- `ZeroMotionSpec`
- 当前 recipe 的 `CompositionStep[]`
- `ZeroLayerRecipeSampleReport`

### 10.2 输出

- `score < 40`：`too-subtle`
- `40 <= score <= 80`：`balanced`
- `score > 80`：`too-strong`

### 10.3 指标

- 位移变化。
- 尺寸变化。
- 透明度变化。
- enter / exit 图层数量。
- stagger 时间差。
- 主容器面积变化。

### 10.4 用户解释示例

```text
当前动效合法，但变化感偏弱。原因是首尾帧几何变化较小，且新增内容没有明显错峰。
建议尝试“内容错峰”或“遮罩揭示”。
```

## 11. 失败归因与修复建议

### 11.1 Hard failure

Hard failure 来源于现有 gate：

- `tail-mismatch`
- `corridor-overflow`
- `recipe-runtime-error`

处理策略：

- 不建议用户导出当前结果。
- 推荐切换安全 recipe。
- 保留工程诊断详情。

### 11.2 Soft warning

Soft warning 来源于 spec、sample report、diagnostic report、salience：

- `under-motion`
- `recipe-diff-too-small`
- `low-confidence-match`
- `motion-too-complex`
- `low-visual-hierarchy-change`

处理策略：

- 允许预览和导出。
- UI 提示风险。
- 提供一键建议。

### 11.3 Repair action

第一阶段建议只做“建议”和“切换 recipe”，不直接改底层参数：

- 切换为推荐 recipe。
- 增强变化感：推荐 `content-stagger` / `mask-reveal`。
- 使用稳妥方案：推荐 `smooth-morph`。
- 确认图层配对：提示用户检查低置信图层。
- 简化动效：提示当前变化过复杂。

## 12. UI 设计

接入位置：`ZeroLayerMorphPanel.tsx` 的 Zero 原生面板，位于“读取结果 / Harness 诊断”和“全部动效方案”之间。

### 12.1 智能推荐区

```text
智能推荐
系统判断：横向展开 · 置信度 86%

推荐动效：
1. 容器优先 · 推荐
   原因：主容器宽度变化明显，新增内容集中在右侧。
2. 内容错峰
   原因：可以增强新增内容出现感。
3. 轴向展开
   原因：适合横向尺寸变化场景。

[应用推荐方案] [查看更多动效]
```

### 12.2 显著度提示

```text
动效显著度：偏弱
原因：首尾帧几何变化较小，新增图层错峰不足。
建议：尝试内容错峰或遮罩揭示。
```

### 12.3 更多动效

保留现有 recipe 分类筛选，但视觉层级上弱于推荐区：

```text
更多动效
全部 / 状态 / 展开 / 内容 / 导航 / 浮层 / 列表
```

### 12.4 一键建议

第一阶段只做 recipe 切换类按钮：

- 使用更明显方案。
- 使用更稳妥方案。
- 切换为内容错峰。
- 切换为丝滑形变。

不做自动调复杂参数，避免引入隐式状态。

## 13. CLI 设计

扩展现有 `scripts/zero-layer-diagnose.ts`。

### 13.1 新增参数

```text
--emit-spec
输出 ZeroMotionSpec。

--recommend-recipes
输出 recipe 推荐结果。

--emit-salience
输出动效显著度报告。

--emit-repair-advice
输出失败归因和修复建议。

--scene <type>
手动覆盖场景类型，用于调试推荐策略。
```

### 13.2 示例命令

```bash
node scripts/zero-layer-diagnose.mjs --fixture --from 28:19 --to 28:2 --emit-spec --recommend-recipes --emit-salience --emit-repair-advice --pretty
```

### 13.3 输出目标

CLI 要能回答：

- 当前首尾帧是什么场景？
- 推荐哪些 recipe？
- 为什么推荐？
- 当前动效是否明显？
- 是否存在 hard failure？
- 如果效果不好，建议下一步做什么？

## 14. 测试策略

### 14.1 Core 单测

文件：`packages/motion-copilot-core/test/zeroLayerMorph.test.ts`

覆盖：

- `buildZeroMotionSpec` 能产出稳定 schema。
- 横向展开 fixture 被分类为 `horizontal-expand`。
- 纵向展开 fixture 被分类为 `vertical-expand`。
- 多图层 Y 方向变化被分类为 `list-reorder`。
- 文案替换 / 容器稳定被分类为 `tab-switch` 或 `complex-state-change`。
- 推荐结果包含 2-3 个候选。
- `smooth-morph` 在未知场景下作为兜底。
- `under-motion` 可被显著度识别。
- `tail-mismatch` / `corridor-overflow` 继续沿用现有 sample report 风险。
- repair advice 能输出用户可理解文案。

### 14.2 App 测试

文件：`apps/motion-copilot/src/App.test.tsx`

覆盖：

- 读取 Zero 原生图层后展示“智能推荐”。
- 推荐区显示场景类型和推荐理由。
- 点击推荐 recipe 后更新 composition steps。
- 点击“查看更多动效”仍能看到全部 recipe。
- 显著度偏弱时显示修复建议。

### 14.3 CLI 测试

文件：`packages/motion-copilot-core/test/zeroLayerMorph.test.ts` 或现有 CLI fixture 测试。

覆盖：

- `--emit-spec` 输出 schema。
- `--recommend-recipes` 输出推荐列表。
- `--emit-salience` 输出显著度。
- `--emit-repair-advice` 输出建议。

## 15. 验证命令

优先使用本地包命令，避免全仓慢测试：

```bash
cd /Users/heyunshen/work/PROJECT/jdc/ai-motion/packages/motion-copilot-core
./node_modules/.bin/vitest run test/zeroLayerMorph.test.ts
./node_modules/.bin/tsc --noEmit

cd /Users/heyunshen/work/PROJECT/jdc/ai-motion/apps/motion-copilot
./node_modules/.bin/vitest run src/App.test.tsx -t "Zero"
./node_modules/.bin/vitest run src/App.test.tsx
./node_modules/.bin/tsc --noEmit
npm run build
```

CLI 验证：

```bash
cd /Users/heyunshen/work/PROJECT/jdc/ai-motion
node scripts/zero-layer-diagnose.mjs --fixture --from 28:19 --to 28:2 --emit-spec --recommend-recipes --emit-salience --emit-repair-advice --pretty
node scripts/zero-layer-diagnose.mjs --fixture --from 28:19 --to 28:2 --recipe-samples --fail-on recipe-diff --pretty
```

## 16. 风险与规避

### 16.1 推荐不准

风险：规则分类无法覆盖复杂组件。

规避：

- 保留全部 recipe 手动选择。
- `unknown` 场景兜底推荐 `smooth-morph`。
- 推荐理由必须暴露，方便用户理解和纠偏。

### 16.2 显著度评分误判

风险：几何变化小但视觉上仍然明显，或几何变化大但视觉不明显。

规避：

- 显著度作为 soft warning，不阻断导出。
- 第一阶段只用于解释和推荐，不作为 hard gate。

### 16.3 新报告与旧报告重复

风险：新增 GateReport 与现有 DiagnosticReport 平行存在，造成维护成本。

规避：

- 不新建独立 GateReport。
- 复用现有 `ZeroLayerDiagnosticReport` 和 `ZeroLayerRecipeSampleReport`。
- 新增报告只覆盖 spec / recommendation / salience / repair advice。

### 16.4 过度工程化

风险：照搬 Harness v2 文件清单会创建大量低价值模块。

规避：

- 第一阶段只新增 5 个 core 文件。
- 不做长期 memory、case clustering、多 Agent。
- 不做自动参数 patch。

## 17. 分阶段计划

### Phase 1：Core 最小闭环

交付：

- `zeroMotionSpec.ts`
- `zeroMotionSceneClassifier.ts`
- `zeroLayerRecipeRecommender.ts`
- `zeroMotionSalience.ts`
- `zeroMotionRepairAdvisor.ts`

验收：

- 输入 `ZeroLayerMorphSource` 能输出 spec、scene、recommendation、salience、repair advice。
- 单测覆盖核心场景。

### Phase 2：UI 接入

交付：

- Zero 原生面板新增“智能推荐”。
- 推荐卡片支持一键应用 recipe。
- 更多动效区域保留全部 recipe。
- 显著度和修复建议可见。

验收：

- 用户读取首尾帧后不用盲选 recipe。
- 用户可以继续探索全部 recipe。

### Phase 3：CLI 接入

交付：

- `zero-layer-diagnose` 增加 spec / recommend / salience / repair 输出。

验收：

- CLI 能产出和 UI 同源的推荐与建议。

### Phase 4：回归与真机验证

交付：

- 全量相关测试通过。
- 真机 checklist 更新。

验收：

- 横向展开、纵向展开、列表重排、状态切换至少各有一个验证样例。
- 推荐结果与真机体感基本一致。

## 18. 真机验收清单

### 横向展开

- 系统识别为 `horizontal-expand`。
- 推荐包含 `container-first` / `axis-expand` / `content-stagger`。
- 推荐理由提到宽度变化或右侧新增内容。
- 尾帧严格还原。

### 纵向展开

- 系统识别为 `vertical-expand`。
- 推荐包含 `axis-expand` / `mask-reveal`。
- 动效不超出首尾帧空间。

### 列表重排

- 系统识别为 `list-reorder`。
- 推荐包含 `list-reorder`。
- 多图层错峰能被感知。

### 状态切换 / Tab 切换

- 系统识别为 `tab-switch` 或 `complex-state-change`。
- 推荐包含 `status-switch` / `focus-guide`。
- 低位移场景下能提示“变化可能偏弱”。

### 复杂变化

- 系统不强行给出高置信单一判断。
- 推荐稳妥方案并提示风险。

## 19. 开发边界

本方案可以进入开发阶段，但开发时需要遵守：

- 只触碰 Motion Copilot 和 `packages/motion-copilot-core` 的 Zero 原生相关文件。
- 不回滚工作树中已有的其它修改。
- 新增 recipe 推荐不能破坏现有 recipe 手动选择。
- 所有新增推荐和建议必须能从本地确定性数据推导出来。
- 如果后续接入 LLM，只能接在意图推荐和解释层，不能接入动画代码生成层。
