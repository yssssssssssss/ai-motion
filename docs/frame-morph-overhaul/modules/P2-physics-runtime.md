# P2 · 物理运行时模块

> 上级总揽：[../README.md](../README.md)
> 目标：打破「bounds 线性插值」天花板，让动效在真机上拉开差距。
> 状态：⚪ 未开始（依赖 P0 的 MotionPlan 数据模型）

## 模块目标

痛点②的运行时侧。当前所有 recipe 最终都是 translate+width/height+opacity 的线性插值，rotate/scale 基本恒定，表现差异只在时间曲线。P2 引入真正的表现维度并升级执行引擎。

## 规划的功能清单

| #   | 功能                                                                              | 状态      |
| --- | --------------------------------------------------------------------------------- | --------- |
| 1   | 运行时升级：CSS keyframe 烘焙 → WAAPI / 运动库                                    | ⚪ 未开始 |
| 2   | 物理表现：spring（stiffness/damping）、overshoot                                  | ⚪ 未开始 |
| 3   | 路径运动：bezier 轨迹替代直线 translate                                           | ⚪ 未开始 |
| 4   | per-layer 差异化：rotation/skew、独立缓动                                         | ⚪ 未开始 |
| 5   | 连续「性格」参数：energy / bounce / sharpness（取代 subtle/balanced/strong 三档） | ⚪ 未开始 |
| 6   | CSS 导出保留为静态 fallback（prefers-reduced-motion / 导出 HTML）                 | ⚪ 未开始 |

**关键文件（计划）**：`packages/motion-copilot-core/src/runtime/renderMotionPlan.ts`（新增）；消费 P0 的 `MotionPlan`。

**风险**：WAAPI 在目标真机 webview 的兼容性需实测。

---

_模块最后更新：2026-07-13 13:56 (+0800)_
