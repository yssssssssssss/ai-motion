# P1 · 混合渲染模块

> 上级总揽：[../README.md](../README.md)
> 目标：让预览区高保真还原设计稿——bridge 提取富样式+切图，渲染层全量还原，图标/矢量走保真切图。
> 状态：⚪ 未开始（P0-功能1/2 落地后紧接）

## 模块目标

痛点①的渲染侧。当前预览用"简化 CSS div 树"重建设计稿，凡 CSS 子集表达不了的属性全丢。P1 走"混合渲染"：容器/文字用 DOM（保留可编辑与清晰），图标/复杂矢量用 Zero 侧 `exportAsync` 保真切图。同时把 bridge 提取脚本从"取子集"改为"取全量"。

## 规划的功能清单

| #   | 功能                                                                                     | 状态      |
| --- | ---------------------------------------------------------------------------------------- | --------- |
| 1   | bridge 提取补富样式（rotation/blendMode/letterSpacing/fontStyle/textDecoration/渐变CSS） | ⚪ 未开始 |
| 2   | bridge 切图导出（exportAsync 填充 assets，矢量优先 SVG）                                 | ⚪ 未开始 |
| 3   | 渲染层全量 fills 合成（不再只取 fills[0]）                                               | ⚪ 未开始 |
| 4   | 渲染层 rotation + 文字富样式（letterSpacing/fontStyle/textDecoration）                   | ⚪ 未开始 |
| 5   | renderMode 混合分流（DOM vs SVG 切图）                                                   | ⚪ 未开始 |

---

## 功能 1 · bridge 提取补富样式

**设计思路**：数据源头一处改，同时喂养 schema 与渲染。当前 `layerScript` 主动只取子集，导致渐变丢 stops、rotation/字间距等完全没提。
**涉及文件**：`scripts/zero-mcp-layer-bridge.mjs` 的 `layerScript`（`:216-387`）

- `fillsFor`：渐变分支合成完整 CSS（linear/radial + gradientStops + gradientTransform 推角度）填入 `css`。
- `textStyleFor`：补 `letterSpacing`（PIXELS→px）、`fontStyle`（fontName.style 含 Italic 判定）、`textDecoration`、`textCase`。
- `layerFor`：补 `rotation`（弧度→度）、`blendMode`（非 PASS_THROUGH/NORMAL 时映射 CSS mix-blend-mode）。
  **状态**：⚪ 未开始。

## 功能 2 · bridge 切图导出

**设计思路**：P1 命脉。探针已证 `exportAsync` 全节点可用。对 vector/image/boolean/复杂 group 调 `exportAsync({format:"SVG_STRING"})`（矢量）或 PNG（位图），产物填入当前为空的 `assets[]`，并给对应 node 打 `renderMode:"image"` + `assetId`。
**涉及文件**：`scripts/zero-mcp-layer-bridge.mjs`（`layerScript` + `assets` 组装）；SVG 字符串可 base64 内联为 data-url，省去代理。
**状态**：⚪ 未开始。

## 功能 3 · 渲染层全量 fills 合成

**设计思路**：`fillCss` 只取 `fills[0]` 是丢样式主因之一。改为把多个 fill 按 CSS `background` 多层语法合成（顶层在前）。
**涉及文件**：`packages/motion-copilot-core/src/zeroLayerMorph/exportZeroLayerCompositionHtml.ts` 的 `fillCss`（`:58`）
**状态**：⚪ 未开始。

## 功能 4 · 渲染层 rotation + 文字富样式

**设计思路**：静态帧还原需在 `layerStyle` 输出 `transform:rotate()`、`letter-spacing`、`font-style`、`text-decoration`。注意与动效 transform 的叠加关系（matched 图层动效期 transform 由 keyframe 接管，静态 from/to 帧用 layerStyle）。
**涉及文件**：`exportZeroLayerCompositionHtml.ts` 的 `layerStyle`（`:134`）
**状态**：⚪ 未开始。

## 功能 5 · renderMode 混合分流

**设计思路**：`renderMode:"image"` 的 node 直接渲染切图 `<img>`（SVG/PNG），不再尝试 CSS 重建；其余走 DOM。这是"混合"的落点。
**涉及文件**：`exportZeroLayerCompositionHtml.ts` 的 `renderZeroLayerSnapshotHtml`（`:162`）
**状态**：⚪ 未开始。

---

_模块最后更新：2026-07-13 13:56 (+0800)_
