# 变更提案: 导出嵌入包升级为 NutUI React 可复用 SDK

## 需求背景

当前“导出嵌入包”已经可以生成可预览的 zip，包含 `motion-widget.js`、`motion-widget.css`、`demo.html`、`embed.html`、`manifest.json`、`motion.patch.json` 和资源文件。这个能力适合下载预览和简单 HTML 页面嵌入，但对外部团队长期复用仍不够稳定。

外部团队，尤其是基于 `jdf2e/nutui-react` 的 React 项目，需要明确的包结构、稳定 API、类型声明、React 兼容壳、生命周期管理、动态参数更新能力和资源部署规则。否则接入方需要理解本项目内部 manifest、patch、iframe 和资源路径细节，复用成本高，后续破坏性变更风险大。

## 产品分析

### 目标用户与场景

- **用户群体:** 使用 NutUI React 或普通 React 17/18 技术栈的前端团队。
- **使用场景:** 将 AI Motion 生成的动效组件接入业务页面、组件库 demo、运营活动页或移动端 H5 页面。
- **核心痛点:** 当前导出物更像 demo 包，缺少可稳定安装、引用、升级和控制的组件契约。

### 价值主张与成功指标

- **价值主张:** 让导出的动效组件像普通前端 SDK 一样接入，外部团队无需理解 AI Motion 内部实现。
- **成功指标:**
  - React 17/18 项目可以通过一个 wrapper 组件完成挂载和销毁。
  - NutUI React demo 可以直接引用导出包并运行。
  - 运行时支持 `mount/update/replay/pause/seek/destroy`。
  - 导出包具备 `package.json`、ESM/UMD 入口、`.d.ts` 类型声明和 README。

### 人文关怀

导出包应降低外部团队接入负担，提供明确示例和错误提示，避免让接入方通过阅读生成代码反推使用方式。运行时默认隔离样式和脚本，减少对接入页面的副作用。

## 变更内容

1. 将当前嵌入包从“静态 demo zip”升级为“npm 风格 SDK 包”。
2. 保留 iframe 隔离，但从 `srcdoc` 改为 `baseUrl + iframe.html` 文件加载。
3. 新增宿主运行时 API：`mountMotionWidget`、`update`、`replay`、`pause`、`seek`、`destroy`。
4. 新增 React 兼容壳，支持 React `^16.8.0 || ^17.0.0 || ^18.0.0`。
5. 新增类型声明、NutUI React 示例、README 和接入约束说明。
6. 补充测试覆盖导出结构、API 文本、资源路径和 React wrapper 生命周期。

## 影响范围

- **模块:** `packages/core` 导出包生成逻辑、`apps/web` 导出面板链路、测试用例。
- **文件:**
  - `packages/core/src/export/exportPackage.ts`
  - `packages/core/test/exportPackage.test.ts`
  - `apps/web/src/features/export/ExportPanel.tsx`
  - `apps/web/src/features/export/ExportPanel.test.ts`
  - 如需要新增导出模板或 helper，可在 `packages/core/src/export/` 下增加小文件。
- **API:** 新增导出包运行时 API，不改变编辑器内部 manifest API。
- **数据:** 不涉及持久化数据结构迁移。

## 核心场景

### 需求: npm 风格嵌入包

**模块:** 导出包生成
导出的 zip 解压后，应具备稳定的包结构和标准入口，外部团队可以按普通前端包理解和托管。

#### 场景: 有构建系统的 React 项目接入

当接入方将导出包放入项目依赖或静态目录时：

- 可以读取 `package.json` 中的 `main`、`module`、`types`、`style`。
- 可以通过 ESM 或 UMD 使用 runtime。
- 不需要读取 AI Motion 内部 `motion.manifest.json` 才能完成接入。

### 需求: React 17/18 兼容壳

**模块:** React wrapper
导出包应提供一个轻量 React 组件，兼容 NutUI React 项目的 React 版本边界。

#### 场景: NutUI React demo 页面接入

当业务页面引入 React wrapper 并传入 `baseUrl` 和 `params` 时：

- 首次渲染挂载 iframe。
- props 参数变化调用 runtime `update`，不重建整个组件。
- 组件卸载时调用 `destroy`，不残留 iframe、timer 或 message listener。

### 需求: 动态参数控制

**模块:** Runtime API
导出动效不能只固定导出时状态，应支持宿主页面动态控制。

#### 场景: Tabbar 点击切换

当宿主页面将 `selectedIndex` 从 0 更新为 1 时：

- iframe 内动效收到参数更新。
- 动效按内部实现切换状态。
- 宿主无需重新创建组件。

### 需求: 资源部署稳定

**模块:** 资源路径与 iframe 加载
导出包应适配 CDN、静态目录和移动端 H5 页面。

#### 场景: 静态资源部署到 `/static/motion/tabbar/`

当 runtime 收到 `baseUrl="/static/motion/tabbar/"` 时：

- iframe 加载 `/static/motion/tabbar/dist/iframe.html`。
- iframe 内 CSS、JS、图片资源均通过相对路径解析。
- 不依赖宿主页面 `document.baseURI` 的偶然行为。

## 风险评估

- **风险:** `srcdoc` 改为真实 iframe 文件后，资源路径和跨文档通信更严格。
  - **缓解:** 统一 `baseUrl` 规则，测试覆盖有无尾斜杠两种输入。
- **风险:** 动态参数 update 协议如果直接暴露内部 patch 结构，会把内部实现泄露给外部团队。
  - **缓解:** 对外只暴露 plain params，iframe 内部负责映射到组件更新逻辑。
- **风险:** React wrapper 引入 React 18 专属 API 会破坏 NutUI 兼容性。
  - **缓解:** 只使用 React 16.8+ hooks：`useEffect`、`useRef`、`forwardRef`、`useImperativeHandle`。
- **风险:** iframe 隔离带来尺寸同步和性能开销。
  - **缓解:** 保留当前 ResizeObserver 尺寸同步，默认不自动轮询；多实例场景通过独立 iframe 隔离。
