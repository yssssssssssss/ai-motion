# MotionRecipe 可迁移动效系统 Todo List

更新日期：2026-06-06

## 目标

把项目从“生成一个动效组件”升级为“提取、参数化、复用和迁移动效模式”。最终生成结果必须同时满足：

- [x] 动效模式可以被独立表达为 `MotionRecipe`。
- [x] 动效参数可以完整暴露到 manifest 和编辑器。
- [x] 动效控制的元素、图层都可以替换。
- [x] Recipe 可以应用到不同组件和场景。
- [x] 输出组件通过安全、覆盖和可迁移门禁。

## Milestone 1：最小可落地闭环

- [x] 定义 `MotionRecipe` 类型和 schema。
- [x] 定义 `MotionRecipeRequest`，承接 `SemanticIntentV2` 的动效请求。
- [x] 实现 3 个基础 recipe：`scale-entrance`、`bounce-feedback`、`page-front-back-transition`。
- [x] 实现 `SemanticIntentV2 -> MotionRecipeRequest` 映射。
- [x] 实现 `applyMotionRecipe()`，输出 HTML/CSS/JS/manifest。
  - [x] 已输出 manifest recipe binding、params、layers。
  - [x] 已补 HTML/CSS/JS 注入与重写能力。
- [x] 将自然语义生成链路接入 recipe resolve 和 recipe apply。
- [x] 增加图层可替换门禁：生成组件所有 recipe targets 必须 `replaceable: true`。
- [x] 增加回归测试：未知需求不能默认蓝色按钮。

## P0：核心模型

- [x] 定义 `MotionRecipe`。
  - [x] `id`
  - [x] `name`
  - [x] `category`
  - [x] `trigger`
  - [x] `timeline`
  - [x] `targets`
  - [x] `params`
  - [x] `bindings`
  - [x] `constraints`
  - [x] `source`
- [x] 定义 `MotionRecipeParam`。
  - [x] `duration`
  - [x] `delay`
  - [x] `easing`
  - [x] `distance`
  - [x] `scale`
  - [x] `opacity`
  - [x] `rotate`
  - [x] `stagger`
  - [x] `loop`
  - [x] `direction`
  - [x] `transformOrigin`
- [x] 定义 `MotionRecipeTarget`。
  - [x] `role`: foreground / background / image / text / button / card / screen / modal
  - [x] `required`
  - [x] `replaceable`
  - [x] `selector`
  - [x] `acceptedKinds`
- [x] 定义 `MotionRecipeBinding`。
  - [x] CSS variable binding
  - [x] keyframes binding
  - [x] selector binding
  - [x] JS replay binding
- [x] 建立 zod schema 校验。
  - [x] 拒绝无 target 的 recipe。
  - [x] 拒绝无 replay 能力的 recipe。
  - [x] 拒绝不可替换 target 的生成 recipe。

## P1：语义理解接入

- [x] 扩展 `SemanticIntentV2`。
  - [x] 增加 `motionCategory`。
  - [x] 增加 `targetRoles`。
  - [x] 增加 `composition`: single / sequence / parallel。
  - [x] 增加 `migrationIntent`。
  - [x] 增加 `referenceRecipeHints`。
- [x] 建立 `SemanticIntentV2 -> MotionRecipeRequest` 映射。
  - [x] 用户说“弹动” -> bounce/elastic recipe。
  - [x] 用户说“缩放入场” -> scale entrance recipe。
  - [x] 用户说“前后进场” -> page transition recipe。
  - [x] 用户说“背景漂浮” -> background float recipe。
  - [x] 用户说“点击后” -> trigger click。
  - [x] 用户说“循环” -> loop true。
- [x] 建立模型解析 prompt/schema。
  - [x] 输出结构化 recipe request。
  - [x] 明确不能默认按钮。
  - [x] 明确图层必须可替换。
  - [x] 明确动效参数必须暴露。
- [x] 保留本地 fallback。
  - [x] 使用现有 V2 fallback。
  - [x] fallback 只做低置信度兜底。
  - [x] 标记 `source: fallback`。

## P2：内置基础 Recipe 库

- [x] 实现 `scale-entrance` recipe。
  - [x] 适合 foreground / image / card / modal。
  - [x] 参数：duration、easing、scaleStart、scaleEnd、opacityStart、opacityEnd、origin。
- [x] 实现 `slide-entrance` recipe。
  - [x] 参数：direction、distance、duration、easing、opacity。
- [x] 实现 `bounce-feedback` recipe。
  - [x] trigger: click / hover。
  - [x] 参数：scalePeak、settleScale、duration、easing。
- [x] 实现 `fade-entrance` recipe。
  - [x] 参数：opacityStart、opacityEnd、duration、delay。
- [x] 实现 `float-loop` recipe。
  - [x] 适合 background / foreground。
  - [x] 参数：amplitude、duration、direction、loop。
- [x] 实现 `pulse-loop` recipe。
  - [x] 适合 badge / loader / button。
  - [x] 参数：scale、opacity、duration、loop。
- [x] 实现 `page-front-back-transition` recipe。
  - [x] 适合 screen / frontPage / backPage。
  - [x] 参数：enterDistance、exitDistance、washOpacity、cycleDuration、radius、easing。
- [x] 每个 recipe 必须声明：
  - [x] targets
  - [x] params
  - [x] CSS variables
  - [x] keyframes
  - [x] replay hook
  - [x] replacement constraints

## P3：Recipe 应用引擎

- [x] 实现 `applyMotionRecipe()`。
  - [x] 输入：recipe、target layers、base component/source。
  - [x] 输出：新的 HTML/CSS/JS files + manifest patch。
- [x] 实现 `applyMotionRecipe()` 的 manifest 首段能力。
  - [x] 输出 recipe binding。
  - [x] 输出 recipe params。
  - [x] 输出可替换 recipe layers。
- [x] 实现 selector 绑定。
  - [x] 根据 target role 找到对应 selector。
  - [x] 找不到则生成标准 wrapper layer。
  - [x] 禁止直接绑定模糊全局 selector。
- [x] 实现 CSS variable 注入。
  - [x] 将 recipe params 写入 `:root`。
  - [x] 保证参数可以被 manifest 控制。
- [x] 实现 keyframes 注入。
  - [x] keyframes 名称去重。
  - [x] 避免覆盖原组件 keyframes。
- [x] 实现 replay 协议注入。
  - [x] `window.motionReplay`
  - [x] `window.motionPause`
  - [x] `window.motionSeek`
- [x] 实现图层替换 manifest 输出。
  - [x] 所有 recipe target 对应 `layers.replaceable = true`。
  - [x] 每个 layer 有明确 selector target。
  - [x] 素材/文案 target 必要时绑定 `paramId`，结构 target 通过 `targetLayerIds` / `targetSelectors` 绑定。

## P4：从参考案例提取 Recipe

- [x] 实现 `extractMotionRecipeFromComponent()`。
  - [x] 读取 source files。
  - [x] 识别 keyframes。
  - [x] 识别 animation/transition。
  - [x] 识别 CSS variables。
  - [x] 识别 JS replay hook。
- [x] 提取动效参数。
  - [x] duration
  - [x] delay
  - [x] easing
  - [x] transform
  - [x] opacity
  - [x] loop
  - [x] direction
- [x] 提取目标图层。
  - [x] 从 manifest.layers 优先。
  - [x] 从 HTML class/data-motion 推断。
  - [x] 从 CSS selector 推断。
- [x] 生成 recipe confidence。
  - [x] 完整参数高置信。
  - [x] 缺少 replay 降置信。
  - [x] 缺少 replaceable target 降置信。
- [x] 对参考案例建立 recipe cache。
  - [x] “前后进场代码动效”可提取为 page transition recipe。
  - [x] recipe cache 可被自然语言命中和复用。

## P5：自然语义生成链路改造

- [x] 新生成链路改为 `brief -> SemanticIntentV2 -> MotionRecipeRequest -> recipe resolve -> apply recipe -> validate`。
- [x] 参考组件只提供两类信息。
  - [x] 可提取 recipe。
  - [x] 可借鉴 base layout/source。
- [x] 当用户要求“基于某组件动效”：
  - [x] 优先提取该组件 recipe。
  - [x] 按用户语义改 recipe params。
  - [x] 应用到目标组件/图层。
- [x] 当用户只描述动效：
  - [x] 从内置 recipe 库选择。
  - [x] 没有目标组件时生成标准可替换图层容器。
- [x] 当用户描述目标组件和动效：
  - [x] 先生成目标结构。
  - [x] 再应用 recipe。
  - [x] 输出完整 manifest。

## P6：校验与门禁

- [x] 新增 `validateMotionRecipe()`。
  - [x] target 必须存在。
  - [x] params 必须可控。
  - [x] replay 必须存在。
  - [x] generated layers 必须 replaceable。
- [x] 新增 `validateRecipeApplication()`。
  - [x] selector 存在。
  - [x] keyframes 存在。
  - [x] animation 绑定存在。
  - [x] manifest params 覆盖 recipe params。
  - [x] manifest layers 覆盖 recipe targets。
- [x] 覆盖校验新增项。
  - [x] 用户指定动效类型是否存在。
  - [x] 用户指定触发方式是否存在。
  - [x] 用户指定图层是否可替换。
  - [x] 用户否定约束是否满足。
- [x] 保留安全校验。
  - [x] 禁止 fetch。
  - [x] 禁止 eval。
  - [x] 禁止 new Function。
  - [x] 禁止 cookie。
  - [x] 禁止外链资源。

## P7：编辑器与用户体验

- [x] 编辑器显示 Recipe 信息。
  - [x] 动效类型。
  - [x] 触发方式。
  - [x] 目标图层。
  - [x] 参数列表。
- [x] 图层替换面板按 recipe target 展示。
  - [x] 前景图层。
  - [x] 背景图层。
  - [x] 图片图层。
  - [x] 文案图层。
  - [x] 页面层。
- [x] 参数面板按 recipe 分组。
  - [x] 时间。
  - [x] 缓动。
  - [x] 轨迹。
  - [x] 透明度。
  - [x] 缩放。
  - [x] 循环。
- [x] 替换图层后自动复用 recipe。
  - [x] 不重新生成动效。
  - [x] 只更新绑定目标或素材。
- [x] 增加“将此动效应用到其他组件”入口。
  - [x] 选择目标组件。
  - [x] 选择目标图层。
  - [x] 应用 recipe。
  - [x] 生成新组件。

## P8：测试与验收

- [x] 单测：recipe schema 校验。
- [x] 单测：每个内置 recipe 参数完整。
- [x] 单测：每个内置 recipe target 可替换。
- [x] 单测：`SemanticIntentV2 -> MotionRecipeRequest`。
- [x] 单测：`applyMotionRecipe()` 输出 HTML/CSS/JS/manifest。
  - [x] 已覆盖 manifest binding / params / layers。
  - [x] 已覆盖 HTML/CSS/JS 注入。
- [x] 单测：从“前后进场代码动效”提取 page transition recipe。
- [x] 集成测试：“做一个移动端页面，需要前景图层以缩放效果入场”。
- [x] 集成测试：“把前后进场代码动效应用到商品卡片切换上”。
- [x] 集成测试：“做一个背景层缓慢漂浮的页面”。
- [x] 集成测试：“不要按钮，做一个页面切换动画”。
- [x] 回归测试：不允许未知需求默认生成蓝色按钮。
- [x] 回归测试：所有生成组件 manifest layers 必须 `replaceable: true`。
- [x] 验证：`pnpm --filter @motion-tool/core test`，25 files / 120 tests passed。
- [x] 验证：`pnpm --filter @motion-tool/web test`，34 files / 125 tests passed。
- [x] 验证：`pnpm --filter @motion-tool/core typecheck`。
- [x] 验证：`pnpm --filter @motion-tool/web typecheck`。
- [x] 验证：`pnpm --filter @motion-tool/web build`。Vite 提示 Node 20.18.1 低于推荐 20.19+，但 client/SSR build 均成功。
- [x] 验证：重启本地 dev server，当前地址 `http://127.0.0.1:5173/`。

## 状态记录

| 日期 | 状态 | 说明 |
| --- | --- | --- |
| 2026-06-06 | 进行中 | 已创建可编辑、可追踪 todolist。 |
| 2026-06-06 | Milestone 1 首段完成 | 已完成 MotionRecipe 类型/schema、3 个内置 recipe、语义到 recipe request、manifest 级 apply、生成链路接入、recipe 门禁和核心回归测试。HTML/CSS/JS 注入仍待后续实现。 |
| 2026-06-06 | 全部完成 | 已完成内置 recipe 扩展、语义 V2/schema/prompt、本地低置信 fallback、HTML/CSS/JS recipe apply、参考案例提取/cache、跨组件迁移、编辑器 recipe/图层/参数面板、门禁与安全校验，并通过全量测试、typecheck、build 和 dev server 重启验证。 |
