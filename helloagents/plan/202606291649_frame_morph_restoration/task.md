# 任务清单: 帧间还原能力产品化增强

目录: `helloagents/plan/202606291649_frame_morph_restoration/`

---

## 里程碑

| 里程碑 | 范围 | 验收标准 | 预估周期 |
|--------|------|----------|----------|
| **M1** | task 1 + task 6.1-6.2 + task 4.1-4.4 | 导入后能看到还原质量问题在哪，issue 可定位 | 1-2 周 |
| **M2** | task 2 (P0 子集) + task 3 + task 5 | 能手动修正匹配并重跑，对象模型覆盖 text/container/asset | 2-3 周 |

---

## 1. 还原评分报告 [M1]
- [√] 1.1 在 `packages/motion-copilot-core/src/frameMorph/schema.ts` 中新增 `RestorationReport` / `RestorationIssue` 类型，验证 why.md#需求-导入后可判断还原质量。
- [√] 1.2 为 `RestorationReport` 增加 `inputHash` / `bindingHash` / `generatedAt`，为 `RestorationIssue` 增加 `source: input-missing | conversion-lost | render-risk | user-change`，依赖任务1.1。
- [√] 1.3 新增 `packages/motion-copilot-core/src/frameMorph/createRestorationReport.ts`，按 how.md#评分规则 实现节点覆盖率、样式覆盖率、层级顺序、匹配置信度、视觉风险评分，包含权重、severity 上限、unknown/not-applicable 规则，依赖任务1.2。
- [√] 1.4 在 `packages/motion-copilot-core/src/index.ts` 导出评分报告 API，依赖任务1.3。
- [√] 1.5 在 `packages/motion-copilot-core/test/frameMorph.test.ts` 增加状态条 fixture 评分测试，验证 SVG 背景缺失、圆角缺失、层级错乱能生成带 source 的 issue，依赖任务1.3。

## 2. 对象级图层模型 [M2-P0: text/container/asset]
- [√] 2.1 在 `packages/motion-copilot-core/src/frameMorph/schema.ts` 中新增 `FrameObjectModel` / `FrameObject` 类型，验证 why.md#需求-节点被组织为用户可理解的对象。
- [√] 2.2 新增 `packages/motion-copilot-core/src/frameMorph/buildFrameObjectModel.ts`，P0 阶段仅识别 text、container、asset 三类（纯几何规则：parent-child 包含关系 + bounds 尺寸比例），依赖任务2.1。
- [√] 2.3 在对象识别中优先使用 text、node name、parent bounds、背景节点推断对象名称，避免暴露 `文字 159`，依赖任务2.2。
- [√] 2.4 在 `packages/motion-copilot-core/test/frameMorph.test.ts` 增加对象识别回归，验证 text/container/asset 被正确分类，依赖任务2.2。
- [√] 2.5 跑 benchmark：真机 fixture（节点数 500-1000）下 `buildFrameObjectModel` 须在 50ms 内完成，不达标则做惰性计算/剪枝，依赖任务2.4。
- [-] 2.6 [P1-后续] button、status-pill、label-group 识别，接 AI 语义分类辅助，依赖任务2.5 验收通过后再启动。

## 3. 匹配可视化与人工修正 [M2]
- [√] 3.0 在 `packages/motion-copilot-core/src/frameMorph/schema.ts` 中新增 `UserBindingOverride` 类型，并在 `packages/motion-copilot-core/src/schema/document.ts` 的 `VisualCompositionSource` 中增加 `userBindingOverrides` 可选字段，确保手动修正可持久化。
- [√] 3.1 在 `apps/motion-copilot/src/features/frameMorph/FrameMorphPanel.tsx` 中重构 matched / enter / exit / unresolved 展示，从计数升级为列表，验证 why.md#需求-匹配关系可解释可修正。
- [√] 3.2 为每条匹配展示置信度、原因、首帧节点、尾帧节点、source 类型，依赖任务3.1。
- [√] 3.3 支持手动操作：设为 matched、设为 enter、设为 exit、忽略节点，写入 `userBindingOverrides`，依赖任务3.0 和 3.1。
- [√] 3.4 将人工修正后的绑定结果（合并 `userBindingOverrides`）写回 `compileVisualMotionComposition` 输入，生成新的时间轴，依赖任务3.3。
- [√] 3.5 在 `apps/motion-copilot/src/App.test.tsx` 增加匹配修正交互测试，验证低置信度节点不会静默误配，依赖任务3.4。

## 4. 质量面板与 issue 定位 [M1]
- [√] 4.1 在帧间面板新增”还原质量”区域，默认展示 issue 分级汇总（error/warning/info 各几条），总分作为辅助信息放二级展示，验证 why.md#需求-导入后可判断还原质量。
- [√] 4.2 支持点击 issue 后定位到 `VisualStage` 节点、对象图层和时间轴片段，依赖任务4.1。
- [√] 4.3 在 `VisualCompositionSource` 中增加 `restorationReportCache`，缓存 report / inputHash / bindingHash / generatedAt，保证重新打开项目后仍能查看上次报告，依赖任务1.2 和 4.1。
- [√] 4.4 当 `from/to/bindingResult/userBindingOverrides` 变化导致 hash 不一致时，将旧报告标记为 stale，并提供重算入口，依赖任务4.3。
- [√] 4.5 增加空态和降级态：metadata-only、缺 html、缺 screenshot、缺 data-node-id 时给出明确原因，依赖任务4.1。

## 5. 高低保真统一体验 [M2]
- [√] 5.1 在左侧图层列表中区分对象、代理图层、原始节点，避免用户误以为高保真 iframe 已全部转成原生可编辑图层，验证 why.md#需求-高保真和可编辑不割裂。
- [√] 5.2 点击高保真节点时同步选中对象、代理层和时间轴片段，依赖任务5.1。
- [√] 5.3 右侧属性面板显示节点来源、绑定关系、可编辑参数、不可编辑原因，依赖任务5.2。
- [√] 5.4 支持”转为可编辑图层”入口，仅对安全对象开放，例如文本、圆角矩形、简单按钮，依赖任务2.2。

## 6. 真机回归样本库 [M1: 6.1-6.2]
- [√] 6.1 将当前状态条样例整理为标准 fixture，包括 legacy FrameSnapshot、ZeroVisualSnapshot、预期对象模型、预期报告，验证 why.md#核心场景。
- [√] 6.2 增加真机问题回归：圆角背景、SVG 按钮背景、绿点绿字层级、点击选中、选中不跳位、同名图层，依赖任务6.1。
- [√] 6.3 新增至少 4 类 App 场景 fixture：卡片展开、底部弹层、列表增删、顶部导航切换，依赖任务6.1。
- [√] 6.4 建立 fixture 命名规范和维护说明，避免后续样本混乱，依赖任务6.3。

## 7. 导出与视觉 QA
- [√] 7.1 在导出 HTML 中保留报告元信息或独立 `motion-report.json` 下载入口，验证 why.md#价值主张与成功指标。
- [√] 7.2 扩展 `scripts/verify-zero-visual-export.mjs`，支持读取报告并把 diff 区域回写成 issue，依赖任务1.3。
- [√] 7.3 增加首帧/尾帧/关键中间帧的视觉 QA 脚本用例，依赖任务7.2。

## 8. 安全检查
- [√] 8.1 检查 iframe sandbox、srcDoc 注入、asset URL 代理、报告 JSON 下载，确认不引入远程脚本执行风险。
- [√] 8.2 检查 Zero MCP 失败、asset 404、metadata-only、跨域图片等异常路径，确认 UI 有明确降级提示。

## 9. 文档更新
- [√] 9.1 更新 `docs/2026-06-27-zero-frame-morph-plan.md`，补充评分报告、对象模型、匹配可视化章节。
- [√] 9.2 更新 `docs/2026-06-27-zero-frame-morph-todolist.md`，将本计划同步为下一阶段 P13-P16。
- [√] 9.3 补充 Motion Copilot 模块能力说明，明确”高保真保底，可编辑增强，问题可诊断，结果可修正”。

## 10. 测试与验收
- [√] 10.1 执行 `cd packages/motion-copilot-core && ./node_modules/.bin/vitest run test/frameMorph.test.ts`，记录外部 bridge 慢测环境差异。
- [√] 10.2 执行 `cd packages/motion-copilot-core && ./node_modules/.bin/tsc --noEmit`。
- [√] 10.3 执行 `cd apps/motion-copilot && ./node_modules/.bin/vitest run src/App.test.tsx src/features/visualStage/VisualStage.test.tsx`。
- [√] 10.4 执行 `cd apps/motion-copilot && ./node_modules/.bin/tsc --noEmit`。
- [√] 10.5 执行 `cd apps/motion-copilot && ./node_modules/.bin/vite build && ./node_modules/.bin/vite build --ssr src/server/startProductionServer.ts --outDir dist-server`。
- [ ] 10.6 真机验收状态条样例：低保真背景不丢、高保真背景可见、图层顺序正确、选中不跳位、命名可读、报告能指出风险。

---

## 任务状态符号
- `[ ]` 待执行
- `[√]` 已完成
- `[X]` 执行失败
- `[-]` 已跳过
- `[?]` 待确认
