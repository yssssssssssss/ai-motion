# Zero 原生首尾帧动效产品化 Todo

日期：2026-07-01

关联方案：`docs/2026-07-01-zero-native-motion-productization-plan.md`

## 总体验收

- [x] 用户不需要手动识别 `nodeId`，也能选择 Zero 首帧和尾帧。
- [ ] Zero 原生动效方案不少于 6 个，并能在真机上感知明显差异。
- [x] 任意动效方案最终帧严格还原 Zero 尾帧。
- [x] matched 图层过程帧不超出首尾帧 corridor。
- [ ] 导出 HTML 与应用内预览一致。
- [x] 诊断报告能说明失败原因和推荐动作。

## Phase 1：首尾帧选择体验

目标：降低 `nodeId` 输入门槛。

- [x] 梳理 Zero 原生读取链路。
  - 范围：`apps/motion-copilot/src/features/zeroLayerMorph/ZeroLayerMorphPanel.tsx`
  - 范围：`apps/motion-copilot/src/services/zeroLayerClient.ts`
  - 验收：明确当前可从 snapshot / bridge 中拿到哪些候选节点信息。

- [x] 定义候选节点结构。
  - 范围：`packages/motion-copilot-core/src/zeroLayerMorph/schema.ts`
  - 验收：候选节点包含 `nodeId`、`name`、`kind`、`bounds`、可选 `path` / `preview`。

- [x] 从 Zero layer snapshot 派生候选节点。
  - 范围：`packages/motion-copilot-core/src/zeroLayerMorph/`
  - 验收：根节点、frame/group、可动子节点都能被稳定列出。
  - 验收：隐藏或尺寸为 0 的节点不会成为默认候选。

- [x] 在 UI 中新增候选节点列表。
  - 范围：`ZeroLayerMorphPanel.tsx`
  - 验收：用户可以搜索名称或 `nodeId`。
  - 验收：用户可以点击“设为首帧”或“设为尾帧”。
  - 验收：手动输入入口仍然保留。

- [ ] 增加当前选中节点读取能力的适配口。
  - 范围：服务端 bridge 或 dev-api。
  - 验收：如果环境支持当前选择，显示“一键使用当前选中节点”。
  - 验收：如果环境不支持，不影响候选列表和手动输入。
  - 备注：当前 `zero-mcp-layer-bridge` 未暴露当前选中节点能力，本轮不做假实现。

- [x] 增加测试。
  - 验收：候选节点派生单测。
  - 验收：UI 选择首尾帧测试。
  - 验收：手动输入回归测试。

## Phase 2：动效方案扩展

目标：让方案在真机上有明显节奏差异，但不破坏尾帧和空间约束。

- [x] 扩展 recipe 类型。
  - 范围：`packages/motion-copilot-core/src/zeroLayerMorph/zeroLayerMotionRecipes.ts`
  - 验收：`ZeroLayerMotionRecipeId` 支持新增方案。
  - 验收：recipe metadata 支持分类和适用说明。

- [x] 新增“容器优先展开”方案。
  - 验收：主容器先完成形变，内容延后进入。
  - 验收：matched 图层不越界。

- [x] 新增“内容错峰进入”方案。
  - 验收：文字、图标、按钮按空间顺序错峰。
  - 验收：小组件上也能感知节奏差异。

- [x] 新增“遮罩揭示”方案。
  - 验收：进入内容在自身或容器范围内 reveal。
  - 验收：不使用超出尾帧范围的位移。

- [x] 新增“焦点引导”方案。
  - 验收：主对象先动，次级对象延后。
  - 验收：适合手机 app 的状态强调。

- [x] 新增“轴向展开”方案。
  - 验收：根据首尾帧 delta 判断 X 轴或 Y 轴。
  - 验收：适合胶囊、列表、底部栏。

- [x] 新增“列表重排”方案。
  - 验收：多个元素按空间关系依次移动。
  - 验收：无列表结构时优雅降级为普通 morph。

- [x] UI 增加 recipe 分类展示。
  - 范围：`ZeroLayerMorphPanel.tsx`、`apps/motion-copilot/src/styles.css`
  - 验收：支持按场景筛选或分组。
  - 验收：不再只是平铺一长串按钮。

- [x] 增加 recipe 回归测试。
  - 范围：`packages/motion-copilot-core/test/zeroLayerMorph.test.ts`
  - 验收：所有 recipe 最终帧锁定尾帧。
  - 验收：所有 recipe matched motion 在 corridor 内。
  - 验收：不同 recipe 的 timing / easing / opacity / stagger 有可检测差异。

## Phase 3：Harness 自动验收升级

目标：把多轮人工调参固化成可重复的工程门禁。

- [x] 定义 recipe 采样报告 schema。
  - 范围：`packages/motion-copilot-core/src/zeroLayerMorph/`
  - 验收：报告包含 recipeId、采样点、bbox、opacity、风险、建议。

- [x] 实现 progress 采样计算。
  - 验收：支持 `0`、`0.25`、`0.5`、`0.75`、`1`。
  - 验收：能在不打开浏览器的情况下检查 step 几何。

- [x] 实现 corridor 检查。
  - 验收：matched 图层任何采样点超出 corridor 都生成 error。
  - 验收：enter / exit 图层按自身空间规则检查，不误报 matched 规则。

- [x] 实现尾帧硬门禁。
  - 验收：`progress=1` 的结构和几何结果等于 Zero 尾帧。
  - 验收：导出 HTML 可继续使用截图 gate 做像素对比。

- [x] 实现 recipe 差异度检查。
  - 验收：两个 recipe 如果只改 label 或差异过小，会产生 warning。
  - 验收：差异度比较 timing、easing、opacity、stagger 和中间帧状态。

- [x] 扩展 CLI。
  - 范围：`scripts/zero-layer-diagnose.mjs`、`scripts/zero-layer-diagnose.ts`
  - 验收：支持指定 recipe。
  - 验收：支持输出 recipe 采样报告。
  - 验收：支持 `--fail-on recipe-diff` 或等价门禁。

- [x] 应用内展示 harness 摘要。
  - 范围：`ZeroLayerMorphPanel.tsx`
  - 验收：显示通过/警告/失败。
  - 验收：显示失败原因和推荐动作。
  - 验收：用户切换 recipe 后诊断结果同步刷新。

- [x] 增加测试。
  - 验收：采样报告单测。
  - 验收：corridor 失败单测。
  - 验收：尾帧不一致失败单测。
  - 验收：recipe 差异度不足单测。
  - 验收：CLI 输出和 fail-on 测试。
  - 备注：已完成采样报告、差异度、应用内摘要、CLI 输出和 fail-on 测试。

## Phase 4：产品闭环 polish

目标：让 Zero 原生链路可以稳定演示、测试和上线。

- [ ] 统一 Zero 原生区域文案。
  - 验收：主流程文案面向用户。
  - 验收：`nodeId` 标识为高级信息。

- [ ] 优化错误和降级提示。
  - 验收：Zero MCP 不可用时有明确提示。
  - 验收：metadata-only 时阻断 Zero 原生生成。
  - 验收：低置信匹配时提示用户确认。

- [x] 优化下载入口文案。
  - 验收：Zero 原生场景显示“下载 Zero 原生动效 HTML”。
  - 验收：低保真/普通组合场景仍显示对应导出文案。

- [x] 增加真机测试 checklist。
  - 验收：覆盖首尾帧选择、recipe 切换、预览、导出、真机打开。
  - 验收：包含 `28:19 -> 28:2` 基线，但不写死为唯一案例。

- [x] 提高时间轴拖拽高度上限。
  - 范围：`apps/motion-copilot/src/App.tsx`
  - 验收：编排/时间轴区域向上拖拽时允许更高，最高可到固定上限或视口高度的 70%。
  - 验收：预览区随时间轴高度变化继续等比缩放，不破坏主视窗固定布局。

- [x] 删除 Zero 原生右侧重复的“可编辑图层”入口。
  - 范围：`apps/motion-copilot/src/features/zeroLayerMorph/ZeroLayerMorphPanel.tsx`
  - 验收：Zero 原生面板不再同时出现右侧“可编辑图层”和左侧“图层素材”两套列表。
  - 验收：用户仍可通过 Zero 预览/主画布选中图层，并在“当前图层”参数区编辑位置、尺寸、圆角和透明度。

- [x] 跑完整模块验证。
  - 命令：`pnpm --filter @motion-copilot/core test -- test/zeroLayerMorph.test.ts`
  - 命令：`pnpm --filter @motion-copilot/app test -- src/App.test.tsx`
  - 命令：`pnpm --filter @motion-copilot/core typecheck`
  - 命令：`pnpm --filter @motion-copilot/app typecheck`
  - 命令：`pnpm --filter @motion-copilot/app build`
  - 备注：本轮 `pnpm --filter` 被本机 `approve-builds` 检查拦截，已使用项目本地 `vitest` / `tsc` / `vite build` 等价验证；client build 与 SSR build 均通过，Vite 提示 Node 22.10.0 低于推荐 22.12+，不阻断。

## 当前不做

- [ ] 不接入 LLM 自动生成动画代码。
- [ ] 不写回 Zero。
- [ ] 不自动修改 Zero 稿件。
- [ ] 不新增 dev server 或端口。
- [ ] 不把低保真、高保真、Zero 原生合并成一个入口。

## 开发注意事项

- 只触碰 Motion Copilot 和 `packages/motion-copilot-core` 的 Zero 原生相关文件。
- 不回滚工作树中已有的其它修改。
- 新 recipe 必须先有测试证明尾帧和 corridor 约束。
- UI 改动保持当前 Motion Copilot 独立模块风格。
- 如果 Zero MCP 当前选中节点能力不可用，优先交付候选列表，不阻塞主流程。
