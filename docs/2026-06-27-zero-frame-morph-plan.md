# Zero 首尾帧高保真动效生成方案

日期：2026-06-27

范围：`apps/motion-copilot` 与 `packages/motion-copilot-core`。

## 1. 结论

当前 `FrameSnapshot -> MotionLayer -> app 重绘` 路径不能作为最终方案。它能生成可编辑图层和时间线，但视觉还原依赖我们重新解释 Zero 节点，遇到字体、阴影、mask、复杂 vector、图片资源、嵌套 group 时会快速失真。

最终方案改为：

```text
Zero MCP rich context / screenshot / assets
        ↓
ZeroVisualSnapshot
        ↓
Web 端高保真 VisualStage（静态 HTML/CSS/SVG/asset）
        ↓
自然语言动效意图
        ↓
VisualTimelineController 控制关键节点
        ↓
Motion Copilot 时间线与图层绑定
        ↓
导出同一份 HTML/CSS/JS/assets
```

核心原则：

- 结果层高保真优先，不能为了“所有节点都可编辑”牺牲最终视觉。
- `get_design_metadata` 只够做结构索引，不够做高保真渲染。
- 高保真路径必须使用 `get_design_context`、`get_screenshot` 和可用 asset。
- 如果 Zero MCP 只返回 metadata，功能必须明确阻断或降级提示，不能静默生成低保真结果。
- `FrameSnapshot` 保留为 legacy/debug/结构化低保真路径，不再作为主路径。

## 2. 数据契约

### 2.1 ZeroVisualSnapshot

`ZeroVisualSnapshot` 是新主路径的输入契约，承载 Web 端直接渲染所需材料。

```ts
interface ZeroVisualSnapshot {
  schemaVersion: "motion-copilot.zero-visual-snapshot.v1";
  frameId: string;
  nodeId: string;
  name: string;
  width: number;
  height: number;
  screenshotUrl: string;
  html: string;
  css: string;
  assets: ZeroVisualAsset[];
  nodes: ZeroVisualNode[];
}

interface ZeroVisualNode {
  nodeId: string;
  name: string;
  kind: "group" | "rect" | "text" | "vector" | "image";
  bounds: { x: number; y: number; w: number; h: number };
  text?: string;
  assetId?: string;
}
```

要求：

- `html` 必须是静态 HTML，不依赖 React/Tailwind runtime。
- HTML 节点必须保留 `data-node-id`，用于动效绑定和手动选层。
- `css` 必须被作用域隔离，不能污染 Motion Copilot 主应用。
- 复杂 vector/group 优先 asset 化，避免用低保真 div 猜样式。
- `screenshotUrl` 用于首尾帧视觉验收，不作为动画背景。

### 2.2 FrameSnapshot

`FrameSnapshot` 仍保留，但角色变更为：

- 调试数据。
- 单元测试 fixture。
- metadata-only 降级预览。
- 从旧实现迁移时的兼容入口。

它不能再承诺“Web 端完全还原 Zero 设计”。

## 3. Zero MCP Bridge

浏览器 app 仍不直接调用 MCP。服务端 bridge 负责调用 Zero MCP 并输出 `ZeroVisualSnapshot`。

bridge 必须读取：

- `get_design_context`：拿静态结构、样式、文本、asset URL、`data-node-id`。
- `get_screenshot`：拿首尾帧验收截图。
- `get_design_metadata`：只辅助生成节点索引和 bounds。
- `get_variables`：有 token 时读取；没有时不阻断。

当前实现允许 bridge 命令输出两类结果：

- 已经成型的 `ZeroVisualSnapshot`。
- raw MCP bundle：`{ nodeId, designContext, designMetadata, screenshot }`。服务端会调用 converter 将其转成 `ZeroVisualSnapshot`，再进入 normalizer。

bridge 输出不足时的处理：

- 缺 `html`：阻断。
- 缺 `screenshotUrl`：阻断。
- 缺 `data-node-id`：阻断。
- 只有节点树和 bbox：阻断，并提示当前 Zero MCP 返回的是 metadata-only。

## 4. Web 端渲染

新增 `VisualStage`，用于在 Motion Copilot 中高保真显示首尾帧和播放结果。

建议实现：

- 使用 `iframe srcDoc` 或 Shadow DOM 隔离 HTML/CSS。
- 默认优先 `iframe`，隔离更彻底，能减少主应用 CSS 互相污染。
- 在 iframe 内注入受控 runtime，只做 playhead 驱动，不拉远程 JS。
- 图片、SVG、字体资源走 bridge 代理或缓存，导出时一并打包。

显示模式：

- 首帧。
- 尾帧。
- 叠加对比。
- 动画播放。
- 差异检查。

注意：截图只用于 QA 对比，不铺成 stage 背景。否则会再次出现“所有内容第一秒就已经可见”的问题。

## 5. 动效生成

自然语言不再只映射几个固定预设，而是编译为 `VisualMotionIntent`：

```ts
interface VisualMotionIntent {
  durationMs: number;
  easing: EasingSpec;
  staggerMs?: number;
  bindings: VisualMotionBinding[];
  enter?: VisualEnterRule;
  exit?: VisualExitRule;
}
```

节点绑定策略：

- 优先按 `nodeId`。
- 然后按 name/text/bounds 相似度。
- 自动配对低置信度时进入待确认，不静默猜。
- 用户可以在 UI 中手动指定首尾节点关系。

可动属性：

- transform：x/y/scale/rotate。
- opacity。
- width/height。
- clip-path 或 mask reveal。
- asset/group 的整体 transform。

不做：

- 任意 vector path 自动 morph。
- 字符级文本 morph。
- 自动还原所有设计节点为可编辑 MotionLayer。

## 6. 时间线与图层映射

Motion Copilot 需要显示用户可调的时间线，但时间线不再代表“所有视觉节点都是 app 原生图层”。

新的映射方式：

- 每个关键 Zero 节点生成一个 timeline binding。
- 图层面板显示 `nodeId/name/source`，source 可能是 `html-node`、`svg-asset`、`png-asset`、`group-asset`。
- 用户可调开始时间、时长、缓动、延迟、进入/退出规则。
- playhead 驱动 `VisualTimelineController`，直接控制 iframe/Shadow DOM 内节点。

当前落地方式：高保真路径会生成 `CompositionStep` 和透明控制代理层，用于底部时间线选择、拖拽和参数编辑；最终视觉仍由 `VisualStage` 使用 ZeroVisualSnapshot 的 HTML/CSS/assets 渲染。

这能保留手动可调能力，同时不牺牲结果层还原。

## 7. 导出

导出结果必须和 Web 端预览使用同一套视觉层：

```text
ZeroVisualSnapshot HTML/CSS/assets
        +
VisualTimelineController runtime
        +
用户调整后的 timeline bindings
```

导出物：

- `index.html`
- `assets/*`
- 内联或同目录 `motion-runtime.js`
- 可选 `motion-plan.json`

当前落地方式：`MotionDocument.visualSource` 保存 ZeroVisualSnapshot 首尾帧与绑定结果；当导出组合 HTML 时，若存在 `visualSource`，会走 `exportVisualCompositionHtml`，直接复用 Zero 的 HTML/CSS/assets，并按底部 `CompositionTrack` 生成节点级 CSS animation。

验收标准：

- 导出首帧截图与 Zero 首帧截图进行像素对比。
- 导出尾帧截图与 Zero 尾帧截图进行像素对比。
- 差异超阈值时不能标记为高保真通过。

## 8. UI 调整

保留现有右侧「帧间」入口，但主流程改为高保真 Zero 流程：

```text
[Zero 首尾帧]
起始 nodeId [28:19]    结束 nodeId [28:2]
动效描述 [胶囊丝滑展开，状态文字错峰淡入，略带弹性]
[从 Zero 读取并生成高保真时间线]

[预览] 首帧 / 尾帧 / 叠加 / 播放 / 差异
[绑定] matched / enter / exit / 待确认
[时间线] 每个绑定可调 start / duration / easing / delay
[导出] 高保真 HTML / motion-plan.json
```

高级调试区保留 JSON 导入，但标题必须明确为：

```text
高级调试：导入 legacy FrameSnapshot JSON（低保真）
```

## 9. 与当前实现的关系

已实现的 P0-P6 不是废弃代码，但要重新定位：

- `FrameSnapshot`：legacy/debug。
- `compileFrameMorphComposition`：低保真结构化时间线生成器。
- 现有 frame morph 面板：过渡期 UI，可复用 nodeId 输入、自然语言输入和时间线编辑区域。
- 现有截图背景、猜测 vector 背景、DOM 重绘 Zero：不再作为高保真路径。

后续新增高保真实现时，不应该继续扩展 `FrameSnapshot` 去追样式字段。那条路会越来越脆。

## 10. 分阶段落地

### P7：新契约与阻断规则

- 新增 `ZeroVisualSnapshot` 类型。
- 新增 normalizer。
- metadata-only 输入阻断。
- 更新方案和 Todo。

### P8：Zero rich bridge

- 新增 `/api/zero/visual-snapshot`。
- bridge 调用 `get_design_context`、`get_design_metadata`、`get_screenshot`、asset 收集。
- 输出 `ZeroVisualSnapshot`。
- 真实 MCP 采集通过 `scripts/zero-mcp-visual-bridge.mjs` 接本机 Zero MCP HTTP endpoint。当前本机已验证 endpoint 为 `http://127.0.0.1:27618/mcp`：

```bash
ZERO_MCP_HTTP_URL=http://127.0.0.1:27618/mcp \
ZERO_MCP_VISUAL_COMMAND=node \
ZERO_MCP_VISUAL_ARGS='scripts/zero-mcp-visual-bridge.mjs --node-id {nodeId}' \
pnpm motion-copilot:dev
```

- 如果某些环境没有暴露 HTTP MCP endpoint，也可以退回外部 MCP-capable 命令模式：

```bash
ZERO_MCP_TOOL_COMMAND=/path/to/mcp-client \
ZERO_MCP_TOOL_ARGS='zero_design {tool} --node-id {nodeId}' \
ZERO_MCP_TOOL_ARGS_GET_DESIGN_CONTEXT='zero_design get_design_context --node-id {nodeId} --force-code true' \
ZERO_MCP_VISUAL_COMMAND=node \
ZERO_MCP_VISUAL_ARGS='scripts/zero-mcp-visual-bridge.mjs --node-id {nodeId}' \
pnpm motion-copilot:dev
```

说明：项目运行时不直接拥有 Codex 会话里的 `mcp__zero_design` 工具；浏览器也不直接调用 MCP。服务端 bridge 负责读取本机 HTTP MCP endpoint 或外部命令输出，并转换为稳定的 `ZeroVisualSnapshot` 契约。

### P9：VisualStage

- iframe/Shadow DOM 渲染 `ZeroVisualSnapshot`。
- 支持首帧、尾帧、叠加、播放。
- 保留 `data-node-id` 选层。

### P10：VisualTimelineController

- 生成 bindings。
- playhead 驱动 DOM/asset 节点。
- enter/exit 严格按时间窗显示。

### P11：自然语言动效意图

- 将动效描述编译为 duration/easing/stagger/enter/exit/binding 参数。
- 不能再只有几个固定按钮。

### P12：导出与视觉验收

- 导出同源 HTML/CSS/JS/assets。
- Chrome/CDP 截图对比 Zero 首尾帧。
- 差异超阈值阻断高保真通过。
- 导出 HTML 支持 `?mc-progress=0|1`，用于确定性截取首帧/尾帧。
- 验收命令：

```bash
pnpm verify:zero-visual-export -- \
  --html path/to/export.html \
  --from path/or/url/to/zero-from.png \
  --to path/or/url/to/zero-to.png \
  --threshold 0.04
```

## 11. 当前案例基线

验证节点：

- 展开态：`28:2`，`信息展开状态`。
- 收起态：`28:19`，`信息收起状态`。

该案例只作为回归样例。实现不能写死节点 ID。
