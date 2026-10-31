# Zero 原生动效 Harness v2 智能推荐与诊断 Todo

日期：2026-07-02

关联方案：`docs/2026-07-02-zero-native-harness-v2-recommendation-plan.md`

## 总体验收

- [x] Zero 原生读取首尾帧后，系统自动生成 `ZeroMotionSpec`。
- [x] 系统能识别至少 5 类场景：横向展开、纵向展开、列表重排、状态切换、卡片/浮层入场。
- [x] 系统能推荐 2-3 个 recipe，并展示推荐理由。
- [x] 用户可以应用推荐 recipe，也可以展开全部 recipe 自由探索。
- [x] 系统能识别“动效偏弱”并给出用户可理解建议。
- [x] 所有推荐和手动切换 recipe 仍满足尾帧严格还原和 corridor 约束。
- [x] CLI 能输出 spec、推荐、显著度和修复建议。
- [x] 不接入 LLM 自动生成动画代码。
- [x] 不新增 `.harness` 大目录、dev server 或端口。

## Phase 1：Core 最小闭环

目标：先把推荐和诊断能力做成纯函数，供 UI / CLI 复用。

- [x] 新增 `zeroMotionSpec.ts`。
  - 范围：`packages/motion-copilot-core/src/zeroLayerMorph/zeroMotionSpec.ts`
  - 验收：导出 `ZeroMotionSpec` 类型。
  - 验收：导出 `buildZeroMotionSpec(source)`。
  - 验收：spec 包含 source、topology、deltas、scene、risks、summary。
  - 验收：不复制大量图层明细，避免和 `ZeroLayerMorphSource` 重复。

- [x] 实现 dominant layer 和基础 delta 计算。
  - 范围：`zeroMotionSpec.ts`
  - 验收：能计算 dominant layer。
  - 验收：能计算 stage 宽高变化、主图层 dx / dy / 宽高变化 / 面积变化。
  - 验收：能计算平均位移、enter/exit 比例、低置信数量。

- [x] 新增 `zeroMotionSceneClassifier.ts`。
  - 范围：`packages/motion-copilot-core/src/zeroLayerMorph/zeroMotionSceneClassifier.ts`
  - 验收：导出 `ZeroMotionSceneType`。
  - 验收：导出 `classifyZeroMotionScene(input)`。
  - 验收：输出 type、confidence、reasons。

- [x] 实现场景分类规则。
  - 验收：横向宽度变化识别为 `horizontal-expand`。
  - 验收：纵向高度变化识别为 `vertical-expand`。
  - 验收：多图层 Y 变化识别为 `list-reorder`。
  - 验收：容器稳定且内容替换识别为 `tab-switch` 或 `complex-state-change`。
  - 验收：新增大面积层识别为 `card-enter` 或 `modal-enter`。
  - 验收：置信度不足时输出 `unknown`。

- [x] 新增 `zeroLayerRecipeRecommender.ts`。
  - 范围：`packages/motion-copilot-core/src/zeroLayerMorph/zeroLayerRecipeRecommender.ts`
  - 验收：导出 `ZeroLayerRecipeRecommendationResult`。
  - 验收：导出 `recommendZeroLayerRecipes(spec, options?)`。
  - 验收：推荐结果只使用当前真实 recipe id。

- [x] 实现 recipe capability matrix。
  - 范围：`zeroLayerRecipeRecommender.ts`
  - 验收：`horizontal-expand` 优先推荐 `container-first` / `axis-expand` / `content-stagger`。
  - 验收：`vertical-expand` 优先推荐 `axis-expand` / `container-first` / `mask-reveal`。
  - 验收：`list-reorder` 优先推荐 `list-reorder` / `content-stagger`。
  - 验收：`tab-switch` 优先推荐 `status-switch` / `focus-guide`。
  - 验收：`unknown` 兜底推荐 `smooth-morph`。

- [x] 新增 `zeroMotionSalience.ts`。
  - 范围：`packages/motion-copilot-core/src/zeroLayerMorph/zeroMotionSalience.ts`
  - 验收：导出 `ZeroMotionSalienceReport`。
  - 验收：导出 `evaluateZeroMotionSalience(input)`。
  - 验收：输出 score、diagnosis、factors、evidence。

- [x] 实现显著度评分。
  - 验收：能基于位移、尺寸、透明度、enter/exit、stagger、面积变化评分。
  - 验收：低变化 fixture 输出 `too-subtle`。
  - 验收：普通变化 fixture 输出 `balanced`。
  - 验收：显著度只产生 soft warning，不阻断生成。

- [x] 新增 `zeroMotionRepairAdvisor.ts`。
  - 范围：`packages/motion-copilot-core/src/zeroLayerMorph/zeroMotionRepairAdvisor.ts`
  - 验收：导出 `ZeroMotionRepairAdvice`。
  - 验收：导出 `createZeroMotionRepairAdvice(input)`。
  - 验收：支持 under-motion、recipe-diff-too-small、low-confidence-match、motion-too-complex。

- [x] 实现修复建议规则。
  - 验收：under-motion 推荐 `content-stagger` 或 `mask-reveal`。
  - 验收：low-confidence-match 提示确认图层配对。
  - 验收：complex-state-change 推荐先用 `smooth-morph` 或 `focus-guide`。
  - 验收：tail/corridor hard failure 推荐切换稳妥方案，不建议直接导出。

- [x] 更新 core 导出。
  - 范围：`packages/motion-copilot-core/src/index.ts`
  - 验收：导出新增类型和函数。

- [x] 补充 core 单测。
  - 范围：`packages/motion-copilot-core/test/zeroLayerMorph.test.ts`
  - 验收：覆盖 spec、scene classifier、recipe recommender、salience、repair advice。
  - 验收：新增测试不依赖网络和真实 Zero MCP。

## Phase 2：UI 接入

目标：让用户在 Zero 原生面板中看到推荐、理由、显著度和建议。

- [x] 在 Zero 面板中计算推荐上下文。
  - 范围：`apps/motion-copilot/src/features/zeroLayerMorph/ZeroLayerMorphPanel.tsx`
  - 验收：`savedSource` 存在时生成 spec、recommendation、salience、repair advice。
  - 验收：没有 `savedSource` 时不显示推荐区。

- [x] 新增“智能推荐”区域。
  - 范围：`ZeroLayerMorphPanel.tsx`
  - 验收：显示场景类型、置信度、原因。
  - 验收：显示 2-3 个推荐 recipe。
  - 验收：每个推荐 recipe 显示推荐理由和风险提示。

- [x] 推荐 recipe 支持一键应用。
  - 范围：`ZeroLayerMorphPanel.tsx`
  - 验收：点击推荐卡片调用现有 `applyRecipe(recipeId)`。
  - 验收：应用后 composition steps 更新。
  - 验收：不破坏现有全部 recipe 手动选择。

- [x] 新增“查看更多动效”交互。
  - 范围：`ZeroLayerMorphPanel.tsx`
  - 验收：默认突出推荐 recipe。
  - 验收：用户可以展开现有 recipe 分类列表。
  - 验收：全部 recipe 分类筛选仍可用。

- [x] 显示显著度和修复建议。
  - 范围：`ZeroLayerMorphPanel.tsx`
  - 验收：`too-subtle` 时提示“动效偏弱”。
  - 验收：显示修复建议文案。
  - 验收：建议按钮仅做 recipe 切换，不自动改复杂参数。

- [x] 补充 UI 样式。
  - 范围：`apps/motion-copilot/src/styles.css`
  - 验收：推荐区不挤占主预览。
  - 验收：推荐卡片和普通 recipe 卡片层级清晰。
  - 验收：文字不溢出，和当前 13px 字体体系兼容。

- [x] 补充 App 测试。
  - 范围：`apps/motion-copilot/src/App.test.tsx`
  - 验收：读取 Zero 原生图层后显示“智能推荐”。
  - 验收：推荐理由可见。
  - 验收：点击推荐 recipe 后更新 workspace composition steps。
  - 验收：展开后仍能看到全部 recipe。
  - 验收：显著度偏弱时显示修复建议。

## Phase 3：CLI 接入

目标：让自动化和开发调试能输出同一套推荐与诊断。

- [x] 扩展 `zero-layer-diagnose.ts` 参数。
  - 范围：`scripts/zero-layer-diagnose.ts`
  - 验收：支持 `--emit-spec`。
  - 验收：支持 `--recommend-recipes`。
  - 验收：支持 `--emit-salience`。
  - 验收：支持 `--emit-repair-advice`。
  - 验收：支持 `--scene <type>` 用于调试覆盖场景。

- [x] 实现 CLI JSON 输出。
  - 范围：`scripts/zero-layer-diagnose.ts`
  - 验收：默认 JSON 输出中可包含 spec / recommendation / salience / repairAdvice。
  - 验收：未传对应参数时不输出额外字段，保持兼容。

- [x] 实现 CLI pretty 输出。
  - 范围：`scripts/zero-layer-diagnose.ts`
  - 验收：`--pretty --recommend-recipes` 显示场景、推荐 recipe、推荐理由。
  - 验收：`--pretty --emit-salience` 显示显著度。
  - 验收：`--pretty --emit-repair-advice` 显示用户可读建议。

- [x] 更新 `zero-layer-diagnose.mjs`。
  - 范围：`scripts/zero-layer-diagnose.mjs`
  - 验收：继续透传到 TypeScript 脚本。

- [x] 补充 CLI 回归测试。
  - 范围：`packages/motion-copilot-core/test/zeroLayerMorph.test.ts`
  - 验收：fixture 命令可输出 spec。
  - 验收：fixture 命令可输出推荐。
  - 验收：fixture 命令可输出显著度和修复建议。

## Phase 4：回归与真机验证

目标：确认新推荐层没有破坏现有 Zero 原生链路。

- [x] Core 测试。
  - 命令：`cd packages/motion-copilot-core && ./node_modules/.bin/vitest run test/zeroLayerMorph.test.ts`
  - 验收：全部通过。

- [x] Core 类型检查。
  - 命令：`cd packages/motion-copilot-core && ./node_modules/.bin/tsc --noEmit`
  - 验收：通过。

- [x] App Zero 相关测试。
  - 命令：`cd apps/motion-copilot && ./node_modules/.bin/vitest run src/App.test.tsx -t "Zero"`
  - 验收：通过。

- [x] App 全量测试。
  - 命令：`cd apps/motion-copilot && ./node_modules/.bin/vitest run src/App.test.tsx`
  - 验收：通过。

- [x] App 类型检查。
  - 命令：`cd apps/motion-copilot && ./node_modules/.bin/tsc --noEmit`
  - 验收：通过。

- [x] App 构建。
  - 命令：`cd apps/motion-copilot && npm run build`
  - 验收：client + SSR build 通过。
  - 备注：如仍出现 Node 22.10.0 低于 Vite 推荐版本提示，只记录，不作为本任务阻断。

- [x] CLI 验证。
  - 命令：`node scripts/zero-layer-diagnose.mjs --fixture --from 28:19 --to 28:2 --emit-spec --recommend-recipes --emit-salience --emit-repair-advice --pretty`
  - 验收：输出场景、推荐 recipe、显著度、修复建议。

- [ ] 真机横向展开验证。
  - 验收：推荐包含 `container-first` / `axis-expand` / `content-stagger`。
  - 验收：推荐理由与横向变化相关。
  - 验收：导出尾帧严格还原。

- [ ] 真机纵向展开验证。
  - 验收：推荐包含 `axis-expand` / `mask-reveal` 或 `container-first`。
  - 验收：动效过程不越界。

- [ ] 真机列表重排验证。
  - 验收：推荐包含 `list-reorder`。
  - 验收：错峰移动可感知。

- [ ] 真机状态切换验证。
  - 验收：推荐包含 `status-switch` / `focus-guide`。
  - 验收：低位移时能提示变化偏弱。

## 当前不做

- [ ] 不接入 LLM 自动生成动画代码。
- [ ] 不让 LLM 写 CSS / JS / HTML 动效代码。
- [ ] 不做多 Agent。
- [ ] 不新增大型 `.harness` 目录。
- [ ] 不做长期案例库和失败聚类。
- [ ] 不写回 Zero。
- [ ] 不自动修改 Zero 稿件。
- [ ] 不新增 dev server 或端口。
- [ ] 不合并低保真、高保真、Zero 原生三条链路。

## 开发注意事项

- 只触碰 Motion Copilot 和 `packages/motion-copilot-core` 的 Zero 原生相关文件。
- 不回滚工作树中已有的其他修改。
- 所有推荐必须基于确定性数据和规则。
- 新增逻辑必须复用现有 recipe id，不使用文档示例中的虚构 id。
- 显著度和推荐是 soft guidance，不应破坏现有 hard gate。
- 尾帧还原和 corridor 仍然是最高优先级。
