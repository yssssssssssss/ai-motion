# 2026-06-07 · Motion Skill Compiler 设计

## 背景

设计师已经沉淀了一批原子动态参数，当前样例见 `docs/原子动态参数.pdf`。这些参数描述的是动效设计意图，而不是某个具体组件的局部配置。它们包含元素、梯度、Token、时长、延迟、动画类型、关键属性变化和 CSS 曲线等信息。

目标不是让设计师写工程化 `manifest.json`、`tokens.json` 或 `MotionRecipe`，也不是让自然语言模型临场猜动效。第一版应让设计师继续按 PDF 中的表格格式维护 CSV，由系统编译成可运行、可预览、可版本追踪的动效能力。

## 目标

- 设计师只提交一张 CSV，总表字段保持接近 PDF。
- Compiler Agent 自动解析、归一化、比对、版本化、归档和编译。
- 首页在“自然语义生成”按钮旁新增“原子动效参数”入口。
- 第一版按 CSV 的“元素”列选择动效，不依赖用户 prompt 匹配。
- 选中元素和梯度后，直接调用对应原子参数生成或应用动效。
- 编译产物接入现有 `MotionRecipe` / `applyMotionRecipe()`，复用预览、manifest 参数、导出和安全校验能力。
- 生成结果记录使用的元素、梯度、版本、recipe 和 token，旧组件不随新版本自动变化。

## 非目标

- 不做设计师管理后台。
- 不接飞书或在线表格 API。
- 不把 PDF 作为长期维护源。
- 不要求设计师填写版本、状态、change type、token id 或 recipe id。
- 不在第一版做自然语言到 token 的智能匹配。
- 不做复杂时间轴编辑器。
- 不做跨版本一键升级。

## 设计师 CSV

第一版直接支持 PDF 中的字段：

```text
元素
动态示意
梯度
示意
Token
Value
Delay
动画类型
关键属性变化
CSS Value
```

字段映射：

```text
元素           -> motion family / 首页可选动效入口
动态示意       -> metadata / preview reference
梯度           -> variant
示意           -> metadata / preview reference
Token          -> token name
Value          -> duration
Delay          -> delay
动画类型        -> property kind
关键属性变化     -> keyframes / property transition
CSS Value      -> easing
```

CSV 是设计师源文件。项目运行时不直接消费 CSV，只消费 Compiler Agent 输出的结构化产物。

## CSV 解析规则

### Fill Down

PDF/Excel 里常见合并单元格。导出 CSV 后，后续行可能为空。Compiler Agent 必须做向下继承：

```text
元素为空 -> 继承上一行元素
动态示意为空 -> 继承上一行动效示意
梯度为空 -> 继承上一行梯度
示意为空 -> 继承上一行示意
Token为空 -> 继承上一行 Token
```

以下字段不允许静默继承：

```text
Value
Delay
动画类型
关键属性变化
CSS Value
```

这些字段直接影响动效表现。缺失时，该行标记为 incomplete，并进入编译报告。

### Token 行

一行同时具备以下信息时，编译成一个 atomic token：

```text
元素 + 梯度 + Token + Value + Delay + 动画类型 + 关键属性变化 + CSS Value
```

示例：

```text
弹窗反馈 + 中型尺寸 + standard easing + 200ms + 50ms + 缩放 + scale:95->105->100 + cubic-bezier(...)
```

会编译为：

```text
popup-feedback.medium.scale
```

### Recipe 聚合

Compiler Agent 按以下键聚合多行 token：

```text
元素 + 梯度
```

例如：

```text
弹窗反馈 + 中型尺寸
  -> 缩放 token
  -> 透明度淡入 token
```

聚合后生成一个 recipe。第一版不要求设计师手写 recipe。

### 不完整元素

CSV 中可能存在只有元素名但参数不完整的内容，例如：

```text
前后进场
横向切换
容器加载
```

Compiler Agent 应保留这些元素，但标记为 disabled：

```json
{
  "status": "incomplete",
  "reason": "缺少 Value / Delay / 动画类型 / 关键属性变化 / CSS Value"
}
```

首页可以展示，但不能点击生成。

## 编译产物

目录结构：

```text
motion-skills/
  registry.json
  lock.json

  popup-feedback/
    manifest.json
    tokens.json
    recipes.json
    skill.md
    previews.json
```

### registry.json

项目运行时入口索引：

```json
{
  "version": "1.0",
  "elements": [
    {
      "id": "popup-feedback",
      "label": "弹窗反馈",
      "latestVersion": "1.2.0",
      "active": true,
      "variants": ["大型尺寸", "中型尺寸", "小型尺寸"],
      "packPath": "popup-feedback/manifest.json"
    }
  ]
}
```

### lock.json

Compiler Agent 的历史账本。运行时不读取它。它记录 token 指纹、版本、归档、疑似重命名确认结果。

```json
{
  "version": "1.0",
  "families": {
    "popup-feedback": {
      "latestVersion": "1.2.0",
      "tokens": {
        "popup-feedback.medium.scale": {
          "fingerprint": "duration=200|delay=50|easing=...|keyframes=0.95,1.05,1",
          "status": "active"
        }
      }
    }
  }
}
```

### manifest.json

单个元素家族的能力声明：

```json
{
  "id": "popup-feedback",
  "name": "弹窗反馈",
  "version": "1.2.0",
  "source": "designer-csv",
  "variants": ["large", "medium", "small"],
  "defaultVariant": "medium",
  "tokenFile": "tokens.json",
  "recipeFile": "recipes.json",
  "skillFile": "skill.md"
}
```

### tokens.json

原子参数：

```json
{
  "tokens": [
    {
      "id": "popup-feedback.medium.scale",
      "family": "popup-feedback",
      "sourceElement": "弹窗反馈",
      "variant": "medium",
      "sourceVariant": "中型尺寸",
      "targetRole": "modal",
      "token": "standard-easing",
      "property": "scale",
      "durationMs": 200,
      "delayMs": 50,
      "easing": "cubic-bezier(0.38, 0, 0.24, 1)",
      "keyframes": [0.95, 1.05, 1],
      "metadata": {
        "animationType": "缩放",
        "sourceChange": "scale:95->105->100"
      }
    }
  ]
}
```

### recipes.json

由 token 自动组合：

```json
{
  "recipes": [
    {
      "id": "popup-feedback.medium.enter",
      "name": "弹窗反馈 / 中型尺寸",
      "family": "popup-feedback",
      "sourceElement": "弹窗反馈",
      "variant": "medium",
      "sourceVariant": "中型尺寸",
      "targetRole": "modal",
      "trigger": "load",
      "tokenIds": ["popup-feedback.medium.scale", "popup-feedback.medium.opacity"]
    }
  ]
}
```

### skill.md

由 Compiler Agent 自动生成，面向人和模型阅读。设计师不维护它。

### previews.json

用于生成 mock 预览和回归测试案例。

## Compiler Agent

Compiler Agent 第一版做成本地命令：

```text
pnpm motion:compile
```

输入：

```text
motion-source/atomic-motion.csv
motion-skills/lock.json
```

输出：

```text
motion-skills/registry.json
motion-skills/lock.json
motion-skills/<family>/manifest.json
motion-skills/<family>/tokens.json
motion-skills/<family>/recipes.json
motion-skills/<family>/skill.md
motion-skills/<family>/previews.json
motion-skills/compile-report.md
```

职责：

- 字段别名归一化。
- 合并单元格空值 fill down。
- 解析 `200ms`、`0.2s`、`95->105->100`、`cubic-bezier(...)`。
- 根据“元素 + 梯度 + 动画类型 + 属性变化”生成稳定 token id。
- 和 `lock.json` 比对，自动判断新增、修改、删除、疑似重命名。
- 自动版本化，设计师不手填版本。
- 对缺字段、无法解析、疑似重命名输出报告。
- 保留旧版本，不让旧组件被新 CSV 静默改变。

版本规则：

```text
新元素家族 -> 1.0.0
新增梯度或 token -> minor
修改视觉表现字段 -> minor
只改说明或示意 metadata -> patch
CSV 删除历史 token -> minor，并归档旧 token
疑似重命名 -> 阻塞发布，等待人工确认
```

视觉表现字段包括：

```text
Value
Delay
动画类型
关键属性变化
CSS Value
```

## 首页入口

首页“自然语义生成”区域增加并列按钮：

```text
[生成新组件] [原子动效参数]
```

点击“生成新组件”：

```text
继续走现有自然语义生成流程。
不展示“已理解 / 文字 / 入场 / 常规”等语义解析标签。
```

点击“原子动效参数”：

```text
打开原子参数选择面板或弹窗。
选择元素。
选择梯度。
查看参数摘要。
生成或应用该动效。
```

第一版选择器数据来自 `registry.json`，不调用自然语言解析。

## 原子参数选择流程

```text
选择元素：弹窗反馈
选择梯度：中型尺寸
参数摘要：
  缩放 · 200ms · delay 50ms · scale 95 -> 105 -> 100
  透明度淡入 · 150ms · delay 50ms · opacity 0 -> 100
操作：生成预览 / 应用动效
```

如果当前没有目标组件或目标图层，系统生成 mock 组件：

```text
弹窗反馈 -> mock modal
弹窗关闭 -> mock modal close state
容器变换 -> mock card/container
```

如果元素 incomplete：

```text
展示但禁用。
显示缺失原因。
```

## MotionSkill 到 MotionRecipe

当前项目已经有 `MotionRecipe` 和 `applyMotionRecipe()`。第一版应复用它们，不重写预览和导出链路。

转换流程：

```text
MotionSkillRecipe + AtomicMotionToken[]
  -> MotionRecipe
  -> applyMotionRecipe()
  -> HTML/CSS/JS + manifest
```

token 到 CSS 的基本规则：

```text
scale       -> transform: scale(...)
opacity     -> opacity
position    -> translate3d(...)
roundness   -> border-radius
size        -> width/height 或 scale fallback
```

生成后的组件 manifest 记录来源：

```json
{
  "motionSkill": {
    "source": "designer-csv",
    "element": "弹窗反馈",
    "variant": "中型尺寸",
    "family": "popup-feedback",
    "version": "1.2.0",
    "recipeId": "popup-feedback.medium.enter",
    "tokenIds": ["popup-feedback.medium.scale", "popup-feedback.medium.opacity"]
  }
}
```

旧组件默认绑定旧版本。新 CSV 发布不会自动改变旧组件效果。

## 自然语义生成调整

第一版不把原子动效参数接入 prompt 匹配。

但首页自然语义生成区域需要做一次 UI 简化：

- 删除“已理解 / 文字 / 入场 / 常规”等语义解析标签。
- 保留 prompt 输入、生成按钮、加载态、生成结果。
- 原子动效参数作为旁路入口并列展示。

后续版本再考虑：

```text
prompt -> SemanticIntentV2 -> registry 匹配元素/梯度 -> token recipe
```

## 错误处理

Compiler Agent 必须输出清晰报告：

```text
缺失字段：
- 第 12 行 缺少 Value

无法解析：
- 第 17 行 属性变化 "scale 变大一点" 无法转 keyframes

不完整元素：
- 前后进场 缺少完整 token 行

疑似重命名：
- 弹窗反馈 -> 浮层反馈
```

运行时错误处理：

- `registry.json` 缺失：隐藏“原子动效参数”入口或展示不可用状态。
- 元素无 active recipe：禁用生成按钮。
- recipe 转 MotionRecipe 失败：展示编译产物错误，不进入生成。
- 生成源码未通过安全校验：不打开结果页。

## 测试

核心测试：

- CSV 表头识别。
- fill-down 继承。
- `ms` / `s` 时长解析。
- `scale:95->105->100` 解析。
- `opacity:0->100` 解析。
- `position: x 182->182 | y 602->564` 解析。
- `cubic-bezier(...)` 解析。
- incomplete 元素标记。
- token 聚合为 recipe。
- lock diff 无变化。
- 修改视觉字段后自动升版本。
- 删除历史 token 后归档而非物理删除。

Web 测试：

- 首页显示“原子动效参数”入口。
- 自然语义生成不显示“已理解 / 文字 / 入场 / 常规”标签。
- 原子参数面板能列出元素和梯度。
- incomplete 元素不可生成。
- 选择“弹窗反馈 / 中型尺寸”后能生成预览草稿。
- 生成组件 manifest 记录 `motionSkill` 来源。

## 第一版验收用例

CSV 包含 PDF 中“弹窗反馈”参数：

```text
大型尺寸 + 缩放 + 300ms + 50ms + scale 95 -> 105 -> 100
大型尺寸 + 透明度淡入 + 200ms + 50ms + opacity 0 -> 100
中型尺寸 + 缩放 + 200ms + 50ms + scale 95 -> 105 -> 100
中型尺寸 + 透明度淡入 + 150ms + 50ms + opacity 0 -> 100
小型尺寸 + 缩放 + 150ms + 50ms + scale 95 -> 105 -> 100
小型尺寸 + 透明度淡入 + 100ms + 50ms + opacity 0 -> 100
```

首页点击：

```text
原子动效参数 -> 弹窗反馈 -> 中型尺寸 -> 生成预览
```

结果必须满足：

- 生成一个 mock modal 或应用到可绑定 modal/card/root 图层。
- 使用 `弹窗反馈 / 中型尺寸`。
- 包含 scale + opacity 两个 token。
- duration、delay、easing、keyframes 与 CSV 一致。
- iframe 预览可播放。
- manifest 记录 `motionSkill` 来源。
- 自然语义生成区域不展示理解标签。
