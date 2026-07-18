# 帧间动效重构 · 实施变更记录

> 统一过程管理目录：`docs/frame-morph-overhaul/`。所有过程文件集中于此，不分散。
> 本文件是总记录：每完成一个模块更新一次，带时间戳，记录「改了什么 / 实现了什么 / 如何调试还原」。
> 方案蓝图见：[`../superpowers/plans/2026-07-13-frame-morph-overhaul.md`](../superpowers/plans/2026-07-13-frame-morph-overhaul.md)

---

## 背景与总方向

motion-copilot「帧间动效」(zeroLayerMorph) 重构。三痛点根因与方向决策见蓝图。

- 方向：混合渲染 + LLM 编排 + 物理运行时 + 可编辑 track；规则引擎降为 fallback。
- 阶段：P0 数据地基 → P1 混合渲染 → P2 物理运行时 → P4 可编辑 UI → P3 LLM 编排。

### Zero MCP 实测结论（2026-07-13）

用探针脚本验证 Relay 运行时（真实节点 `28:19`，16 图层）：

- 富样式数据源**全部可读**：rotation / blendMode / letterSpacing / fontName.style / textCase / textDecoration / lineHeight / 渐变 gradientStops+gradientTransform / imageHash。当前 bridge 只是没提取。
- `node.exportAsync({format:"SVG_STRING"})` 与 PNG **全节点可用**（实测 SVG 2740B、PNG 12086B）。→ P1 混合渲染切图可行。
- 结论：P0 / P1 均无前置阻塞。"图标/矢量/渐变还原不了"的根因是 `zero-mcp-layer-bridge.mjs` 提取脚本过于保守（`assets:[]` 空导出、渐变丢 stops、富样式不提取）。

---

## 变更记录

### [2026-07-13 18:42] P0 起步 · 扩展 ZeroLayer schema 富样式字段

**模块**：`packages/motion-copilot-core/src/zeroLayerMorph/schema.ts`

**改了什么**

- `ZeroLayerTextStyle` 新增可选字段：`letterSpacing?: number`、`fontStyle?: "normal"|"italic"`、`textDecoration?: "none"|"underline"|"line-through"`、`textCase?: "none"|"upper"|"lower"|"capitalize"`。
- （待续本条目）`ZeroLayerNode` 计划新增：`rotation?: number`、`blendMode?: string`、`renderMode?: "dom"|"image"`。

**实现了什么**：为富样式还原提供数据结构承载位（全部可选，向后兼容，旧快照不受影响）。

**如何调试/还原**：`git diff packages/motion-copilot-core/src/zeroLayerMorph/schema.ts`；回滚只需删除新增字段行。字段全可选，删除不影响既有逻辑。

**状态**：进行中。下一步补 `ZeroLayerNode` 字段 → normalize 承接 → render 使用 → bridge 提取。

---

### [2026-07-18] Recipe 清单化改造落地 + 过程文档归档 + lint 清理（本地提交 `7cb79d4`）

**模块**：`zeroLayerMorph`(recipe/推荐/表达策略)、schema、过程文档

**改了什么**

- 新增 `zeroLayerRecipeManifests.ts`：recipe 携带结构化元数据 `intent`/`targets`/`restraint`/`bestFor`/`avoidWhen`。
- 推荐器 `zeroLayerRecipeRecommender.ts` 收敛到 manifest 驱动，精简散落打分逻辑(-158 行)。
- 重写 `zeroLayerMotionRecipes.ts`(±450)、扩展 `zeroLayerExpressionStrategies.ts`(+224)。
- schema 富样式承载字段(P0 功能1/2)一并纳入本次提交。
- 归档帧间动效重构蓝图与 P0-P4 过程文档;补 `AGENTS.md`;`.gitignore` 忽略 `.pnpm-store/` 与 `.tmp-*`。
- lint 清理:误命名的 `use*` 辅助函数改名(`useFramePair`→`applyFramePair`、`useFrameMorphFixtureIds`→`stubFrameMorphFixtureIds`),删死代码与未用 import。

**实现了什么**：为「差异化编排」提供了 recipe 元数据地基——manifest 是 P0 数据地基的合理前奏,但**不等同**蓝图 P0 功能3/4(`MotionPlan` 动效一等数据仍未开工)。

**如何调试/还原**：`git show 7cb79d4`;回滚整条提交 `git revert 7cb79d4`。

**验证**：motion-copilot-core 171/171、app 87/87 全绿,ESLint 干净。

**状态**：已完成(本地)。下一步进入 P0 功能3——`MotionTrack`/`MotionPlan` 数据模型。
