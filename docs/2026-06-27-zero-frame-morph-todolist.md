# Zero 首尾帧高保真动效生成 Todo

日期：2026-06-27

范围：`apps/motion-copilot` 与 `packages/motion-copilot-core`。对应方案文档：`docs/2026-06-27-zero-frame-morph-plan.md`。

## 当前方向

主路径已从低保真结构重绘改为：

```text
Zero MCP rich context / screenshot / assets
  -> ZeroVisualSnapshot
  -> Web 高保真 VisualStage
  -> VisualTimelineController
  -> 可编辑时间线
  -> 同源 HTML/CSS/JS/assets 导出
```

`FrameSnapshot`、`MorphPlan`、`compileFrameMorphComposition` 保留为 legacy/debug/测试路径，不再作为最终高保真方案。

## 已完成：legacy FrameSnapshot 闭环

以下工作已经完成，但不再代表最终架构：

- [x] `FrameSnapshot` / `FrameElement` / `MorphPlan` 类型。
- [x] `normalizeFrameSnapshot`。
- [x] `matchElements`。
- [x] `compileMorphPlan`。
- [x] `exportMorphJson`。
- [x] `exportMorphHtml`。
- [x] `visualCheck`。
- [x] `compileFrameMorphComposition`。
- [x] `/api/zero/frame-snapshot` legacy bridge。
- [x] app 内「帧间」调试面板。
- [x] 28:19 / 28:2 legacy fixture。

## P7：新契约与阻断规则

目标：防止后续实现继续把 metadata-only 当成高保真数据源。

- [x] 更新方案文档。
  - 验收：明确 `FrameSnapshot` 是 legacy/debug，不是主路径。
  - 验收：明确 Web 端结果层高保真优先。
  - 验收：明确 metadata-only 必须阻断或降级提示。
- [x] 新增 `ZeroVisualSnapshot` 类型。
  - 验收：包含 frameId、nodeId、尺寸、screenshotUrl、html、css、assets、nodes。
  - 验收：`nodes` 保留 `nodeId` 与 bounds。
  - 验收：复杂 group/vector 可以 asset 化。
- [x] 新增 `normalizeZeroVisualSnapshot`。
  - 验收：缺 `screenshotUrl` 失败。
  - 验收：缺 `html/css` 失败。
  - 验收：缺 `data-node-id` 失败。
  - 验收：只有节点树和 bbox 的 metadata-only 输入失败。
- [x] 增加 core 单元测试。
  - 验收：rich snapshot 通过。
  - 验收：metadata-only 输入失败。

## P8：Zero rich bridge

目标：服务端从 Zero MCP 读取高保真材料，并输出 `ZeroVisualSnapshot`。

- [x] 新增 `/api/zero/visual-snapshot`。
  - 验收：请求只需要 `nodeId`。
  - 验收：响应为 `ZeroVisualSnapshot`。
  - 验收：错误信息明确区分 MCP 未配置、metadata-only、asset 缺失。
- [x] 新增 bridge 命令配置。
  - 验收：支持 `ZERO_MCP_VISUAL_COMMAND`。
  - 验收：支持 `ZERO_MCP_VISUAL_ARGS` 中的 `{nodeId}`。
  - 验收：不复用 `ZERO_MCP_SNAPSHOT_COMMAND`，避免低保真和高保真混淆。
- [x] bridge 输出校验。
  - 验收：服务端调用 `normalizeZeroVisualSnapshot`。
  - 验收：metadata-only 输出不能进入 app。
- [x] 新增 `get_design_context/get_design_metadata/get_screenshot -> ZeroVisualSnapshot` 转换器。
  - 验收：解析 Zero MCP 返回的 React/Tailwind 参考代码中的 asset URL。
  - 验收：从 metadata XML 生成完整节点索引和绝对 bounds。
  - 验收：转换出的静态 HTML 保留全部 `data-node-id`。
  - 验收：28:2 真实 MCP context fixture 生成 17 个节点、3 个 asset。
- [x] `/api/zero/visual-snapshot` 支持 raw MCP bundle。
  - 验收：bridge 命令可以输出 `{ nodeId, designContext, designMetadata, screenshot }`，服务端自动转换为 `ZeroVisualSnapshot`。
- [x] 增加 dev fixture bridge。
  - 验收：28:19 / 28:2 可在未连真实 Zero MCP 时跑通高保真 UI。
  - 验收：fixture 必须包含静态 HTML/CSS 和 asset 引用，不再只给 bbox。
- [x] 接入真实 Zero MCP 自动采集命令外壳。
  - 验收：`scripts/zero-mcp-visual-bridge.mjs` 能通过 `ZERO_MCP_HTTP_URL` 调用本机 Zero MCP streamable HTTP endpoint。
  - 验收：已确认当前本机 Zero MCP endpoint 为 `http://127.0.0.1:27618/mcp`。
  - 验收：保留 `{tool}` / `{nodeId}` 外部 MCP-capable 命令模式作为备用。
  - 验收：固定采集 `get_design_context`、`get_design_metadata`、`get_screenshot` 并输出 raw MCP bundle。
  - 验收：支持按工具覆盖参数模板，例如 `ZERO_MCP_TOOL_ARGS_GET_DESIGN_CONTEXT`。
  - 备注：浏览器 app 仍不直接调用 MCP；服务端 bridge 通过本机 HTTP endpoint 或外部命令调用 MCP。

## P9：VisualStage

目标：app 中能高保真显示 Zero 首尾帧。

- [x] 新增 `VisualStage` 组件。
  - 验收：使用 iframe 或 Shadow DOM 隔离样式。
  - 验收：能渲染 `ZeroVisualSnapshot.html/css/assets`。
  - 验收：主应用 CSS 不影响设计稿内容。
- [x] 支持预览模式。
  - 验收：首帧。
  - 验收：尾帧。
  - 验收：叠加。
  - 验收：播放。
- [x] 支持节点拾取。
  - 验收：点击/悬浮能拿到 `data-node-id`。
  - 验收：图层列表能定位到同一节点。
- [x] 禁止截图作为 stage 背景。
  - 验收：截图只用于 QA 对比。
  - 验收：不会出现“所有图层第一秒已显示”的 baked screenshot 问题。

## P10：VisualTimelineController

目标：让时间线控制高保真视觉层，而不是重绘低保真 DOM。

- [x] 新增 `VisualMotionBinding` 生成逻辑。
  - 验收：按 nodeId/name/text/bounds 生成 matched / enter / exit / unresolved。
  - 验收：低置信度进入待确认。
- [x] 新增 playhead controller。
  - 验收：根据时间线 start/duration/easing 驱动节点样式。
  - 验收：enter 节点在开始前隐藏。
  - 验收：exit 节点在结束后隐藏。
  - 验收：matched 节点补间 transform/opacity/size。
- [x] 映射到底部时间线。
  - 验收：每个 binding 生成可选择片段。
  - 验收：用户可改 start、duration、delay、easing。
  - 备注：当前使用高保真控制代理层映射到底部 CompositionTrack；结果层仍由 `VisualStage` iframe 负责高保真渲染，不把 Zero HTML 拆成原生 MotionLayer。

## P11：自然语言动效意图

目标：用户用自然语言描述首尾帧之间的动效，而不是只能点固定预设。

- [x] 新增 `VisualMotionIntent`。
  - 验收：包含 duration/easing/stagger/enter/exit/binding 参数。
- [x] 接入现有底层动效能力。
  - 验收：自然语言能影响时长。
  - 验收：自然语言能影响缓动。
  - 验收：自然语言能影响错峰和进入/退出节奏。
  - 备注：`compileVisualMotionIntent` 结果已进入 `compileVisualMotionComposition`，生成可编辑 CompositionStep。
- [x] UI 文案调整。
  - 验收：主按钮为“从 Zero 读取并生成高保真时间线”。
  - 验收：legacy JSON 导入标为“高级调试：legacy FrameSnapshot JSON（低保真）”。

## P12：导出与视觉验收

目标：最终生成结果在视觉层面完全还原首尾帧，并带有可播放动效。

- [x] 导出同源 HTML。
  - 验收：导出使用和 app 预览相同的 HTML/CSS/assets/runtime。
  - 验收：不重新走 `MotionLayer` 低保真重绘。
  - 备注：带 `visualSource` 的文档会通过 `exportVisualCompositionHtml` 导出 ZeroVisualSnapshot 首尾帧、节点级 CSS animation 和用户已修改的 CompositionTrack 时间窗。
- [x] 增加截图对比。
  - 验收：首帧导出截图对比 Zero 首帧截图。
  - 验收：尾帧导出截图对比 Zero 尾帧截图。
  - 验收：差异超阈值时不能标记为高保真通过。
  - 验收：支持 `--debug-dir` 输出 `from/to actual/expected`，用于定位截图差异。
  - 备注：`node scripts/verify-zero-visual-export.mjs --html <export.html> --from <zero-from.png|url|data-url> --to <zero-to.png|url|data-url>` 会用本机 Chrome/CDP 截取 `.mc-zero-stage`，访问 `?mc-progress=0/1` 做确定性首尾帧对比。
- [x] 修复真机资产加载。
  - 验收：Zero MCP 返回的 `http://localhost:27618/assets/...` 会被改写为 Motion Copilot 同源 `/api/zero/asset?url=...`。
  - 验收：SVG 背景不再因为真机/浏览器上下文不同而丢失。
  - 验收：`get_screenshot` 默认请求 base64，避免短期截图 URL 404 导致 diff 不可用。
- [x] 修复高保真 viewport。
  - 验收：`ZeroVisualSnapshot.width/height` 使用截图视觉尺寸，保留阴影外扩区域。
  - 验收：原始设计内容按 offset 放入视觉 viewport，节点 bounds 同步偏移。
- [x] 修复错误文本配对。
  - 验收：两个 text 节点都有文本且文本不同，不允许仅凭同名/近距离配成 matched。
  - 验收：28:19 的圆点数字不再错误 morph 成 28:2 的状态文字。
- [x] 增加端到端回归。
  - 验收：28:19 -> 28:2 能从 Zero rich fixture 生成时间线。
  - 验收：播放过程中节点按时间线顺序显示。
  - 验收：导出 HTML 可独立播放。
  - 备注：E2E 回归测试已在 `test/frameMorph.test.ts` 中实现，覆盖 fixture 加载→绑定→composition→导出→报告嵌入全链路。
- [ ] 收敛截图像素差异。
  - 当前实测：真实 28:19 -> 28:2 导出端点结构、文字、白色圆角背景已对齐；截图 diff 约 21%。
  - 剩余差异：Zero `get_screenshot` 输出的外圈阴影/描边比 `get_design_context` SVG 资产渲染更黑，二者不是像素等价来源。
  - 下一步：需要通过 Zero MCP 获取更接近截图 renderer 的 asset，或建立可接受的阴影差异阈值/区域豁免；不应盲目给所有 SVG 加重阴影。

## 当前不做

- 不承诺任意 vector path 自动 morph。
- 不做字符级文本 morph。
- 不追求把 Zero 所有节点都转成 Motion Copilot 原生可编辑图层。
- 不在浏览器里直接调用 MCP tool，仍通过本地/服务端 bridge。
- 不再继续给 `FrameSnapshot` 追加样式字段来追求高保真。

## P13：还原评分报告

目标：导入后可立即判断还原质量。

- [x] `RestorationReport` / `RestorationIssue` / `RestorationMetric` 类型。
  - 验收：5 维评分（nodeCoverage/styleCoverage/layerOrderConfidence/matchConfidence/visualRisk）。
  - 验收：每条 issue 含 id、severity、source、category、nodeId、field、title、reason、suggestion。
- [x] `createRestorationReport` 实现。
  - 验收：基于 from/to snapshot + bindings 计算。
  - 验收：error issue 将对应 metric 上限压到 60；warning 压到 85。
  - 验收：inputHash/bindingHash 变化时旧报告标为 stale。
- [x] 质量面板 UI。
  - 验收：issue 分级汇总（error/warning/info）。
  - 验收：点击 issue 定位到 VisualStage 节点。
  - 验收：stale 时提供重算入口。
- [x] `VisualCompositionReportCache` 持久化。
  - 验收：保存在 `VisualCompositionSource.restorationReportCache`。
- [x] 单元测试：SVG 背景缺失、圆角缺失、层级错乱、低置信度匹配。

## P14：对象级图层模型

目标：节点被组织为用户可理解的对象。

- [x] `FrameObjectModel` / `FrameObject` 类型。
  - 验收：kind 含 text/container/asset/button/status-pill/label-group/unknown。
  - 验收：每个对象含 nodeIds、bounds、children、confidence。
- [x] `buildFrameObjectModel` 实现（P0：text/container/asset）。
  - 验收：纯几何规则，不依赖 AI。
  - 验收：1000 节点 <50ms。
  - 验收：命名逻辑避免暴露 "文字 159" 等通用名。
- [x] 对象层面板 UI。
  - 验收：树形展示对象层，badge 标识类型和匹配状态。
  - 验收：点击同步选中 VisualStage 节点。
- [x] "转为可编辑图层" 入口。
  - 验收：仅对安全对象（text、空 container）开放。

## P15：匹配可视化与人工修正

目标：匹配关系可解释可修正。

- [x] `UserBindingOverride` 类型 + 持久化到 `VisualCompositionSource.userBindingOverrides`。
- [x] 绑定列表升级为可编辑列表。
  - 验收：每条显示 badge（matched/enter/exit/待确认）+ confidence + 操作按钮。
  - 验收：支持设为 enter / exit / ignore / matched 操作。
  - 验收：手动匹配流程：exit/unresolved 点击 M 进入配对模式，点选 enter 节点完成。
  - 验收：低置信度高亮显示。
- [x] 修正后自动重跑 composition + 标记报告过期。
- [x] 导出 HTML 可选嵌入 `<script type="application/json" id="motion-report">`。
  - 验收：`exportMorphHtml`（legacy）和 `exportVisualCompositionHtml`（高保真）均支持。

## P16：App 场景 fixture 库

目标：覆盖京东 App 常见交互模式。

- [x] 卡片展开：`card-expand-collapsed.json` / `card-expand-expanded.json`。
- [x] 底部弹层：`bottom-sheet-hidden.json` / `bottom-sheet-visible.json`。
- [x] 列表：`list-3-items.json`。
- [x] 顶部导航切换：`top-nav-tab-a.json` / `top-nav-tab-b.json`。
- [x] 命名规范：`fixtures/frames/README.md`。
