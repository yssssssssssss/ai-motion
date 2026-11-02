# P3 · LLM 编排模块

> 上级总揽：[../README.md](../README.md)
> 目标：让 LLM 产出差异化 per-layer 编排，规则引擎降为 fallback + 物理约束校验。
> 状态：🟢 已完成

## 模块目标

痛点②的生成侧。当前推荐是纯规则打分，同类设计稿必然收敛到同一 recipe。P3 复用项目已有的 `intent → plan → assemble` 成熟模式，让 LLM 只负责"意图抽取 + per-layer 差异化编排 + 性格选择"，组装与校验仍是确定性的。

## 规划的功能清单

| #   | 功能                                                                           | 状态      |
| --- | ------------------------------------------------------------------------------ | --------- |
| 1   | MotionPlanDraft：结构快照+绑定 → 轨道选择、节奏与 personality（strict schema） | 🟢 已完成 |
| 2   | 降级链：LLM 失败 → 保留 compileMotionPlan 规则方案                             | 🟢 已完成 |
| 3   | 确定性 assembler：绑定 nodeId、约束时间窗和终态                                | 🟢 已完成 |
| 4   | 中间态去重与 fixture 回归：拒绝仅标签或 easing 不同的候选                      | 🟢 已完成 |

**关键文件**：`packages/motion-copilot-core/src/zeroLayerMorph/generateMotionPlanDraft.ts`、`apps/motion-copilot/src/dev-api/generateZeroMotionPlan.ts`、`apps/motion-copilot/src/services/generateZeroMotionPlanClient.ts`。
**边界**：模型无法输出 nodeId、layerId、坐标、CSS 或关键帧；这些内容由 assembler 根据当前 MotionPlan 与绑定结果确定。任何网络、超时或 schema 异常都保留本地规则方案。
**架构约束**（CLAUDE.md）：LLM 仅服务端；组装逻辑确定性共享；失败必须降级不破坏 UI。

---

_模块最后更新：2026-07-13 13:56 (+0800)_
