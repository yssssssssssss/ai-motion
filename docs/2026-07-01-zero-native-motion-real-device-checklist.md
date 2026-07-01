# Zero 原生动效真机测试 Checklist

日期：2026-07-01

范围：Motion Copilot 的「帧间动效 / Zero 原生」链路。

## 基线案例

- 首帧：`28:19`
- 尾帧：`28:2`

该案例只作为回归样例，不代表功能只支持这两个节点。

## 测试前准备

- 启动 Motion Copilot。
- 确认 Zero MCP 环境可读取真实图层。
- 打开「帧间动效」里的「Zero 原生」模式。
- 如使用 fixture，应明确标记为非真机真实 Zero 数据。

## 1. 首尾帧选择

- 读取首尾帧后，检查「首尾帧候选节点」是否出现。
- 搜索节点名称、`nodeId`、类型，确认候选列表会过滤。
- 点击候选节点，确认可以设为首帧或尾帧。
- 手动输入 `nodeId` 仍可生成动效。

通过标准：

- 用户不需要先去 Zero 里复制 `nodeId`，也能完成选择。
- 候选节点不会包含隐藏节点或零尺寸节点。

## 2. 动效方案切换

逐一测试以下方案：

- 丝滑形变。
- 弹性展开。
- 状态切换。
- 容器优先。
- 内容错峰。
- 遮罩揭示。
- 焦点引导。
- 轴向展开。
- 列表重排。

通过标准：

- 至少能感知三类不同节奏：整体平滑、容器优先、内容错峰。
- 切换方案后，预览和下载内容使用当前方案。
- 「方案采样」不出现 error。

## 3. 尾帧还原

- 播放到结束。
- 对比 Zero 尾帧。
- 下载 Zero 原生动效 HTML 后在真机打开，再次对比尾帧。

通过标准：

- 最终状态与 Zero 尾帧一致。
- matched 图层没有停在错误位置。
- 背景、文字、胶囊、专有尾帧元素都处于尾帧状态。

## 4. 过程空间约束

观察动效过程中：

- 图层是否超出首尾帧定义的运动范围。
- 胶囊、背景、文字是否出现明显越界。
- 进入/退出层是否遮挡 matched 子层。

通过标准：

- matched 图层不超过首尾帧 corridor。
- 如果诊断报告有 warning，应能解释为什么降级。

## 5. 导出 HTML

- 点击「下载 Zero 原生动效 HTML」。
- 在真机浏览器打开导出的 HTML。
- 检查首帧、播放过程、尾帧。

通过标准：

- 真机效果与应用内预览一致。
- 结束状态严格复原尾帧。
- 没有明显闪烁、残影、错层。

## 6. 诊断与降级

- 检查「Harness 诊断」。
- 检查「方案采样」。
- 如出现 warning/error，确认文案能说明原因。

通过标准：

- warning 不阻断生成，但能说明风险。
- error 应视为不可发布。
- 低置信匹配会显示可理解的提示，不静默失败。

## 常用命令

```bash
node scripts/zero-layer-diagnose.mjs --fixture --from 28:19 --to 28:2 --pretty
node scripts/zero-layer-diagnose.mjs --fixture --from 28:19 --to 28:2 --recipe-samples --pretty
node scripts/zero-layer-diagnose.mjs --fixture --from 28:19 --to 28:2 --recipe-samples --recipe smooth-morph --pretty
node scripts/zero-layer-diagnose.mjs --fixture --from 28:19 --to 28:2 --recipe-samples --recipe smooth-morph,smooth-morph --fail-on recipe-diff
```

