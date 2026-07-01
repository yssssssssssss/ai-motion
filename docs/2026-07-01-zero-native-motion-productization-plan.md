# Zero 原生首尾帧动效产品化开发方案

日期：2026-07-01

范围：`apps/motion-copilot`、`packages/motion-copilot-core`、`scripts/zero-layer-*`。

## 1. 背景

Motion Copilot 当前已经具备 Zero 原生图层帧间链路：用户输入首帧和尾帧 `nodeId`，系统通过 Zero MCP 读取原生图层，生成首尾帧之间的动效，并导出 Zero 原生动效 HTML。

真机测试暴露出三个产品化问题：

- 动效方案差异不明显，当前 3 个方案更像同一套保守 morph 的不同节奏。
- 首尾帧依赖用户手动输入 `nodeId`，门槛高，容易出错。
- 每次动效效果不理想时，都需要人工多轮调整，缺少上线后可复用的自动诊断和调优闭环。

本方案目标不是重新做一套页面，也不是合并低保真、高保真、Zero 原生三条链路，而是在现有 Zero 原生链路上完成产品化增强。

## 2. 目标

### 2.1 用户目标

- 用户不需要理解 `nodeId`，也能选择首帧和尾帧。
- 用户可以从多组差异明显的动效方案中选择，并快速看到结果。
- 用户导出的动效最终帧必须严格还原 Zero 尾帧。
- 用户在真机测试中可以明确感知不同方案的节奏、层次和重点不同。
- 当结果不理想时，系统能给出明确原因，而不是要求用户回到 Codex App 人工调参。

### 2.2 工程目标

- 保持 Motion Copilot 独立模块边界，不影响 `apps/web` 和 `apps/motion-lens`。
- 不新增端口，不新增独立启动命令。
- 不让 LLM 直接生成动画代码；动效执行必须走 deterministic recipe。
- 建立可自动验收的 harness：首帧、过程帧、尾帧都能被采样和判断。
- 所有新增动效方案必须满足 Zero 首尾帧空间约束和尾帧还原约束。

## 3. 非目标

- 不写回 Zero 文件。
- 不自动修改用户的 Zero 稿件。
- 不把低保真、高保真、Zero 原生三套入口合并。
- 不把 Zero 原生图层转成完全可编辑的 MotionLayer。
- 不做任意 vector path morph。
- 不引入新的前端框架、运行时或服务端入口。

## 4. 核心原则

### 4.1 尾帧优先

任何动效方案都必须以 Zero 尾帧为最终真值。`progress=1` 时，导出 HTML 和预览必须严格复原 Zero 尾帧。动效方案不能为了表现力牺牲最终状态。

### 4.2 空间约束

matched 图层只能在首帧 bounds 和尾帧 bounds 形成的空间范围内变化。方案可以改变节奏、错峰、透明度、遮罩和图层顺序感，但不能让 matched 图层越过 Zero 首尾帧定义的空间。

### 4.3 表现力来自编排，不来自越界

后续方案的差异应来自：

- 哪些图层先动。
- 哪些图层后动。
- 容器和内容是否分层。
- enter / exit 是否错峰。
- 是否使用透明度、clip、mask reveal。
- 是否按阅读方向或层级结构编排。

不应通过超出尾帧位置、使用不可控 spring overshoot、或 scale 放大 matched 图层来制造差异。

### 4.4 LLM 只做意图推荐

LLM 可以用于理解用户意图、推荐动效方案、解释诊断报告，但不能直接输出动画代码。最终生成仍然调用内置 recipe 和 harness 门禁。

## 5. 产品流程

推荐用户路径：

```text
打开 Motion Copilot
  ↓
进入 帧间 / Zero 原生
  ↓
选择首帧和尾帧
  ↓
系统读取 Zero 原生图层
  ↓
选择动效方案
  ↓
预览 / 自动诊断
  ↓
导出 Zero 原生动效 HTML
```

高级用户仍可手动输入 `nodeId`，但主路径不应要求用户识别和复制 `nodeId`。

## 6. 首尾帧选择器

### 6.1 输入方式

保留三种输入方式：

- 手动输入 `nodeId`：高级调试入口。
- 候选节点列表：展示 Zero 可选节点，用户点击设为首帧或尾帧。
- 当前选中节点读取：如果运行环境能从 Zero MCP 获取当前选择，则提供一键“设为首帧 / 设为尾帧”。

### 6.2 候选信息

候选节点至少展示：

- 节点名称。
- `nodeId`。
- 节点类型。
- 尺寸。
- 层级路径。
- 缩略预览或首屏截图定位信息。

### 6.3 降级策略

如果 Zero MCP 无法提供当前选中节点：

- 不阻断功能。
- 显示候选节点列表和搜索。
- 保留手动输入。

如果 Zero MCP 只能返回 metadata，不能返回原生图层：

- 阻断 Zero 原生生成。
- 明确提示当前环境无法使用 Zero 原生链路。

## 7. 动效方案扩展

### 7.1 当前状态

当前 Zero 原生方案只有：

- 丝滑形变。
- 弹性展开。
- 状态切换。

它们都受到尾帧和空间约束保护，因此在小位移、小尺寸变化组件上差异较弱。

### 7.2 新增方案方向

新增方案应优先面向手机 app 组件变化：

- 容器优先展开：背景/容器先完成尺寸变化，内容跟随淡入。
- 内容错峰进入：文字、图标、按钮按阅读顺序依次进入。
- 遮罩揭示：内容在自身或容器范围内 reveal。
- 焦点引导：主对象先动，次级对象延后。
- 状态闪切：弱化位移，强调透明度和文案切换。
- 轴向展开：仅沿 X 或 Y 方向展开，适合列表、胶囊、底部栏。
- 列表重排：多个对象按空间关系顺序移动。
- 压缩收纳：退出对象先收敛/淡出，进入对象再补位。

### 7.3 方案分类

每个 recipe 需要标注适用场景：

- 状态变化。
- 容器展开。
- 列表重排。
- 内容替换。
- 导航切换。
- 弹层/底部栏。

UI 中不应只平铺一长串按钮，应支持按场景分组或筛选。

## 8. Harness 自动验收

### 8.1 验收对象

harness 要验证的不是单一分数，而是完整链路：

- Zero MCP 是否成功读取首尾帧。
- 图层匹配是否可靠。
- 动效过程是否越界。
- 最终尾帧是否严格还原。
- 不同 recipe 是否具备可感知差异。
- 导出 HTML 与应用内预览是否一致。

### 8.2 采样点

每个 recipe 至少采样：

- `progress=0`
- `progress=0.25`
- `progress=0.5`
- `progress=0.75`
- `progress=1`

其中 `0` 和 `1` 是硬门禁；中间采样用于检查过程越界和异常可见性。

### 8.3 门禁

硬门禁：

- `progress=0` 必须等于 Zero 首帧。
- `progress=1` 必须等于 Zero 尾帧。
- matched 图层在中间帧不能超出首尾帧 corridor。
- 导出 HTML 和应用内预览使用同一套 recipe 结果。

软门禁：

- 低置信匹配提示。
- enter / exit 图层数量异常提示。
- recipe 差异度不足提示。
- 图层命名弱提示。

### 8.4 差异度判断

新增 recipe 不能只改 label。harness 应比较不同 recipe 的：

- duration 分布。
- step start/end 分布。
- easing 分布。
- enter / exit 透明度节奏。
- 图层错峰顺序。
- 关键中间帧 bbox / opacity 状态。

如果两个 recipe 的中间采样结果高度相似，应提示“方案差异不足”。

## 9. UI 调整

### 9.1 Zero 原生区域

建议结构：

```text
Zero 原生图层
  首帧 [选择节点] [手动输入]
  尾帧 [选择节点] [手动输入]
  [从 Zero 原生图层生成动效]

动效方案
  场景筛选：全部 / 状态 / 展开 / 列表 / 导航 / 弹层
  recipe 卡片

Harness 诊断
  门禁状态
  失败原因
  推荐动作

图层预览
  首帧 / 尾帧

可编辑图层
  matched / enter / exit / unresolved
```

### 9.2 文案要求

- 面向用户的主流程避免暴露过多内部术语。
- `nodeId` 可以存在，但作为高级信息。
- 诊断报告要把技术失败翻译成用户可理解的问题，例如“尾帧未对齐”“过程越界”“匹配不可靠”。

## 10. 数据与接口

### 10.1 现有数据

继续使用：

- `ZeroLayerMorphSource`
- `ZeroLayerSnapshot`
- `ZeroLayerMotionRecipe`
- `CompositionStep`
- `MotionDocument.visualSource.kind === "zero-layer-morph"`

### 10.2 建议新增

可新增轻量结构：

```ts
type ZeroNodeCandidate = {
  nodeId: string;
  name: string;
  kind: string;
  bounds: { x: number; y: number; w: number; h: number };
  path?: string[];
  preview?: string;
};

type ZeroLayerMotionRecipeCategory =
  | "state"
  | "expand"
  | "list"
  | "navigation"
  | "overlay"
  | "content";
```

避免新增复杂全局状态。候选节点可以从现有 snapshot 或 bridge 返回中派生。

## 11. 实施阶段

### Phase 1：首尾帧选择体验

目标：用户不必手动识别 `nodeId`。

交付：

- 候选节点列表。
- 搜索和筛选。
- 设为首帧 / 设为尾帧。
- 保留手动输入作为高级入口。

验收：

- 用户能从列表选择首尾帧并生成 Zero 原生动效。
- 手动输入仍可用。
- 无 Zero 当前选中能力时仍可用候选列表。

### Phase 2：动效方案扩展

目标：提供差异明显、符合手机 app 场景的 recipe。

交付：

- 至少 6 个方案。
- recipe 分类。
- UI 中按场景筛选或分组。
- 每个 recipe 有明确适用说明。

验收：

- 真机上至少能感知 3 类明显不同节奏。
- 所有 recipe 通过尾帧还原和 corridor 门禁。

### Phase 3：Harness 自动验收升级

目标：把多轮人工调参固化为工具内自动验证。

交付：

- recipe 采样诊断。
- corridor 检查。
- 尾帧像素对比。
- recipe 差异度检查。
- UI 诊断摘要。

验收：

- 任意 recipe 失败时能输出原因。
- 导出 HTML 可被同一 harness 验证。
- 真机问题能映射到报告中的风险项。

### Phase 4：产品闭环 polish

目标：让 Zero 原生链路具备可演示、可测试、可上线的完整闭环。

交付：

- 方案选择、预览、诊断、导出串联。
- 错误和降级提示。
- 文案统一。
- 回归测试和手动验收脚本。

验收：

- 用户完成一次首尾帧动效生成不需要离开页面。
- 诊断失败时知道下一步该怎么处理。
- 导出文件在真机上表现和预览一致。

## 12. 验证命令

优先使用模块级命令，避免全仓慢测试：

```bash
pnpm --filter @motion-copilot/core test -- test/zeroLayerMorph.test.ts
pnpm --filter @motion-copilot/app test -- src/App.test.tsx
pnpm --filter @motion-copilot/app typecheck
pnpm --filter @motion-copilot/core typecheck
pnpm --filter @motion-copilot/app build
```

Zero 原生诊断：

```bash
node scripts/zero-layer-diagnose.mjs --fixture --from 28:19 --to 28:2 --pretty
node scripts/verify-zero-visual-export.mjs --html export.html --from from.png --to to.png --threshold 0.04
```

## 13. 风险

- Zero MCP 当前选中节点能力可能不可用：用候选列表降级。
- 某些复杂组件匹配置信度低：不强行套用 recipe，诊断中提示人工确认。
- 过度追求差异会破坏还原：尾帧和 corridor 作为硬门禁。
- screenshot gate 依赖本机 Chrome/CDP：保留 CLI fixture 测试作为基础回归。
- 工作树存在大量历史修改：开发时只触碰 Motion Copilot 和 core Zero 原生相关文件。

## 14. 推荐开发顺序

先做 Phase 1，再做 Phase 2，最后做 Phase 3。原因是首尾帧选择体验直接影响用户能否使用；recipe 扩展依赖当前选择和生成链路；harness 升级用于把 recipe 扩展的质量固化下来。

