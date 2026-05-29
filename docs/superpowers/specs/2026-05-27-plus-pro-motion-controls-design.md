# 2026-05-27 · Plus / Pro 动效参数控制设计

## 背景

当前编辑器已经能把 `MotionManifest.params` 中的 confirmed 参数直接渲染成控件，并通过 `MotionPatch.values` 写回 CSS variable、CSS property、HTML 文本或属性。这个模型适合 Pro 用户，但对小白用户暴露了过多工程参数，例如 `midX`、`endY`、`transitionDuration`、`dimOpacity`、`startDelay` 等。

用户真正想表达的通常不是“把 `midY` 改到 420px”，而是“轨迹更上扬一点”“速度更快”“进场更柔和”“整体更克制”。因此需要在现有底层参数之上增加 Plus 模式：用少量意图级控制项生成底层 patch；Pro 模式保持当前完整参数能力。

## 目标

- 让默认编辑体验更直观：小白用户优先看到“速度、轨迹、进出效果、动效强度、节奏”等控制项。
- 保持结果正确：Plus 控制只能映射到组件真实存在且可安全修改的底层参数。
- 保留专业能力：Pro 模式继续展示当前完整参数列表。
- 保持架构简单：不重写 patch 应用链路，Plus 只编译成现有 `MotionPatch.values`。

## 非目标

- 不做通用 AI 自动改任意动画代码。
- 不尝试从任意 Pro 参数组合完美反推 Plus 状态。
- 不在第一阶段做可视化贝塞尔曲线编辑器。
- 不强行给所有组件展示同一套 Plus 控制。

## 竞品参考

- Rive 通过 runtime/state machine inputs 暴露少量 number、boolean、trigger 等控制，而不是让调用方直接操作所有底层动画属性。参考：Rive Parameters 与 state machine input API。
- Framer 把 transition 抽象成 `linear / easeIn / easeOut / easeInOut / spring`、duration、bounce 等少量控制，并允许高级曲线编辑。
- LottieFiles Editor 面向普通编辑者时主要暴露颜色、文字、图片、播放速度、背景等可理解控制项；更复杂的路径和曲线编辑放在专业工具层。

这些模式的共同点是：普通用户调“意图”，专业用户调“参数”。

## 产品形态

编辑器右侧参数面板顶部提供模式切换：

- `Plus`：默认模式，展示少量高层控制项。
- `Pro`：展示当前完整参数分组和原始控件。

Plus 模式采用“选项 + 滑杆”的混合形态。每个控制项先给可理解的风格选项，再给一个小范围微调滑杆。

### Plus 控制项

#### 速度

- 选项：慢 / 标准 / 快
- 滑杆：速度感 `0-100`
- 映射目标：
  - `duration`
  - `transitionDuration`
  - `cycleDuration`
  - `animationDuration`
- 映射原则：
  - 速度主要改主时长参数。
  - `startDelay`、`delay` 属于节奏，不应被速度控制大幅修改。
  - 数值必须 clamp 到原参数 constraints 范围内。

#### 进出效果

- 选项：柔和 / 利落 / 弹性 / 快入慢出 / 慢入快出
- 滑杆：曲线强度 `0-100`
- 映射目标：
  - `easing`
  - `ease`
  - select 类型且 options 里包含 ease/spring/cubic-bezier 相关值的参数
- 映射原则：
  - 第一阶段只输出预设 easing 字符串。
  - 若底层没有 easing 参数，则不显示该控制项。

#### 动效强度

- 选项：克制 / 标准 / 强表现
- 滑杆：表现强度 `0-100`
- 映射目标：
  - `scale`
  - `opacity`
  - `dimOpacity`
  - `blur`
  - `glow`
  - `distance`
  - `slideDistance`
- 映射原则：
  - 只改能明确归类为“幅度/表现强度”的参数。
  - 不能把布局尺寸参数误判为动效强度，例如 `popupWidth`、`endWidth`、`endHeight` 第一阶段不纳入。

#### 轨迹

- 选项：直线 / 弧线 / 上扬 / 下沉 / 横向滑动 / 放大进入
- 滑杆：轨迹幅度 `0-100`
- 映射目标：
  - `midX`
  - `midY`
  - `endX`
  - `endY`
  - `enterDistance`
  - `exitDistance`
  - `slideDistance`
- 映射原则：
  - 轨迹最容易因组件语义不同产生错误，第一阶段可以只做能力识别和 UI 占位，不默认开启。
  - 第二阶段再对内置组件逐个添加明确映射。

#### 节奏

- 选项：立即开始 / 略停顿 / 有仪式感
- 滑杆：停顿感 `0-100`
- 映射目标：
  - `startDelay`
  - `delay`
  - `loopDelay`
  - `repeatDelay`
- 映射原则：
  - 只影响起始或循环间隔。
  - 不影响主 duration。

## 技术设计

### 数据模型

新增意图级控制定义，独立于 `MotionParam`：

```ts
export type PlusControlKind = "speed" | "easing" | "intensity" | "trajectory" | "rhythm";

export type PlusControlOption = {
  id: string;
  label: string;
  value: string;
};

export type PlusControl = {
  id: PlusControlKind;
  label: string;
  options: PlusControlOption[];
  defaultOption: string;
  sliderLabel: string;
  defaultAmount: number;
  confidence: number;
  mappedParamIds: string[];
};

export type PlusControlValue = {
  option: string;
  amount: number;
};

export type PlusPatch = Record<PlusControlKind, PlusControlValue>;
```

`MotionParam` 仍然是底层真实来源。Plus 层只保存用户选择，并通过 compiler 转成 `MotionPatch.values`。

### 能力识别

新增 `derivePlusControls(manifest)`：

- 输入：`MotionManifest`
- 输出：当前组件可展示的 `PlusControl[]`
- 规则：
  - 扫描 confirmed 参数。
  - 按 id、label、type、constraints、group 归类。
  - 每个控制项必须至少有 1 个高置信度映射参数。
  - 置信度低于阈值时隐藏该控制项。

第一阶段推荐阈值：

- 速度：0.8
- 进出效果：0.8
- 动效强度：0.7
- 节奏：0.7
- 轨迹：0.9，且默认不开启通用规则

### 编译器

新增 `compilePlusPatch({ manifest, plusValues, basePatch })`：

- 输入：
  - `manifest`
  - 当前 Plus 控制值
  - 当前底层 patch
- 输出：新的 `MotionPatch.values`

编译原则：

- 所有结果必须经过 constraints clamp。
- 只写入 mappedParamIds，不能碰不相关参数。
- 对没有 mapping 的控制项直接忽略。
- 编译结果要可解释，用于 UI 展示“已影响：转场速度、缓动曲线”。

### Plus 与 Pro 同步

- Plus 修改后：生成底层 patch，Pro 面板能看到对应参数变化。
- Pro 修改后：不要求精确反推 Plus。若 Pro 改动覆盖了 Plus 管辖参数，Plus 控制项显示“已自定义”状态。
- 重置默认值：同时清空 PlusPatch 和 MotionPatch，回到 manifest defaults。

### UI 组件边界

建议新增文件：

- `packages/core/src/orchestrator/plusControls.ts`
  - 负责 Plus 控制能力识别、映射和编译。
- `apps/web/src/features/editor/PlusControlPanel.tsx`
  - 负责 Plus 模式 UI。
- `apps/web/src/features/editor/ParameterModeTabs.tsx`
  - 负责 Plus / Pro 切换。
- `apps/web/src/features/editor/PlusControlPanel.test.tsx`
  - 覆盖基础渲染和回调。
- `packages/core/test/plusControls.test.ts`
  - 覆盖能力识别和 patch 编译。

保持 `ParameterPanel.tsx` 作为 Pro 面板，不把 Plus 逻辑塞进去。

## 分阶段落地

### 阶段 1：MVP

- 新增 Plus / Pro 模式切换。
- Plus 默认展示：
  - 速度
  - 进出效果
  - 动效强度
- 只基于确定规则映射参数。
- 对无法映射的组件，自动回退到 Pro 或显示“该组件暂无简化控制”。

### 阶段 2：轨迹与节奏

- 为内置组件补充更明确的轨迹参数命名或 metadata。
- 开启轨迹和节奏控制。
- 支持解释文本：例如“已调整：轨迹中点 Y、终态 X”。

### 阶段 3：Preset

- 用户可把 Plus 配方保存为 preset。
- 预置风格：克制、轻快、弹性、强表现。
- 同一组件内复用，不做跨组件强迁移。

## 风险与约束

- 误映射是最大风险。解决方式是高置信度才展示，低置信度隐藏。
- 轨迹控制风险最高，因为 X/Y 参数在不同组件里语义差异很大。
- Plus 不能承诺所有参数都能被简化。
- Pro 反推 Plus 不做强一致，否则会引入大量复杂状态和边界错误。
- 导入组件的参数命名不稳定，Plus 覆盖率会低于内置组件。

## 验收标准

- 小白用户默认看到 Plus 模式，面板不超过 5 个主控制项。
- Pro 模式仍能访问全部 confirmed 参数。
- Plus 调整后预览立即更新，导出结果与 Pro patch 链路一致。
- Plus 控制项只在存在有效映射时展示。
- 速度、进出效果、动效强度至少覆盖 `jd-product-transition-video`、`jd-popup-feedback-fast`、`jd-popup-feedback-eased`、`jd-horizontal-switch` 中的可映射能力。
- 单元测试覆盖：
  - `derivePlusControls` 不展示无映射控制项。
  - `compilePlusPatch` 只写入 mapped 参数。
  - duration 结果被 constraints clamp。
  - Pro 面板仍按当前 manifest 参数渲染。

