# Zero 原生帧间动效语义顺序与高差异 Recipe Todolist

## 背景

真机反馈显示，当前 Zero 原生帧间动效存在三个核心问题：

- 从首帧到尾帧的过程中，图层变化顺序不符合真实 App 动效逻辑。
- 当前 recipe 数量和视觉差异不足，多个方案体感接近。
- Zero 原生帧间链路目前没有 LLM 参与，主要依赖确定性规则和已有 recipe。

本轮开发只解决前两个问题：语义顺序和高差异 recipe。LLM 推荐层暂不接入，避免扩大范围。

## 开发目标

- 让系统识别图层角色，区分容器、背景、内容、图标、按钮、状态胶囊等。
- 让 recipe 按语义角色决定动效顺序，而不是只按空间位置或图层顺序。
- 新增一批 App 场景中差异明显的 recipe。
- 增强 harness，让它能发现“内容早于容器出现”等顺序风险。
- 保持 Zero 尾帧严格还原。

## 非目标

- 不接入 LLM 推荐。
- 不让 LLM 写动画代码。
- 不做匹配算法全局最优重构。
- 不拆分低保真 / 高保真 / Zero 原生三套链路。
- 不重构 `FrameMorphPanel`。
- 不一次性扩展到 30 个 recipe。

## Phase 1：图层语义角色识别

- [x] A1. 新增 `zeroLayerRoleClassifier.ts`
  - 路径：`packages/motion-copilot-core/src/zeroLayerMorph/zeroLayerRoleClassifier.ts`
  - 输入：`ZeroLayerMorphSource` 或 `ZeroLayerSnapshot`
  - 输出：每个图层的语义角色、置信度和识别原因。
  - 验收：可以区分根容器、背景、底板、文本、图标、按钮、状态胶囊、装饰元素。

- [x] A2. 定义角色类型
  - 建议类型：
    - `root-container`
    - `background`
    - `surface`
    - `mask`
    - `content-text`
    - `icon`
    - `action`
    - `badge`
    - `divider`
    - `decorative`
    - `unknown`
  - 验收：类型导出到 core index，测试可直接引用。

- [x] A3. 增加名称关键词识别
  - 中文关键词：背景、底板、容器、卡片、弹层、面板、遮罩、蒙层、标题、正文、文案、按钮、图标、箭头、状态、胶囊、角标、分割线。
  - 英文关键词：background、container、card、panel、mask、overlay、title、text、button、icon、badge、divider。
  - 验收：命名明确的图层优先得到高置信角色。

- [x] A4. 增加几何规则识别
  - 大面积矩形优先识别为 `background` 或 `surface`。
  - 低透明黑色大面积层识别为 `mask`。
  - text 图层识别为 `content-text`。
  - 小面积 vector / ellipse 识别为 `icon` 或 `decorative`。
  - 宽高比接近胶囊且有圆角的 rect 识别为 `badge`。
  - 验收：无语义命名时仍可给出合理角色。

- [x] A5. 增加父子结构识别
  - 有多个子内容的 frame/group 识别为 `surface`。
  - 包裹文本和图标的小容器识别为 `action` 或 `badge`。
  - 验收：组合组件不只识别单个 rect，而能识别为 UI 对象角色。

- [x] A6. 增加角色识别单测
  - 文件：`packages/motion-copilot-core/test/zeroLayerMorph.test.ts`
  - 覆盖：背景、容器、文本、按钮、状态胶囊、遮罩、未知角色。
  - 验收：新增测试在 core test 中通过。

## Phase 2：语义顺序编排引擎

- [x] B1. 新增 `zeroMotionOrdering.ts`
  - 路径：`packages/motion-copilot-core/src/zeroLayerMorph/zeroMotionOrdering.ts`
  - 输入：bindingResult、role classification、scene spec。
  - 输出：`ZeroMotionOrderPlan`。
  - 验收：能输出每组图层的开始时间、错峰、并行/串行关系。

- [x] B2. 定义顺序分组
  - 分组建议：
    - `foundation`：root-container、background、surface、mask。
    - `structure`：matched container、主要形变层。
    - `exit-content`：首帧存在、尾帧消失的内容。
    - `enter-content`：尾帧新增内容。
    - `emphasis`：badge、icon、action、强调元素。
  - 验收：同一个帧对可以生成稳定的分组结果。

- [x] B3. 实现默认顺序规则
  - mask 在浮层场景中最先出现。
  - surface / container 先完成主要形变。
  - exit-content 早于 enter-content。
  - content-text、icon、badge 在容器稳定后错峰进入。
  - decorative 不参与强动效，或延后轻微出现。
  - 验收：真机体感上不再出现文字早于底板或容器变化。

- [x] B4. 实现阅读顺序排序
  - 默认：上到下、左到右。
  - 横向组件：左到右。
  - 列表组件：上到下。
  - 验收：多文本、多图标、多行内容错峰顺序稳定。

- [x] B5. 接入 recipe 生成
  - 修改：`zeroLayerMotionRecipes.ts`
  - recipe context 增加 order plan。
  - 现有 recipe 消费语义顺序，而不是各自写死全部 delay。
  - 验收：`container-first`、`content-stagger`、`axis-expand` 至少完成接入。

- [x] B6. 接入参数适配
  - 修改：`adaptZeroLayerRecipeParameters.ts`
  - 角色顺序优先级高于单纯空间排序。
  - 保留空间排序作为同角色内部排序。
  - 验收：同类内容仍可错峰，不同角色按语义阶段排布。

- [x] B7. 增加顺序编排单测
  - 验证容器早于内容。
  - 验证退出内容早于进入内容。
  - 验证 badge/icon/action 不早于 surface。
  - 验证相同帧对多次输出一致。

## Phase 3：Harness 顺序风险检测

- [x] C1. 新增顺序风险类型
  - 建议风险码：
    - `CONTENT_BEFORE_CONTAINER`
    - `ENTER_BEFORE_EXIT`
    - `MASK_AFTER_CONTENT`
    - `DECORATIVE_TOO_EARLY`
    - `ROLE_ORDER_UNKNOWN`
  - 修改：`diagnosticSchema.ts` 或 recipe sample report 相关类型。
  - 验收：风险可以出现在诊断报告中。

- [x] C2. 扩展 `createZeroLayerRecipeSampleReport`
  - 检查每个 recipe 的 step 顺序是否违反 role order。
  - 输出 recipe 级风险。
  - 验收：人为构造错误顺序时测试能报风险。

- [x] C3. 扩展 `zero-layer-diagnose`
  - 在 pretty 输出中展示语义顺序摘要。
  - 展示顺序风险和推荐修复方向。
  - 验收：`npm run verify:zero-motion` 能看到 order / role 相关信息。

- [x] C4. 保持尾帧还原门禁
  - 顺序调整不能影响 progress=1 的尾帧还原。
  - 验收：现有 tail frame 相关测试全部通过。

## Phase 4：新增高差异 App Recipe

- [x] D1. 新增 `tab-indicator-slide`
  - 场景：tab 指示器横向移动。
  - 特征：指示器先滑动，内容轻微淡入替换。
  - 验收：区别于普通 smooth morph，不只是透明度变化。

- [x] D2. 新增 `card-expand-reveal`
  - 场景：卡片从收起到展开。
  - 特征：容器高度/宽度先扩展，内容裁切揭示。
  - 验收：中间帧可明显看到 reveal 过程。

- [x] D3. 新增 `list-insert-push`
  - 场景：列表插入新项。
  - 特征：后续项被推开，新项错峰进入。
  - 验收：有明显的补位和推开效果。

- [x] D4. 新增 `bottom-sheet-rise`
  - 场景：底部面板出现。
  - 特征：mask 先出现，sheet 从底部上升，内容随后进入。
  - 验收：与 dropdown / popover 体感不同。

- [x] D5. 新增 `content-replace`
  - 场景：状态文字、局部内容替换。
  - 特征：旧内容先收起或淡出，新内容按阅读顺序进入。
  - 验收：避免所有文字同时淡入淡出。

- [x] D6. 更新 recipe registry
  - 修改：`zeroLayerMotionRecipes.ts`
  - 每个新增 recipe 有 id、label、category、summary。
  - 验收：UI 中“更多动效方案”可看到新增 recipe。

- [x] D7. 更新推荐打分
  - 修改：`zeroLayerRecipeRecommender.ts`
  - 对 tab、card、list、bottom sheet、content replace 场景给新增 recipe 更高权重。
  - 验收：对应 fixture 下推荐候选包含新增 recipe。

- [x] D8. 更新参数适配
  - 修改：`adaptZeroLayerRecipeParameters.ts`
  - 新 recipe 支持 duration、stagger、axis、intensity。
  - 验收：`verify:zero-motion` 可以展示新 recipe 参数摘要。

- [x] D9. 增加 recipe 差异度测试
  - 修改：`createZeroLayerRecipeSampleReport` 测试。
  - 验收：新增 recipe 不触发大面积 `RECIPE_DIFF_TOO_SMALL`。

## Phase 5：UI 展示与交互补充

- [x] E1. Zero 原生面板展示当前角色摘要
  - 文件：`apps/motion-copilot/src/features/zeroLayerMorph/ZeroLayerMorphPanel.tsx`
  - 展示：容器数、内容数、进入数、退出数、未知角色数。
  - 验收：用户能理解系统识别到哪些角色。

- [x] E2. 展示当前动效顺序
  - 展示分组：容器层、退出内容、进入内容、强调层。
  - 每组展示前 3 个图层名。
  - 验收：用户能看到为什么某些图层先动。

- [x] E3. 推荐卡展示顺序策略
  - 示例：`容器先行 / 内容错峰 / 退出优先`。
  - 验收：不同 recipe 的说明不再只显示 score。

- [x] E4. 质量提示展示顺序风险
  - 如果有顺序风险，折叠摘要显示风险数量。
  - 展开后显示风险码和建议。
  - 验收：风险信息不干扰主流程，但能被定位。

## Phase 6：测试与验收

- [x] F1. Core typecheck
  - 命令：`cd packages/motion-copilot-core && ./node_modules/.bin/tsc --noEmit`
  - 验收：通过。

- [x] F2. Core tests
  - 命令：`cd packages/motion-copilot-core && ./node_modules/.bin/vitest run test/zeroLayerMorph.test.ts`
  - 验收：通过。

- [x] F3. App typecheck
  - 命令：`cd apps/motion-copilot && ./node_modules/.bin/tsc --noEmit`
  - 验收：通过。

- [x] F4. App tests
  - 命令：`cd apps/motion-copilot && ./node_modules/.bin/vitest run src/App.test.tsx`
  - 验收：通过。

- [x] F5. App build
  - 命令：`cd apps/motion-copilot && npm run build`
  - 验收：通过。允许保留现有 Vite Node 版本和 chunk size warning。

- [x] F6. Harness 验证
  - 命令：`npm run verify:zero-motion`
  - 验收：输出角色、顺序、推荐、显著度、recipe sample 信息。

- [ ] F7. 真机验收：顺序
  - 用页面 4 的 `多选项-首帧 / 多选项-尾帧` 验证。
  - 容器或底板先变化。
  - 文本/图标后出现。
  - 退出内容不会晚于进入内容。

- [ ] F8. 真机验收：差异度
  - 分别选择 `容器优先`、`内容错峰`、`卡片展开揭示`、`底部面板上升`、`列表插入推开`。
  - 每个方案有明显不同的中间过程。

- [ ] F9. 真机验收：尾帧
  - 任意 recipe 播放结束后，尾帧严格复原 Zero 尾帧。
  - 导出 HTML 后在浏览器打开，同样严格落到尾帧。

## 文件范围

预计修改文件：

- `packages/motion-copilot-core/src/index.ts`
- `packages/motion-copilot-core/src/zeroLayerMorph/schema.ts`
- `packages/motion-copilot-core/src/zeroLayerMorph/zeroLayerRoleClassifier.ts`
- `packages/motion-copilot-core/src/zeroLayerMorph/zeroMotionOrdering.ts`
- `packages/motion-copilot-core/src/zeroLayerMorph/zeroLayerMotionRecipes.ts`
- `packages/motion-copilot-core/src/zeroLayerMorph/zeroLayerRecipeRecommender.ts`
- `packages/motion-copilot-core/src/zeroLayerMorph/adaptZeroLayerRecipeParameters.ts`
- `packages/motion-copilot-core/src/zeroLayerMorph/createZeroLayerRecipeSampleReport.ts`
- `packages/motion-copilot-core/test/zeroLayerMorph.test.ts`
- `scripts/zero-layer-diagnose.ts`
- `apps/motion-copilot/src/features/zeroLayerMorph/ZeroLayerMorphPanel.tsx`
- `apps/motion-copilot/src/App.test.tsx`
- `apps/motion-copilot/src/styles.css`

预计新增文件不超过 2 个核心源码文件。若实现过程中超过 8 个业务文件，需要重新确认范围。

## 风险与控制

- [ ] 风险：角色识别误判导致顺序更怪。
  - 控制：角色必须带 confidence 和 reasons；低置信角色不参与强顺序约束。

- [ ] 风险：新增 recipe 后差异仍不明显。
  - 控制：recipe sample report 必须检查中间帧 signature 差异。

- [ ] 风险：顺序调整破坏尾帧还原。
  - 控制：progress=1 tail frame 测试必须保持。

- [ ] 风险：UI 信息过载。
  - 控制：角色和顺序信息默认摘要展示，详情折叠。

## 完成定义

- Zero 原生首尾帧生成仍保持当前一键推荐体验。
- 至少 3 个现有 recipe 消费语义顺序计划。
- 至少 5 个新增 App recipe 可在 UI 中选择。
- Harness 能输出角色/顺序相关信息。
- 真机测试中，图层变化顺序明显更符合 App 动效逻辑。
- 不同 recipe 在真机中有可感知差异。
- 尾帧严格还原不回退。
