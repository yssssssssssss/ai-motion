# 帧间动效重构 · 项目总揽

> 统一过程管理目录：`docs/frame-morph-overhaul/`（所有过程文档集中于此，不分散）
> 本文件是**全局地图**：看这一份即可了解项目全貌、模块划分、阶段规划、未来方向与当前进度。
> 每个模块的功能拆解与实现逻辑追踪，见 `modules/` 下对应文件。
> 可执行任务、验收与阻塞状态见：[TODO.md](TODO.md)。

---

## 1. 项目是什么

对 motion-copilot 产品线的「帧间动效」(代码模块 `zeroLayerMorph`) 做底层重构。
输入：设计工具 Zero 的一对首尾帧（`-首帧` / `-尾帧`）；输出：两帧之间的过渡动效，可在中间预览区还原、可在真机播放、可导出。

## 2. 为什么要重构（三痛点根因）

| 痛点                           | 根因（一句话）                                                                                          | 证据位置                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| ① 图层样式识别不精确、预览缺失 | bridge 已能提取富样式和矢量 asset，但下游仍只消费简化字段，渲染只取 `fills[0]`、不消费 `renderMode`     | `zero-mcp-layer-bridge.mjs`、`schema.ts`、`exportZeroLayerCompositionHtml.ts:58`    |
| ② 动效雷同、真机拉不开差距     | 所有 recipe 共用「bounds 线性插值」引擎，差异只在时间曲线/stagger；哲学上强制 contained、overshoot 恒 0 | `compileZeroLayerMotionComposition.ts:106`、`adaptZeroLayerRecipeParameters.ts:243` |
| ③ 调整成本高                   | 动效是 spec 确定性推导的临时产物，非可持久化一等数据；UI 只能改静态几何 + 整体切 recipe                 | `schema.ts:130`、`ZeroLayerMorphPanel.tsx:569,1064`                                 |

**一句话**：三痛点是同一架构（确定性规则引擎 + 简化 CSS 重建）的三个侧面。它拿"稳/可诊断"换掉了"高保真/差异化/好调"。

## 3. 目标架构

```
Zero MCP ─▶ 结构快照(结构+富样式+切图) ─▶ 匹配/绑定(沿用) ─▶ MotionPlan(per-layer track,可持久化)
                                                              ▲              │
                                                LLM 编排(主) │              ▼
                                                规则引擎(兜底)┘   混合渲染 + 物理运行时(WAAPI/motion)
                                                                            │
                                                              时间轴 / 缓动 / 单层类型 可编辑 UI
```

四条主线：**渲染**（DOM+保真切图混合）、**动效数据**（per-layer MotionTrack 可编辑一等对象）、**生成**（LLM 编排为主、规则兜底）、**运行时**（WAAPI/运动库，支持 spring/path/overshoot）。

## 4. Zero MCP 能力实测结论（2026-07-13）

探针验证 Relay 运行时（真实节点 `28:19`，16 图层）：

- 富样式**全部可读**：rotation / blendMode / letterSpacing / fontName.style / textCase / textDecoration / lineHeight / 渐变 gradientStops+transform / imageHash。
- `node.exportAsync({format:"SVG_STRING"})` 与 PNG **全节点可用**（SVG 2740B、PNG 12086B 实测成功），bridge 已输出复杂矢量 SVG asset。
- **结论**：P0/P1 无前置阻塞。当前根因已从“拿不到数据”收敛为“下游没有完整消费数据”：`renderMode`、多 fill、多 stroke 与基础 transform 尚未接入同源渲染和导出。

## 5. 模块地图与阶段规划

| 模块              | 目标                                                    | 详细文档                                                           | 状态                                                                        |
| ----------------- | ------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| **P0 数据地基**   | 扩样式 schema + 动效一等数据模型 MotionPlan + 适配层    | [modules/P0-data-foundation.md](modules/P0-data-foundation.md)     | 🟢 已完成（富样式字段、MotionPlan 数据模型、recipe 编译与兼容视图均已落地） |
| **P1 混合渲染**   | bridge 提富样式+切图；渲染全量还原；DOM/切图混合        | [modules/P1-hybrid-rendering.md](modules/P1-hybrid-rendering.md)   | 🟢 已完成（预览与导出共用 paint/renderMode 与五检查点门禁）                 |
| **P2 物理运行时** | WAAPI/运动库执行 MotionPlan，支持 spring/path/overshoot | [modules/P2-physics-runtime.md](modules/P2-physics-runtime.md)     | 🟢 已完成（WAAPI、spring/path 烘焙、reduced-motion 回退）                   |
| **P3 LLM 编排**   | LLM 产 per-layer 差异化 track，规则引擎降为 fallback    | [modules/P3-llm-orchestration.md](modules/P3-llm-orchestration.md) | 🟢 已完成（严格 draft、确定性 assembler、中间态去重与降级）                 |
| **P4 可编辑 UI**  | 时间轴+缓动曲线+单层类型+personality；面板做减法        | [modules/P4-editable-ui.md](modules/P4-editable-ui.md)             | 🟡 进行中（单轨编辑已接入；工作区拆分与调试抽屉待后续收口）                 |

执行顺序：P0 → P1 →（P2 / P4 让"能调+好看"先落地）→ P3。
状态图例：⚪未开始 · 🟡进行中 · 🟢已完成 · 🔴受阻。

## 6. 未来方向（重构之外）

- 规则引擎不删除，长期作为 LLM 编排的 **fallback + 物理约束校验层**。
- 动效持久化后，可沉淀「团队动效风格库」（personality 预设）。
- 切图保真链路打通后，可支持导出到真机的高保真预览与验收回归。

## 7. 如何用本文档追踪与还原

- 想看**全貌** → 本文件。
- 想追**某功能的实现逻辑/思路** → `modules/<模块>.md` 里对应「功能 N」小节，含设计思路、涉及文件、关键函数、数据流。
- 想**调试/回滚某次改动** → 模块文档每个功能小节末尾的「变更 / 调试还原」条目，含时间戳与 `git diff` 目标文件。

---

_最后更新：2026-07-21 (+0800)_
