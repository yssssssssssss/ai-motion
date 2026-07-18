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
