# P4 · 可编辑 UI 模块

> 上级总揽：[../README.md](../README.md)
> 目标：给用户"调这一层动效"的直接手柄，面板做减法。
> 状态：🟡 进行中（单轨编辑已完成，工作区拆分待后续收口）

## 模块目标

痛点③的 UI 侧。当前编辑区只能改静态几何（X/Y/宽/高/圆角/透明度）+ 整体切 recipe；面板塞满诊断/门禁/采样等调试信息。P4 让动效可局部细调、实时预览，主界面回归"选方案 / 调这层 / 看预览"。

## 规划的功能清单

| #   | 功能                                                            | 状态      |
| --- | --------------------------------------------------------------- | --------- |
| 1   | per-layer 动效编辑：写入 MotionTrack，不再整体 applyRecipe 重算 | 🟢 已完成 |
| 2   | 时间轴：拖拽调 delay / duration                                 | ⚪ 未开始 |
| 3   | 缓动曲线可视化编辑                                              | ⚪ 未开始 |
| 4   | 单图层动效类型下拉                                              | 🟢 已完成 |
| 5   | personality 滑杆（energy / bounce / sharpness）                 | 🟢 已完成 |
| 6   | 面板做减法：诊断/门禁/采样收进「高级/调试」折叠抽屉             | ⚪ 未开始 |
| 7   | 用户改动保留：重新生成时保留 `source:"user"` 的 track           | 🟢 已完成 |

**关键文件**：`apps/motion-copilot/src/features/zeroLayerMorph/MotionPlanEditor.tsx`、`apps/motion-copilot/src/App.tsx`、`packages/motion-copilot-core/src/zeroLayerMorph/compileMotionPlan.ts`。

**实现**：Zero 原生帧间工作台已挂接单轨编辑器，可编辑类型、delay、duration、曲线、首尾关键帧和 personality；编辑仅通过 `patchMotionPlanTrack` 修改选中轨道并标为 `source:"user"`。浏览器核验确认该编辑器、时间轴、预览和 AI 编排入口同时可用。

---

_模块最后更新：2026-07-13 13:56 (+0800)_
