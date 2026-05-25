# 2026-05-24 · 预览/编辑器/检索链路审计

本次审计与改造覆盖三块能力，结论与修复落地都集中在本周 (P3 阶段) 完成。

## 1. 动效预览效果

### 现状摸底

预览管线核心位于：

- `apps/web/src/features/editor/previewHtml.ts`：编辑/缩略图两种 mode 的 srcDoc 组装
- `apps/web/src/features/editor/PreviewFrame.tsx`：iframe 渲染容器
- `packages/core/src/patch/applyPatch.ts`：把 manifest 参数应用回源文件
- `packages/core/src/adapters/workeasy/localizeHtml.ts`：把 WorkEasy 英文文案翻成中文

### 已修复的问题

| # | 现象 | 原因 | 修复 |
|---|---|---|---|
| 1 | WorkEasy 翻译后文字相邻 inline 元素粘连 (`Hello <strong>保存</strong>编辑`) | `localizedSample(text.trim())` 把前后空白吃掉 | 拆出 leading/trailing 空白，仅对核心文本查字典 |
| 2 | hero-text-reveal 等组件在编辑预览里被 `min-height: 100vh` 顶起一片大空白 | EDITOR_STYLE 没有覆盖组件内 vh 单位 | 给 `.motion-editor-stage > *` 注入 `min-height/min-width: auto !important` |
| 3 | WorkEasy 重复 `.button { color: ... }` 块只有第一处生效 | `applyCssProperty` 用 `m` 标志而非 `gm` | 改为全局匹配，覆盖所有出现 |
| 4 | 缩略图初次测量偏小、缩放比例错误 | `fitThumbnail` 立刻 `requestAnimationFrame` 时 transform 还没落地 | 双 rAF 后再测量 |
| 5 | 用户改任意参数都会触发 iframe 重渲、动画从头播放 | `PreviewFrame` 每次 render 都重算 srcDoc | `useMemo` 缓存，依赖只为 source/manifest/patch |

### 仍待跟进 (非阻塞)

- 当 patch 改的是文字时仍然会重置动画。可通过 iframe `postMessage` 让内部脚本 patch DOM 局部更新，避免整页刷新。

## 2. 动效编辑页面布局

### 已修复

| # | 优化点 | 落点 |
|---|---|---|
| 6 | 参数面板按 `manifest.groups` (显式) 或 `param.ui.group` (隐式) 分组渲染；无分组时回退平铺 | `apps/web/src/features/editor/ParameterPanel.tsx` 新增 `groupParameters` |
| 7 | 顶部"重置默认值"按钮，把所有参数清回 `manifest.params.default` | `useProject.resetParams` + ParameterPanel `onReset` |
| 8 | 删除 EditorRoute 里"暂停"、"视口"两个无 onClick 的死按钮 | `apps/web/src/routes/EditorRoute.tsx` |
| 9 | 右侧面板宽度改 `clamp(300px, 28vw, 380px)`；900px 断点改 `min(60vh, 520px)` 控制预览高度 | `apps/web/src/styles/editor.css`、`responsive.css` |

### 仍待跟进

- 拖拽分隔条调整面板宽度。
- 预览区加 loading skeleton 覆盖 iframe 切换的空白瞬间。

## 3. 入库分析 / 检索链路

### 现状摸底

**没有数据库。** 整个"入库 + 检索"是 in-memory 计算：

```
WorkEasy JSON          builtinComponents (import.meta.glob)
       │                          │
       ▼                          ▼
convertWorkEasyComponent     loadMotionComponentFromFiles
       │                          │
       └───────────┬──────────────┘
                   ▼
            MotionComponent[]
                   │
                   ▼
            recommendComponents (每次都跑)
                   │
                   ▼
        createSearchProfile (每个 component 算一次画像)
```

- **画像字段**：`searchProfile.ts` 抽出 5 个 trait 桶 (color / motion / function / scene / editable)，靠关键字匹配 + hex→hue 颜色推断
- **打分**：`recommend.ts:scoreTerm` 分别给 function=4 / scene=3 / motion=3 / color=2 / editable=1，命中负面词 -5，hardConstraints 走 missing 通道
- **brief → intent**：用户输入先送 `apps/web/src/dev-api/briefParser.ts` (OpenAI Responses API)，失败回退到 `createFallbackBriefIntent` 的本地规则

### 已修复

| # | 优化点 | 落点 |
|---|---|---|
| 10 | `createSearchProfile` 用 WeakMap 按 component 实例缓存，避免每次推荐都重新扫 html/css | `packages/core/src/orchestrator/recommend.ts` |
| 11 | `searchProfile.rawText` 不再塞整段 css/html，只保留可见文案 + class 名 + keyframes 名 | `packages/core/src/orchestrator/searchProfile.ts` |
| 12 | `briefParserClient` 加 32 条 LRU，相同 brief 不重复调 LLM | `apps/web/src/services/briefParserClient.ts` |
| 13 | (副产物) WorkEasy 静态数据 / builtin 组件资源 拆到独立 chunk | `apps/web/vite.config.ts` `manualChunks` |

构建指标：

- **首屏 chunk**: 667 KB → **22 KB** (gzip 170 KB → **7.7 KB**)
- workeasy-data / builtin-assets 走按需 / lazy 路径

### 仍待跟进 (架构级)

- **持久化索引**：把 `SearchProfile` 序列化到 build-time JSON，运行时 `fetch` 即可避免每次构建 profile
- **embedding 检索**：当前是关键字匹配，对自然语言诉求覆盖率有限。可在 build 时调 OpenAI embedding，运行时用 cosine 相似度排序
- **iframe postMessage 协议**：避免每次参数变化都整页刷新

## 验证

```
pnpm lint               # 0 issue
pnpm format:check       # 仅旧文件 preexisting 报警
pnpm -r typecheck       # 3 packages OK
pnpm -r test            # 59 tests pass (core 37 + web 22)
pnpm check:circular     # 55 files / 0 circular
pnpm --filter @motion-tool/web build  # 首屏 22 KB
```
