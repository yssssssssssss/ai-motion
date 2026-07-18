# P3 · LLM 编排模块

> 上级总揽：[../README.md](../README.md)
> 目标：让 LLM 产出差异化 per-layer 编排，规则引擎降为 fallback + 物理约束校验。
> 状态：⚪ 未开始（放最后，收益最大——需先有物理运行时与可编辑结构）

## 模块目标

痛点②的生成侧。当前推荐是纯规则打分，同类设计稿必然收敛到同一 recipe。P3 复用项目已有的 `intent → plan → assemble` 成熟模式，让 LLM 只负责"意图抽取 + per-layer 差异化编排 + 性格选择"，组装与校验仍是确定性的。

## 规划的功能清单

| #   | 功能                                                                         | 状态      |
| --- | ---------------------------------------------------------------------------- | --------- |
| 1   | generateMotionPlanLLM：结构快照+绑定 → per-layer track（json_schema strict） | ⚪ 未开始 |
| 2   | 降级链：LLM 失败 → compileMotionPlan 规则兜底                                | ⚪ 未开始 |
| 3   | 物理约束校验：LLM 输出过闸（不越界/时长合理/可播放）                         | ⚪ 未开始 |
| 4   | fixture 回归：防 prompt/schema 退化                                          | ⚪ 未开始 |

**关键文件（计划）**：`packages/motion-copilot-core/src/intent/generateMotionPlanLLM.ts`（新增，参考 `generateCompositionDraftLLM.ts`）。
**架构约束**（CLAUDE.md）：LLM 仅服务端；组装逻辑确定性共享；失败必须降级不破坏 UI。

---

_模块最后更新：2026-07-13 13:56 (+0800)_
