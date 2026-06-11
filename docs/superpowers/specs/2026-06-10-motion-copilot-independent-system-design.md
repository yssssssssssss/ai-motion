# 2026-06-10 · MotionCopilot 独立动效创作系统设计

## 背景

当前项目已有一套以 `MotionManifest`、`MotionRecipe`、`motionSkill` 和组件库为核心的动效编辑体系。新目标不是在旧体系上增加入口，而是重新搭建一套独立系统，用统一的创作数据模型驱动自然语言、参数面板、画布预览、规范建议和导出。

新系统可以和当前仓库共存，但必须保持概念和代码边界清晰，避免新旧模型互相污染。

外部参考：

- Gemini 产出的 MotionCopilot PRD 与 HTML demo。
- JoySpace 文档「动效设计规范系统（ing~）」。

JoySpace 文档提供的是动效决策规则，不是可直接消费的参数库。它应进入新系统的 `guideline-engine`，作为建议型动效教练，而不是硬门禁。

## 产品定位

MotionCopilot 是一套独立的页面动效创作系统，面向设计师、前端工程师和具备动效意图但不熟悉参数的产品/运营角色。

第一版目标是跑通：

```text
自然语言或参数选择
  -> MotionDocument
  -> 实时画布预览
  -> 参数面板微调
  -> 规范建议提示
  -> HTML/CSS 导出
```

新系统不以旧项目的组件库和 manifest 为中心。它的唯一数据源是 `MotionDocument`。

## 核心决策

- 新建独立 app：`apps/motion-copilot`。
- 新建独立 core：`packages/motion-copilot-core`。
- 第一版不 import `@motion-tool/core`。
- 第一版不使用 `MotionManifest`。
- 第一版不使用 `MotionRecipe`。
- 第一版不使用 `motionSkill`。
- 可以复用仓库级工程设施：pnpm、TypeScript、ESLint、Vite、React。
- 第一版只支持单元素、单段动画、单触发器。
- 第一版目标对象只支持 `Modal`、`Toast`、`Button`。
- 第一版规范建议为建议型，不阻断生成和导出。
- 第一版导出 HTML/CSS；React 片段延后。

## 非目标

- 不迁移旧系统。
- 不兼容旧 manifest。
- 不做 Figma/VLM 看图生成。
- 不做复杂多轨时间轴。
- 不做 Lottie、Vue、React 多端导出。
- 不做用户账号、偏好学习或云端项目管理。
- 不把 AI 输出作为可信源码直接执行。
- 不让规范系统阻断用户创作。

## MVP 用户流程

### 1. 从描述创建

```text
用户输入「做一个中型弹窗，Q 弹一点出现」
  -> intent-compiler 识别 role=modal、size=medium、effect=springy、direction=enter
  -> 生成 MotionDocument
  -> 画布自动播放
  -> 右侧参数面板展示可编辑参数
  -> guideline-engine 给出建议
```

### 2. 从风格 Token 创建

左侧提供少量风格 token：

- 克制
- 快速
- Q 弹
- 丝滑
- 强表现

点击 token 只生成 schema patch，不直接改 DOM 或源码。

### 3. 参数面板反向修改

用户在右侧修改 `durationMs`、`easing`、`scale`、`y`、`opacity` 后：

```text
参数面板
  -> MotionDocument patch
  -> preview-runtime 重播或 seek
  -> guideline-engine 重新计算建议
```

### 4. 规范建议

规范建议不阻断操作。它提供解释和一键优化。

右侧是主阵地，展示完整建议：

```text
规范建议
- 时长偏慢：建议 280ms
  原因：中型组件建议 200ms 到 300ms。
  [应用建议] [忽略]
```

画布只显示轻提示：

```text
时长偏慢
曲线过弹
```

点击画布提示后，右侧滚动到对应建议。

## 信息架构

```text
apps/motion-copilot/
  src/
    App.tsx
    features/
      prompt/
      canvas/
      inspector/
      guideline-coach/
      export/

packages/motion-copilot-core/
  src/
    schema/
    intent/
    guideline/
    runtime/
    export/
```

## MotionDocument

`MotionDocument` 是新系统唯一 source of truth。

```ts
export type MotionDocument = {
  version: "0.1";
  stage: StageSpec;
  elements: MotionElement[];
  timeline: MotionTimeline;
  guidelineSuggestions: GuidelineSuggestion[];
};
```

### StageSpec

```ts
export type StageSpec = {
  width: number;
  height: number;
  background: string;
};
```

### MotionElement

```ts
export type MotionElement = {
  id: string;
  name: string;
  role: "modal" | "toast" | "button";
  size: "small" | "medium" | "large";
  initial: MotionState;
  animate: MotionState;
};
```

第一版 role 约束：

- `modal`：入场 / 退出，核心属性为 `scale`、`opacity`、`y`。
- `toast`：出现 / 消失，核心属性为 `y`、`opacity`。
- `button`：点击反馈，核心属性为 `scale`。

### MotionState

```ts
export type MotionState = {
  x?: number;
  y?: number;
  scale?: number;
  opacity?: number;
  blur?: number;
  rotate?: number;
};
```

第一版 UI 只暴露：

- `y`
- `scale`
- `opacity`
- `blur`

`x` 和 `rotate` 先保留在 schema 中，但不默认出现在面板里。

### MotionTimeline

```ts
export type MotionTimeline = {
  trigger: "load" | "click" | "hover";
  direction: "enter" | "exit-final" | "move-inside" | "exit-temporary";
  durationMs: number;
  delayMs: number;
  easing: EasingSpec;
  repeat: "none" | "loop";
};
```

第一版 `repeat` 固定为 `none`。保留字段是为了导出和后续循环动效扩展，不在 UI 中提供循环编辑。

### EasingSpec

```ts
export type EasingSpec =
  | { type: "classic"; preset: "decelerate" | "accelerate" | "standard" | "sharp"; css: string }
  | { type: "spring"; stiffness: number; damping: number; mass: number; cssFallback: string };
```

第一版 preview-runtime 使用 CSS cubic-bezier 或 Web Animations API。Spring 不做真实物理求解，先以 spring intent + cssFallback 表示，避免引入复杂运行时。

## Guideline Coach

Guideline Coach 基于 JoySpace 动效规范，提供建议，不提供硬拦截。

```ts
export type GuidelineSuggestion = {
  id: string;
  target: {
    elementId?: string;
    field: string;
  };
  severity: "info" | "suggestion" | "warning";
  title: string;
  reason: string;
  suggestedPatch?: MotionDocumentPatch;
  status: "open" | "applied" | "ignored";
};
```

### 规范来源规则

#### 场景分类

JoySpace 文档把核心动效拆成四类：

```ts
export type MotionScene = "transition" | "loading" | "feedback" | "sequence";
```

第一版映射：

- `modal enter/exit` -> `transition`
- `toast enter/exit` -> `feedback`
- `button click` -> `feedback`

#### 缓动策略

物理弹簧用于强调手感：

- 手势交互
- 拖拽释放
- 按钮按压
- 明确的反馈动作

经典缓动用于效率优先：

- 元素进出场
- 界面层级切换
- 背景变化
- 非焦点状态切换

#### 经典缓动四姿态

```text
enter           -> decelerate  初快后慢
exit-final      -> accelerate  初慢后快
move-inside     -> standard    慢快慢
exit-temporary  -> sharp       快速退场
```

#### 时长分层

```text
small   -> 100ms 到 200ms
medium  -> 200ms 到 300ms
large   -> 300ms 到 400ms
```

#### 面积法则

物体越大，时长越长。Guideline Coach 应基于 `MotionElement.size` 判断推荐时长。

#### 进出场法则

进场出现需要被感知，离场退出应减少干扰：

```text
enter duration > exit duration
```

#### 回弹判定

不是所有动效都需要回弹。

默认允许回弹：

- `button` 点击反馈
- 明确的手势/按压反馈
- 小型强调反馈

默认不建议回弹：

- `toast` 消失
- 页面或弹窗最终关闭
- opacity-only 动画
- 大面积容器转场

## Guideline Engine API

```ts
export function evaluateGuidelines(document: MotionDocument): GuidelineSuggestion[];
```

建议规则第一版：

- 时长低于 size 推荐下限：提示「过快，可能感知不到状态变化」。
- 时长高于 size 推荐上限：提示「偏慢，可能削弱响应感」。
- `exit-final` 时长大于同 size 推荐中值：建议缩短。
- `button click` 未使用 spring intent：提示可增强反馈。
- `toast exit-final` 使用 spring：提示回弹不适合临时提示退出。
- `opacity-only` 使用 spring：提示回弹无明显视觉收益。
- `large` 元素使用高弹性 spring：提示大面积回弹可能造成视觉噪点。

## Intent Compiler

第一版只做确定性语义映射，不做自由模型生成。

```ts
export function compileIntent(input: {
  prompt: string;
  base?: MotionDocument;
}): MotionDocumentPatch;
```

关键词映射：

- `弹`、`Q弹`、`活泼` -> spring intent。
- `丝滑`、`高级`、`克制` -> classic decelerate / standard。
- `快`、`利落` -> 缩短 duration。
- `慢`、`舒缓` -> 增加 duration。
- `弹窗` -> modal。
- `提示`、`Toast` -> toast。
- `按钮`、`点击` -> button + click trigger。

模型接入可以后置。即使接入模型，也只能输出 `MotionDocumentPatch`，不能输出可执行源码。

## Preview Runtime

第一版 runtime 使用 DOM + Web Animations API 或 CSS Animation。运行时输入是 `MotionDocument`，不是 HTML 字符串。

必须支持：

- play
- replay
- pause
- seek
- reset

第一版只需要一个可视元素。

## Inspector

右侧参数面板分为三块：

1. 目标对象
   - role
   - size
   - trigger
   - direction

2. 动效参数
   - duration
   - delay
   - easing preset
   - scale
   - y
   - opacity
   - blur

3. 规范建议
   - 建议列表
   - 应用建议
   - 忽略建议

## Canvas

中间画布提供：

- 目标对象预览
- 播放按钮
- 重播按钮
- seek slider
- 轻提示 chips

画布不展示长解释文案，避免干扰观察动效。

## Export

第一版只导出：

- HTML
- CSS

导出由 `MotionDocument` 编译，不能读取 DOM 反推。

```ts
export function exportHtmlCss(document: MotionDocument): {
  html: string;
  css: string;
};
```

导出要求：

- 不含外部网络依赖。
- 不含 `eval`。
- 不含 `fetch`。
- 不读 cookie/localStorage。
- 包含 reduced-motion fallback。

## 验收标准

- 新 app 可独立启动。
- 新 core 不依赖 `@motion-tool/core`。
- 用户可在 Modal / Toast / Button 中选择一种对象。
- 用户可输入简单自然语言生成首个 `MotionDocument`。
- 参数面板修改后，画布实时更新。
- Guideline Coach 能对时长、缓动、回弹给出建议。
- 用户可忽略建议。
- 用户可应用建议，schema 被 patch。
- 画布显示轻提示，右侧显示完整建议。
- 可导出 HTML/CSS。
- 导出的 HTML/CSS 可独立打开预览。

## 测试策略

Core tests：

- `createDefaultDocument()` 输出合法 schema。
- `compileIntent()` 能识别 modal/toast/button。
- `compileIntent()` 能识别 Q 弹、快速、丝滑。
- `evaluateGuidelines()` 对 size duration 范围给出建议。
- `evaluateGuidelines()` 不阻断导出。
- `exportHtmlCss()` 不输出外部依赖和危险 API。

Web tests：

- 首屏出现三栏工作台。
- 左侧 prompt 能生成文档。
- 右侧参数修改后画布文案/样式更新。
- 规范建议可应用和忽略。
- 导出面板展示 HTML/CSS。

## 分阶段路线

### Phase 1：独立 MVP

- 新建 app 和 core。
- 实现 MotionDocument schema。
- 实现 Modal / Toast / Button 默认文档。
- 实现确定性 intent compiler。
- 实现 guideline engine。
- 实现画布预览和参数面板。
- 实现 HTML/CSS 导出。

### Phase 2：AI Patch

- 接入结构化模型输出。
- 模型只输出 `MotionDocumentPatch`。
- 增加 patch 校验和解释。
- 增加更多风格 token。

### Phase 3：时间轴

- 支持多元素。
- 支持 stagger。
- 支持多段 timeline。
- 支持关键帧列表编辑。

### Phase 4：多端导出

- React 片段导出。
- 动效 token JSON 导出。
- 可选团队规范包。

