# Zero 原生动效方案差异化修复 Todolist

日期：2026-07-02

## A. 诊断固化

- [x] A1. 在 `packages/motion-copilot-core/test/zeroLayerMorph.test.ts` 中新增页面 4 下拉展开 fixture 或测试构造数据：
  - 首帧尺寸约 `219 x 44`。
  - 尾帧尺寸约 `219 x 141`。
  - 尾帧包含多个新增 action item。
  - 验收：测试能稳定复现 `matched + enter` 混合场景。

- [x] A2. 增加诊断测试，记录当前同质化问题：
  - 统计推荐 recipe 的 signature。
  - 统计 fade-only enter 数量。
  - 验收：旧逻辑下能看出多个 recipe signature 过近。

- [x] A3. 在诊断报告中补充“动效同质化”风险：
  - code：`RECIPE_DIFF_TOO_SMALL` / `RECIPE_TOO_FADE_ONLY`
  - message：说明哪些 recipe 过于接近。
  - 验收：recipe 过近时报告输出 warning。

## B. Motion Signature

- [x] B1. 新增 recipe signature 类型：
  - `geometryStepCount`
  - `fadeOnlyStepCount`
  - `enterTransformCount`
  - `clipRevealCount`
  - `staggerSpreadMs`
  - `dominantAxis`
  - `phaseCount`
  - `signatureKey`

- [x] B2. 在 `createZeroLayerRecipeSampleReport` 中生成每个 recipe 的 signature。

- [x] B3. 增加 signature diff 规则：
  - 前 3 个推荐 recipe 的 signatureKey 不能完全相同。
  - 前 3 个推荐 recipe 至少 2 个具备非 fade-only enter。
  - dropdown 场景至少 1 个 recipe 有 height/clip reveal。

- [x] B4. 增加 CLI / harness 输出：
  - `recipeId`
  - `signatureKey`
  - `diff warnings`
  - 验收：`zero-layer-diagnose.mjs --recipe-samples` 可看到差异信息。

## C. Interaction Pattern

- [x] C1. 新增 `zeroMotionInteractionPattern.ts`。

- [x] C2. 定义 pattern 类型：
  - `dropdown-reveal`
  - `anchored-popover`
  - `container-expand`
  - `cascade-items`
  - `direct-morph`
  - `unknown`

- [x] C3. 实现 `classifyZeroMotionInteractionPattern(spec/source)`：
  - 基于 stage 高度变化。
  - 基于 enter 图层面积占比。
  - 基于 enter 图层是否位于首帧主控件下方。
  - 基于 enter item 数量和 y 坐标分布。

- [x] C4. 给 pattern 输出 reasons：
  - 例如“尾帧新增内容主要位于首帧下方”。
  - 例如“新增 item 有 3 个 y 方向序列”。

- [x] C5. 将下拉场景特征接入 `recommendZeroLayerRecipes`。

## D. 参数模型增强

- [x] D1. 扩展 `ZeroLayerRecipeAdaptedParameters`：
  - `enterOffsetX`
  - `enterOffsetY`
  - `maskAxis`
  - `clipFromRatio`
  - `containerPhaseRatio`
  - `itemStaggerStrategy`

- [x] D2. 为 dropdown 场景生成参数：
  - `maskAxis: y`
  - `clipFromRatio: 0 或 0.35`
  - `enterOffsetY: -8 ~ -16`
  - 注：`transformOrigin` 尚未接入，后续如需更强锚点感再补。

- [x] D3. 为 anchored popover 生成参数：
  - `scaleFrom: 0.96 ~ 0.98`
  - `enterOffsetY: -8 ~ -12`
  - 注：`transformOrigin` 尚未接入，当前通过 `scale + enterOffsetY` 表达锚点进入。

- [x] D4. 为 cascade items 生成参数：
  - 根据 y 坐标排序。
  - item delay 形成可见 spread。
  - 验收：至少 3 个 item delay 不相同。

- [x] D5. 所有参数加边界保护：
  - offset 不超过 corridor。
  - clip ratio 在 `0..1`。
  - duration 在既有上下限内。

## E. 新增 Recipe

- [x] E1. 新增 `dropdown-reveal` recipe：
  - 容器从上向下展开。
  - 内容随容器展开后出现。
  - 验收：页面 4 场景可看到下拉展开，而不是整体淡入。

- [x] E2. 新增 `anchored-popover` recipe：
  - 浮层从触发点附近轻微弹出。
  - 内容同步或轻微错峰出现。
  - 验收：与 dropdown-reveal 体感不同。

- [x] E3. 更新 recipe 列表和分类：
  - `dropdown-reveal` 归入 `overlay` 或 `expand`。
  - `anchored-popover` 归入 `overlay`。

- [x] E4. 更新推荐器能力矩阵：
  - dropdown 场景优先推荐 `dropdown-reveal`。
  - popover 场景推荐 `anchored-popover`。
  - 保留 `smooth-morph` 作为安全 fallback。

## F. 改造已有 Recipe

- [x] F1. 改造 `mask-reveal`：
  - 对新增容器使用 height/clip reveal。
  - 不再只是修改子层透明度。

- [x] F2. 改造 `container-first`：
  - 容器 phase 先完成。
  - 内容 phase 后出现。
  - 验收：容器和内容不是同一时间淡入。

- [x] F3. 改造 `content-stagger`：
  - enter item 按 y 坐标排序。
  - 每个 item 带轻微 `translateY`。
  - 验收：菜单项依次出现。

- [x] F4. 改造 `axis-expand`：
  - dropdown 场景使用 y 轴高度展开。
  - 横向 tab 场景仍使用 x 轴。

- [x] F5. 保留 `smooth-morph` 的稳妥特性：
  - 不强行添加复杂空间动效。
  - UI 中标记为“保守方案”。

## G. HTML 导出支持

- [x] G1. `enterCss` 支持 width/height keyframe。

- [x] G2. `enterCss` 支持 `transform-origin`。

- [x] G3. `exitCss` 支持 width/height keyframe。

- [x] G4. matched / enter / exit 的最终状态在 `mc-progress=1` 时严格等于尾帧。

- [x] G5. 针对容器 reveal 增加 overflow/clip 支持：
  - 只影响动画过程。
  - 不改变 Zero source snapshot。

## H. UI 展示

- [x] H1. 推荐卡片展示 interaction pattern：
  - 下拉展开
  - 锚点浮层
  - 容器优先
  - 内容错峰

- [x] H2. 推荐卡片展示具体差异点：
  - `容器高度 35% -> 100%`
  - `item 错峰 54ms`
  - `从 tab 下缘弹出`

- [x] H3. 对低差异 recipe 展示提示：
  - “该方案偏保守，体感差异较弱。”

- [x] H4. 推荐排序优先高差异且安全的方案：
  - 保留安全 fallback。
  - 不把所有 recipe 都挤到推荐区。

## I. 自动化测试

- [x] I1. Core 测试：`dropdown-reveal` pattern 识别。

- [x] I2. Core 测试：`anchored-popover` pattern 识别。

- [x] I3. Core 测试：新增 recipe id 出现在 `zeroLayerMotionRecipes`。

- [x] I4. Core 测试：页面 4 场景推荐前 3 个 recipe signature 不同。

- [x] I5. Core 测试：dropdown 场景至少一个 recipe 有 clip/height reveal。

- [x] I6. Core 测试：content-stagger 产生多个不同 delay。

- [x] I7. Core 测试：所有 recipe 最后一帧锁定 Zero 尾帧。

- [x] I8. Core 测试：所有 recipe 过程不明显越出 corridor。

- [x] I9. App 测试：推荐卡片展示 pattern 和差异点。

- [x] I10. App 测试：点击不同 recipe 后 composition steps 的 signature 不同。

## J. 验证命令

- [x] J1. 运行 core 单测：
  - `cd packages/motion-copilot-core && ./node_modules/.bin/vitest run test/zeroLayerMorph.test.ts`

- [x] J2. 运行 core typecheck：
  - `cd packages/motion-copilot-core && ./node_modules/.bin/tsc --noEmit`

- [x] J3. 运行 app 单测：
  - `cd apps/motion-copilot && ./node_modules/.bin/vitest run src/App.test.tsx`

- [x] J4. 运行 app typecheck：
  - `cd apps/motion-copilot && ./node_modules/.bin/tsc --noEmit`

- [x] J5. 运行 app build：
  - `cd apps/motion-copilot && npm run build`

## K. 真机测试

- [ ] K1. 打开 `http://127.0.0.1:5177/`。

- [ ] K2. 点击 `发现文件首尾帧`。

- [ ] K3. 选择页面 4 的 `多选项` pair。

- [ ] K4. 应用 `下拉展开`：
  - 预期：菜单从 tab 下方展开。

- [ ] K5. 应用 `容器优先`：
  - 预期：容器先撑开，内容随后出现。

- [ ] K6. 应用 `内容错峰`：
  - 预期：item 逐项进入。

- [ ] K7. 应用 `锚点浮层`：
  - 预期：浮层从触发点轻微弹出。

- [ ] K8. 对比四个方案：
  - 至少 3 个方案有肉眼可感知差异。

- [ ] K9. 下载 HTML 真机打开：
  - 动效与应用内预览一致。

- [ ] K10. 检查尾帧：
  - 动效结束后严格还原 Zero 尾帧。

## L. 完成定义

- [ ] L1. 页面 4 `33:36 -> 33:35` 不再出现推荐方案全部像淡入淡出的情况。

- [x] L2. 至少 4 个方案具有明确不同的 motion signature。

- [ ] L3. 真机上至少 3 个方案有明显视觉差异。

- [x] L4. harness 能阻止推荐前 3 个方案 signature 完全相同。

- [x] L5. 所有自动化测试通过。

- [x] L6. build 通过。

## M. 真机淡入淡出缺陷修复

- [x] M1. 定位真机仍像渐隐渐显的根因：
  - `ZeroLayerMotionStage` 预览层只用全局 progress 控制 enter/exit opacity。
  - 预览层没有消费 recipe step 中的 `x / y / width / height / scale / transformOrigin`。
  - 结果是底层 recipe 和 HTML 导出具备空间动效，但应用内真机预览退化成淡入淡出。

- [x] M2. 修复 `ZeroLayerMotionStage`：
  - matched 图层按 step 采样 `x / y / width / height / opacity / scale`。
  - enter / exit 图层按对应 composition step 采样，而不是只用 `p` 淡入淡出。
  - 支持 `zeroLayerTransformOrigin`。

- [x] M3. 增加回归测试：
  - `apps/motion-copilot/src/App.test.tsx` 覆盖 `dropdown-reveal` 中间帧。
  - 验证进入菜单层的 `top / height / opacity / transformOrigin` 都发生变化。

- [x] M4. 修复所有方案都像下拉展开的回归：
  - 根因：`adaptZeroLayerRecipeParameters` 把 `dropdownLike` 作为全局场景开关，导致多个 recipe 都被套用下拉式 `enterOffsetY / top center / spatial stagger / height reveal`。
  - 修复：下拉高度 reveal 仅限 `dropdown-reveal`，遮罩裁切仅限 `mask-reveal / axis-expand`，内容错峰仅限 `content-stagger / list-reorder / dropdown-reveal`。
  - 回归测试：同一首尾帧下 `dropdown-reveal` 中间帧高度小于尾帧，`content-stagger` 中间帧保持尾帧高度，确保两者体感不同。
