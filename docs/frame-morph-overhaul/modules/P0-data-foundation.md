# P0 · 数据地基模块

> 上级总揽：[../README.md](../README.md)
> 目标：为「高保真样式」和「可编辑动效」提供数据结构承载，纯内核、向后兼容、不改行为。
> 状态：🟡 进行中（功能1/2 已完成，功能3/4 待做）

## 模块目标

当前 `ZeroLayerNode` / `ZeroLayerTextStyle` 只能表达设计属性的一个子集，动效则是临时推导产物无处持久化。P0 先把"数据结构"这层地基打好，让后续 P1（渲染用富样式）、P2/P4（编辑动效）有地方存数据。

## 规划的功能清单

| #   | 功能                                                      | 状态      |
| --- | --------------------------------------------------------- | --------- |
| 1   | 富样式字段扩展（ZeroLayerNode + ZeroLayerTextStyle）      | 🟢 完成   |
| 2   | normalize 归一化承接新字段                                | 🟢 完成   |
| 3   | 动效一等数据模型 MotionTrack / MotionPlan                 | ⚪ 未开始 |
| 4   | compileMotionPlan 适配层（现有 recipe 输出 → MotionPlan） | ⚪ 未开始 |

---

## 功能 1 · 富样式字段扩展

**设计思路**

- 痛点①的数据结构侧：设计里有 rotation/斜体/字间距/混合模式等，schema 却没有位置存。先补齐"存得下"，渲染侧（P1）才谈得上"画得出"。
- 全部设为**可选字段**：旧快照缺失这些字段仍然合法，向后兼容，零风险。
- `renderMode` 字段是 P1 混合渲染的开关：`"dom"` 走 CSS 重建（容器/文字，可编辑），`"image"` 走保真切图（图标/复杂矢量）。

**涉及文件 / 数据结构**

- `packages/motion-copilot-core/src/zeroLayerMorph/schema.ts`
  - `ZeroLayerTextStyle` 新增：`letterSpacing?`、`fontStyle?`、`textDecoration?`、`textCase?`
  - `ZeroLayerNode` 新增：`rotation?: number`、`blendMode?: string`、`renderMode?: "dom"|"image"`
  - 渐变已有 `ZeroLayerFill.gradient.css?` 字段，无需改类型，只需 bridge 侧填充（P1-功能1）。

**实现逻辑**

- 纯类型新增，无运行时行为。数据来源已由 Zero MCP 探针验证全部可读（见总揽 §4）。

**变更 / 调试还原**

- [2026-07-13 14:12] 完成。`schema.ts:37-47`（ZeroLayerTextStyle 新增 4 字段）、`schema.ts:58-78`（ZeroLayerNode 新增 rotation/blendMode/renderMode）。全部可选。
- 回滚：删除对应新增行即可，不影响既有逻辑；`git diff packages/motion-copilot-core/src/zeroLayerMorph/schema.ts`。

---

## 功能 2 · normalize 归一化承接

**设计思路**：`normalizeZeroLayerSnapshot` 是所有外部输入的唯一入口与校验闸门；新字段必须在此被安全解析（类型不对则丢弃而非抛错，保持健壮）。

**涉及文件**：`packages/motion-copilot-core/src/zeroLayerMorph/normalizeZeroLayerSnapshot.ts`

- `normalizeTextStyle` 承接 letterSpacing/fontStyle/textDecoration/textCase（枚举校验）。
- `normalizeLayer` 承接 rotation（有限数）/blendMode（字符串）/renderMode（枚举）。

**实现逻辑**：沿用现有 `optionalNumberField` / 枚举白名单模式，缺省安全。

**变更 / 调试还原**

- [2026-07-13 14:12] 完成。`normalizeZeroLayerSnapshot.ts`：`normalizeTextStyle` 承接 letterSpacing(有限数)/fontStyle/textDecoration/textCase（枚举白名单，非法值 push issue 并丢弃）；`normalizeLayer` 承接 rotation(有限数)/blendMode(字符串)/renderMode(枚举)。
- 测试：`test/zeroLayerMorph.test.ts` 新增「normalizes rich-style fields」用例，验证 rotation/blendMode/renderMode + text style 四字段不被丢弃。67 tests 全绿、typecheck 通过。
- 回滚：`git diff packages/motion-copilot-core/src/zeroLayerMorph/normalizeZeroLayerSnapshot.ts`。

---

## 功能 3 · 动效一等数据模型 MotionTrack / MotionPlan

**设计思路**：痛点③的根：动效当前是 spec 确定性推导的临时产物。要让用户"改一层不重算全部"，动效必须成为可持久化、可局部编辑的一等对象。

**计划数据结构**（草案，落地时细化）

```ts
type LayerMotionTrack = {
  layerId: string;
  nodeId: string;
  kind: "morph" | "enter" | "exit" | "emphasis" | "path";
  keyframes: MotionKeyframe[];
  physics?:
    | { type: "spring"; stiffness: number; damping: number }
    | { type: "ease"; curve: [number, number, number, number] };
  path?: { points: Array<{ x: number; y: number }> };
  timing: { delayMs: number; durationMs: number };
  overshoot?: number;
  personality?: { energy: number; bounce: number; sharpness: number };
  source: "llm" | "rule" | "user";
};
type MotionPlan = { tracks: LayerMotionTrack[]; stageDurationMs: number };
```

`ZeroLayerMorphSource` 增加 `motionPlan?: MotionPlan`。

**状态**：⚪ 未开始（依赖 P0-功能1/2 落地后再引入，避免一次改动过大）。

---

## 功能 4 · compileMotionPlan 适配层

**设计思路**：保证旧路径不崩——把现有 recipe/compose 输出转成 `MotionPlan`，让新旧渲染/编辑逻辑统一消费一种数据；`MotionPlan` 缺省时回退现有编译链。

**涉及文件**（计划）：`packages/motion-copilot-core/src/zeroLayerMorph/compileMotionPlan.ts`（新增）

**状态**：⚪ 未开始。

---

## 关联进展 · Recipe 清单化（2026-07-18，本地提交 `7cb79d4`）

`zeroLayerRecipeManifests.ts` 给 recipe 补了结构化元数据(`intent`/`targets`/`restraint`)。它是「差异化编排」的元数据前奏,与 P0 数据地基同源,但**不属于本模块功能 3/4**——`MotionPlan` 动效一等数据模型仍未开工,下一步即从功能 3 起步。详见 [../CHANGELOG.md](../CHANGELOG.md)。

---

_模块最后更新：2026-07-18 (+0800)_
