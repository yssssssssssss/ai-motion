# 原子 / 非原子动效组件隔离修复 Todolist

## 目标

在保证当前原子动效组件完整性的前提下，修复非原子动效组件被原子组件污染的问题。

必须保持：

- 原子动效参数 tab 继续完整展示原子动效组件。
- 原子动效组件的生成、编辑、参数面板、图层替换、预览能力不被破坏。
- 智能推荐和自然语义生成只使用非原子/code/semantic 组件。
- 非原子组件不能把原子组件作为推荐、生成参考或 recipe 目标。

## 当前诊断结论

- 组件池隔离是第一层问题：普通 feed、智能推荐、自然语义生成曾使用全量 `components`，导致原子组件进入非原子入口。
- 真机复测后确认第二层问题需要修正：`横向切换代码动效` 自身包含 `频道Tab`、`Tabbar底导` 是原组件动效结构的一部分，不应作为“原子混用”删除。隔离边界应放在 feed、推荐、自然语义生成候选和 recipe 目标列表，不破坏组件本体。
- `弹窗反馈-缓动代码动效` 有 `couponPopupImage` 图片参数，替换目标是 `source/assets.css` 的 `--coupon-popup`；预览端需要稳定支持 `:root` CSS 变量动态写入和图片参数初始注入。

## 实施清单

- [x] 1. 梳理组件身份判定
  - 新增统一函数 `isAtomicMotionComponent(component)`。
  - 判定条件包含 `manifest.motionSkill`、`tags.includes("atomic-motion")`、`useCases.includes("atomic-motion")`。
  - 避免各模块重复实现身份判断。

- [x] 2. 调整组件 Feed scope
  - 将普通列表语义从 `all` 明确为 `non-atomic`。
  - `non-atomic` 只展示非原子/code/semantic 组件。
  - `atomic-motion` 只展示原子动效组件。
  - 保留原子 tab 的展示完整性。

- [x] 3. 修改 `HomeRoute` 的组件池分流
  - 计算 `nonAtomicComponents`，并让原子 tab 继续通过 `atomic-motion` scope 从全量组件中筛选。
  - `智能推荐` 使用 `nonAtomicComponents`。
  - `自然语义生成` 使用 `nonAtomicComponents`。
  - `原子动效参数` tab 继续使用现有原子生成链路。

- [x] 4. 修复智能推荐污染
  - `runRecommend()` 调用 `recommendComponents()` 时传非原子组件池。
  - 推荐结果区域只展示非原子组件。
  - 防止原子组件出现在智能推荐结果中。

- [x] 5. 修复自然语义生成污染
  - `runGenerate()` 调用 `loadControlledGenerationCandidates()` 时传非原子组件池。
  - `generationCandidates` 内部再加一道过滤防线。
  - 防止原子组件作为 reference-guided generation 的参考组件。

- [x] 6. 检查动效 Recipe 目标列表
  - 非原子组件的“应用动效到其他组件”目标列表默认排除原子组件。
  - 原子组件编辑器不改。
  - 防止 code 组件和 atomic 组件互相套用导致结构污染。

- [x] 7. 保护原子动效完整性
  - 不改 `atomicMotionGeneration.ts` 的生成逻辑。
  - 不改 `createMotionSkillDraftComponent`。
  - 不改 `AtomicMotionInspectorPanel`。
  - 不改 `motion-skills/*` 数据源。
  - 不改原子组件的 `manifest.motionSkill`、tokens、recipes、图层替换能力。

- [x] 8. 补回归测试：Feed 隔离
  - 普通 feed 不显示 `atomic-motion` 组件。
  - 原子 feed 显示完整原子组件。
  - `manifest.motionSkill` 即使没有 tag/useCase，也会被识别为原子组件。

- [x] 9. 补回归测试：推荐隔离
  - HomeRoute 或推荐相关测试确认推荐池排除原子组件。
  - `ComponentCandidates` 不展示原子推荐结果。

- [x] 10. 补回归测试：生成隔离
  - `loadControlledGenerationCandidates()` 输入混合组件时，只返回非原子组件。
  - 显式引用原子组件时，也不进入非原子自然语义生成候选。

- [x] 11. 补回归测试：原子完整性
  - 现有 `atomicMotionGeneration.test.ts` 全部继续通过。
  - 验证原子 feed components 仍包含 `atomic-motion` tags/useCases。
  - 验证生成的原子组件仍包含 `manifest.motionSkill`。
  - 验证原子组件仍可进入 atomic 参数面板。

- [x] 12. 专项检查 `弹窗反馈-缓动代码动效`
  - 确认 `couponPopupImage` 替换链路仍可用。
  - 确认非原子编辑器的“图层替换”tab 仍显示图片替换入口。
  - 补强 `:root` CSS 变量预览补丁，确保上传图片可写入 `--coupon-popup`。

- [x] 12.1. 恢复 `横向切换代码动效` 原始动效结构
  - 恢复 `channel-tabs` DOM 和底导 DOM。
  - 恢复频道 Tab / 底导 CSS、真实图片图标样式、keyframes。
  - 恢复频道 Tab / 底导 JS controller。
  - 恢复 manifest 中频道 Tab / 底导 recipe、params、groups。
  - 保持该组件不具备原子组件身份标记，混用隔离继续由组件池 scope 和候选列表负责。

- [x] 12.2. 恢复非原子代码组件的参数与图层管理能力
  - `前后进场代码动效`、`横向切换代码动效`、`弹窗反馈-缓动代码动效`、`弹窗反馈-迅速代码动效`、`商品详情转场代码动效` 均补齐显式 `layers`。
  - 可替换图层必须绑定真实 `paramId`，图层替换面板通过该绑定显示上传或文案替换入口。
  - 非原子组件编辑器默认进入完整参数模式，避免被 Plus/原子参数面板隐藏高级参数。
  - 图层面板在没有可上传参数时仍展示结构图层清单，避免误判为“图层能力丢失”。
  - Recipe 目标列表继续排除原子组件，并优先使用绑定参数的可替换图层作为迁移目标。

- [x] 13. 运行验证
  - `pnpm --filter @motion-tool/web test -- ComponentFeed HomeRoute generationCandidates`
  - `pnpm --filter @motion-tool/web test -- PreviewFrame previewHtml LayerReplacementPanel`
  - `pnpm --filter @motion-tool/web test -- atomicMotionGeneration`
  - `pnpm --filter @motion-tool/components-builtin test -- jdPopupFeedbackEased jdPopupFeedbackFast lazy`
  - `pnpm --filter @motion-tool/components-builtin test -- jdFrontBackEntryTransition jdHorizontalSwitch jdPopupFeedbackEased jdPopupFeedbackFast jdProductTransitionVideo nonAtomicCodeComponents lazy`
  - `pnpm --filter @motion-tool/web test -- LayerReplacementPanel MotionRecipePanel App PreviewFrame previewHtml`
  - `pnpm --filter @motion-tool/web test -- ComponentFeed HomeRoute generationCandidates atomicMotionGeneration`
  - `pnpm --filter @motion-tool/web typecheck`
  - `pnpm --filter @motion-tool/components-builtin typecheck`

- [ ] 14. 人工验收
  - 打开智能推荐 tab：不出现原子动效组件。
  - 打开自然语义生成 tab：生成参考不混入原子组件。
  - 打开原子动效参数 tab：原子组件完整展示并可编辑。
  - 打开 `横向切换代码动效`：保留原始 Tab 导航、频道 Tab、Tabbar 底导动效结构，但不把原子组件混入该组件的推荐/套用目标。
  - 打开 `弹窗反馈-缓动代码动效`：图片替换入口仍存在，替换后预览有效。

## 推荐实施顺序

1. 先做 1-5，建立隔离边界。
2. 再做 8-11，用测试锁住隔离和原子完整性。
3. 然后做 6 和 12，处理 recipe 目标和弹窗替换边界。
4. 最后执行 13-14，完成自动化和人工验收。

## 进度记录

- 2026-06-24：创建 todolist 文档，尚未开始代码修改。
- 2026-06-24：完成组件身份判定、feed scope、HomeRoute 组件池分流、智能推荐/自然语义生成隔离、recipe 目标隔离，并补充对应回归测试。尚未完成测试运行和人工验收。
- 2026-06-24：完成自动化验证：web 目标测试、web typecheck、components-builtin 弹窗与 lazy 测试均通过。人工浏览器/真机验收尚未执行。
- 2026-06-24：根据真机反馈修正二次修复方向：恢复 `横向切换代码动效` 的原始频道 Tab / 底导源码与 manifest，隔离逻辑仍保留在 feed / 推荐 / 生成候选 / recipe 目标层。`弹窗反馈-缓动代码动效` 预览替换链路已补强 `:root` CSS 变量写入、图片参数初始注入、预览 postMessage wildcard target origin，并新增真实弹窗组件图片替换预览测试。仍需真机人工复验第 14 项。
- 2026-06-24：确认根因不是变量、类名或组件命名冲突，而是非原子代码组件缺少完整 `layers` 元数据、编辑器默认参数模式不适合非原子组件、图层面板对非参数图层缺少可见清单。已补齐 5 个目标组件的图层绑定、收紧 Recipe 目标选择，并新增 `nonAtomicCodeComponents` 聚合回归测试。自动化测试和 typecheck 均通过，仍需真机人工复验第 14 项。
