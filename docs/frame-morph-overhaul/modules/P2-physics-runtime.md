# P2 · 物理运行时模块

> 上级总揽：[../README.md](../README.md)
> 目标：打破「bounds 线性插值」天花板，让动效在真机上拉开差距。
> 状态：🟢 已完成（真实设备参考图门禁仍待外部素材）

## 模块目标

痛点②的运行时侧。当前所有 recipe 最终都是 translate+width/height+opacity 的线性插值，rotate/scale 基本恒定，表现差异只在时间曲线。P2 引入真正的表现维度并升级执行引擎。

## 规划的功能清单

| #   | 功能                                                                              | 状态      |
| --- | --------------------------------------------------------------------------------- | --------- |
| 1   | 运行时升级：CSS keyframe 烘焙 → WAAPI / 运动库                                    | 🟢 已完成 |
| 2   | 物理表现：spring（stiffness/damping）、overshoot                                  | 🟢 已完成 |
| 3   | 路径运动：polyline 轨迹替代直线 translate                                         | 🟢 已完成 |
| 4   | per-layer 差异化：rotation、独立缓动                                              | 🟢 已完成 |
| 5   | 连续「性格」参数：energy / bounce / sharpness（取代 subtle/balanced/strong 三档） | 🟢 已完成 |
| 6   | CSS 导出保留为静态 fallback（prefers-reduced-motion / 导出 HTML）                 | 🟢 已完成 |

**关键文件**：`packages/motion-copilot-core/src/zeroLayerMorph/motionPlanRuntime.ts`、`apps/motion-copilot/src/features/zeroLayerMorph/ZeroLayerStage.tsx`。

**实现**：纯采样器负责暂停与拖动；spring/path 在 CSS 和 WAAPI 前烘焙成同一套关键帧。播放时 `ZeroLayerMotionStage` 使用 WAAPI，导出 HTML 复用编译器；`prefers-reduced-motion` 直接展示尾帧。

**风险**：WAAPI 在目标真机 webview 的兼容性需实测。

---

_模块最后更新：2026-07-13 13:56 (+0800)_
