# 帧间动效模块重构蓝图（motion-copilot / zeroLayerMorph）

日期：2026-07-13
方向决策：混合渲染 + LLM 编排 + 物理运行时 + 可编辑 track。保留现有确定性引擎作为 fallback / 物理约束校验层。

## 一、问题根因（审核结论）

| 痛点                     | 根因                                                                                                    | 证据                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 样式识别不精确、预览缺失 | 三重有损压缩：schema 缺字段 → 渲染只取 `fills[0]`/`strokes[0]`、无 rotation → 上游 bridge 不可控        | `schema.ts:54`、`exportZeroLayerCompositionHtml.ts:58`、`dev-api/zeroLayerSnapshot.ts:113` |
| 动效雷同                 | 所有 recipe 共用「bounds 线性插值」引擎，差异只在时间曲线/stagger；哲学上强制 contained、overshoot 恒 0 | `compileZeroLayerMotionComposition.ts:106`、`adaptZeroLayerRecipeParameters.ts:74,243`     |
| 调整成本高               | 动效是 spec 确定性推导的临时产物，非可持久化一等数据；UI 只能改静态几何 + 整体切 recipe                 | `schema.ts:130`、`ZeroLayerMorphPanel.tsx:569,1064`                                        |

## 二、目标架构

```
Zero MCP ──▶ 结构快照(结构+切图) ──▶ 匹配/绑定(沿用) ──▶ MotionPlan(per-layer track, 可持久化)
                                                            ▲            │
                                              LLM 编排(主) │            ▼
                                              规则引擎(兜底)┘   混合渲染 + 物理运行时(WAAPI/motion)
                                                                         │
                                                            时间轴 / 缓动 / 单层类型 可编辑 UI
```

四条改造主线：

- **渲染**：DOM（容器/文字，可编辑）+ 保真切图（图标/复杂矢量），每个 node 带 `renderMode`。
- **动效数据**：新增 per-layer `MotionTrack`（type + keyframes + spring/path + easing + timing），持久化进 `visualSource`，成为可编辑一等对象。
- **生成**：LLM 产出差异化 per-layer 编排 + 连续「性格」参数；规则引擎退为 fallback 与物理约束校验。
- **运行时**：从 CSS keyframe 烘焙升级为 WAAPI / 运动库，支持 spring、路径、overshoot、rotation/skew。

## 三、新数据模型（草案）

```ts
// schema.ts 扩展
type ZeroLayerNode = {
  /* 现有 */
  rotation?: number;
  blendMode?: string;
  renderMode?: "dom" | "image"; // 混合渲染标记
  fills?: ZeroLayerFill[]; // 渲染层改为全量合成，不再只取 [0]
  textStyle?: {
    /* + letterSpacing, fontStyle, textShadow, maxLines */
  };
};

// 动效一等数据
type MotionTrackKind = "morph" | "enter" | "exit" | "emphasis" | "path";
type LayerMotionTrack = {
  layerId: string;
  nodeId: string;
  kind: MotionTrackKind;
  keyframes: MotionKeyframe[]; // 用户可增删拖拽
  physics?:
    | { type: "spring"; stiffness: number; damping: number }
    | { type: "ease"; curve: [number, number, number, number] };
  path?: { points: Array<{ x: number; y: number }> }; // 非直线运动
  timing: { delayMs: number; durationMs: number };
  overshoot?: number;
  personality?: { energy: number; bounce: number; sharpness: number }; // 连续维度
  source: "llm" | "rule" | "user"; // 便于 UI 标注与保留用户改动
};
type MotionPlan = { tracks: LayerMotionTrack[]; stageDurationMs: number };
```

`ZeroLayerMorphSource` 增加 `motionPlan?: MotionPlan`；用户编辑写入 track，不再每次 `applyRecipe` 全量重算。

## 四、分阶段落地

### P0 — 数据地基（无 UI 变化，纯内核）

- 扩 `schema.ts`：node 加 rotation/blendMode/renderMode/textStyle 扩展；新增 `LayerMotionTrack` / `MotionPlan`。
- `normalizeZeroLayerSnapshot.ts` 归一化新字段（向后兼容，字段缺省安全）。
- 新增 `compileMotionPlan.ts`：把现有 recipe 输出转成 `MotionPlan`（适配层，保证旧路径不崩）。
- 验收：`pnpm --filter @motion-copilot/core test` 全绿；旧快照仍能生成。

### P1 — 混合渲染

- `exportZeroLayerCompositionHtml.ts`：`fillCss` 全量合成多 fill；补 rotation/letterSpacing/textShadow/blendMode/多描边；按 `renderMode` 分流 DOM vs `<img>` 切图。
- dev-api / bridge 约定：为 `renderMode:"image"` 的 node 请求 Zero 侧保真切图 URL（矢量优先 SVG）。
- 验收：选一组真实首尾帧，预览还原度肉眼对齐设计稿；`verify:*` 视觉回归通过。

### P2 — 物理运行时

- 新增 `runtime/renderMotionPlan.ts`：用 WAAPI（或引入轻量运动库）执行 `MotionPlan`，支持 spring / path / overshoot / rotation。
- 保留 CSS 导出作为静态 fallback（`prefers-reduced-motion` / 导出 HTML）。
- 验收：同一场景切换 personality 能产出**肉眼明显不同**的三套；真机(移动端)播放流畅。

### P3 — LLM 编排（主生成路径）

- 复用 `intent → plan → assembleFromSpecs` 模式（参考 `intent/generateCompositionDraftLLM.ts`）：新增 `generateMotionPlanLLM.ts`，输入结构快照+绑定，输出 per-layer track（json_schema strict）。
- 失败降级到规则引擎 `compileMotionPlan`；LLM 输出过物理约束校验（不越界/时长合理）。
- 验收：LLM 路径与 fallback 路径都产出合法 `MotionPlan`；断网/报错不破坏 UI。

### P4 — 可编辑 UI + 面板做减法

- `ZeroLayerMorphPanel.tsx`：新增时间轴（拖 delay/duration）、缓动曲线可视化、单图层动效类型下拉、personality 滑杆；编辑写入 track。
- 诊断/门禁/采样/角色/顺序收进「高级/调试」折叠抽屉，主界面只留 选方案 / 调这层 / 看预览。
- 验收：不切 recipe 即可细调单层动效并实时预览；用户改动在重新生成后保留（`source:"user"`）。

## 五、兼容与风险

- **兼容**：新字段全部可选，旧 `ZeroLayerSnapshot` / 旧 recipe 路径继续可用；`MotionPlan` 缺省时回退到现有编译链。
- **风险**：(1) Zero 侧切图能力是 P1 前置依赖，需先确认 bridge 是否能出保真切图；(2) WAAPI 在目标真机 webview 的兼容性需实测；(3) LLM 编排质量依赖 prompt/schema，需要 fixture 回归防退化。
- **回滚**：每个 P 阶段独立可回滚；主链路切换用 feature flag 控制，规则引擎常驻。

## 六、建议执行顺序

P0 → P1 → P2 → P4（先让「能调 + 好看」落地）→ P3（LLM 编排放在有物理运行时和可编辑结构之后，收益最大）。

```

```
