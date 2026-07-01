# 任务清单: 导出嵌入包升级为 NutUI React 可复用 SDK

目录: `helloagents/plan/202606241429_embed_sdk_nutui_react/`

---

## 1. 梳理现有导出边界

- [√] 1.1 复查 `packages/core/src/export/exportPackage.ts` 中 `composeEmbedPackageFiles` 的当前输出，确认哪些文件需要保留兼容。
- [√] 1.2 复查 `apps/web/src/features/export/ExportPanel.tsx`，确认 UI 调用链是否只需替换组包内容。
- [√] 1.3 复查 `packages/core/test/exportPackage.test.ts`，记录当前测试覆盖点，避免删除已有能力。

## 2. npm 风格文件结构

- [√] 2.1 在 `packages/core/src/export/exportPackage.ts` 中将嵌入包输出调整为 `dist/`、`react/`、`examples/` 结构。
- [√] 2.2 生成 `package.json`，包含 `main`、`module`、`types`、`style`、`peerDependencies`、`sideEffects`。
- [√] 2.3 保留 `manifest.json` 和 `motion.patch.json`，但 README 明确它们是调试与溯源信息，不是接入必需 API。
- [√] 2.4 更新 `packages/core/test/exportPackage.test.ts`，断言新文件结构完整。

## 3. iframe 文件化运行时

- [√] 3.1 生成 `dist/iframe.html`，引用 `./iframe.css` 和 `./iframe.js`。
- [√] 3.2 将当前抽取出的 body fragment 写入 `iframe.html` 或由 `iframe.js` 注入，选择更简单、可测的实现。
- [√] 3.3 将当前组件 CSS 输出为 `dist/iframe.css`，保持透明背景处理。
- [√] 3.4 将当前组件 JS 输出为 `dist/iframe.js`，并追加 message listener。
- [√] 3.5 将 assets 输出迁移到 `dist/assets/`，修正 HTML/CSS 中相对路径。
- [√] 3.6 更新测试覆盖 `baseUrl` 独立部署路径和图片资源路径。
  > 备注: 已新增 `pnpm verify:embed-package`，通过真实 headless Chrome 验证 `baseUrl -> dist/iframe.html`、iframe 加载与资源路径。

## 4. 宿主 runtime API

- [√] 4.1 生成 `dist/index.esm.mjs`，导出 `mountMotionWidget`。
- [√] 4.2 生成 `dist/index.umd.js`，暴露 `window.AiMotionWidget.mountMotionWidget` 和兼容别名 `window.MotionWidget.mount`。
- [√] 4.3 实现 `mount(container, options)`，创建 iframe 并加载 `baseUrl + dist/iframe.html`。
- [√] 4.4 实现 `replay/pause/seek/update/destroy`，通过 postMessage 发送命令。
- [√] 4.5 实现 ready 队列，iframe 未 ready 前缓存调用，ready 后按顺序 flush。
- [√] 4.6 实现 resize message 处理，更新 iframe 宽高。
  > 备注: 真实 Chrome e2e 曾发现绝对定位组件 iframe 尺寸只有 1x2px，已改为上报 body 子元素 union bounding box；NutUI React e2e 又发现首次挂载尺寸可能停留在 1x1px，已补 iframe load 主动 init 与 iframe load/下一帧/延迟 resize 上报。当前横向切换导出包为 1462x2714px。
- [√] 4.7 更新测试覆盖 API 文本、全局变量名、ready 队列和 destroy 清理。

## 5. iframe 内部 message 协议

- [√] 5.1 在 `dist/iframe.js` 中实现 `ai-motion:init`、`ai-motion:update`、`ai-motion:replay`、`ai-motion:pause`、`ai-motion:seek`、`ai-motion:destroy`。
- [√] 5.2 对接组件现有全局函数：`motionReplay`、`motionPause`、`motionSeek`。
- [√] 5.3 为 `update(params)` 设计第一期策略：先复用已 patch 后的静态初值，并支持对已知 CSS 变量、文本、图片参数进行运行时覆盖。
- [√] 5.4 未支持的参数更新应安全忽略，并在 README 中说明。
- [√] 5.5 iframe ready 后发送 `ai-motion:ready`，尺寸变化发送 `ai-motion:resize`。

## 6. React 兼容壳

- [√] 6.1 生成 `react/index.js`，提供 `MotionWidget` forwardRef 组件。
- [√] 6.2 生成 `react/index.d.ts`，暴露 props 和 handle 类型。
- [√] 6.3 wrapper 使用 `useEffect` 首次挂载，props.params 变化时调用 `handle.update`。
- [√] 6.4 wrapper 卸载时调用 `handle.destroy`。
- [√] 6.5 避免 React 18 专属 API，兼容 React `^16.8.0 || ^17.0.0 || ^18.0.0`。
- [-] 6.6 新增测试覆盖 React wrapper 的 mount、update、unmount 行为。
  > 备注: 已覆盖导出产物和 runtime 行为；真实 React 渲染生命周期测试仍待补充。

## 7. 类型声明与文档

- [√] 7.1 生成 `dist/index.d.ts`，定义 runtime options、handle、params 类型。
- [√] 7.2 生成 README，包含 vanilla、React、NutUI React 接入示例。
- [√] 7.3 README 明确 `baseUrl` 规则：必须指向导出包根目录，支持有无尾斜杠。
- [-] 7.4 README 明确 CSP 注意事项、静态资源部署方式和 iframe 隔离边界。
  > 备注: README 已说明 iframe 隔离和 baseUrl，CSP 细则仍需后续补充。
- [√] 7.5 README 明确动态参数支持范围和不支持项。

## 8. NutUI React 示例

- [√] 8.1 生成 `examples/nutui-react-demo.tsx`，使用 `@nutui/nutui-react` 的基础按钮或布局组件演示参数更新。
- [√] 8.2 示例不强依赖 NutUI 构建环境，不把 `@nutui/nutui-react` 打入导出包依赖。
- [-] 8.3 示例展示 `params.selectedIndex` 变化、ref 调用 `replay`、组件卸载清理。
  > 备注: 示例已展示 selectedIndex 和 replay；卸载清理由 React wrapper 实现，示例未显式展示页面卸载。
- [√] 8.4 运行最小 NutUI React + Vite + React 18 临时项目，验证 `react/index.esm.mjs` 可被真实项目接入。
  > 备注: 已新增并通过 `pnpm verify:nutui-embed`，使用 `@nutui/nutui-react@4.0.0-beta.4`、React 18、Vite、headless Chrome 完成端到端验收。

## 9. UI 与兼容策略

- [√] 9.1 保持 `ExportPanel` 的“导出嵌入包”按钮和下载行为不变。
- [√] 9.2 zip 文件名继续使用 `${project.id}-embed.zip`。
- [√] 9.3 如需保留旧版 `demo.html` 和 `embed.html`，将其迁移到 `examples/` 或根目录兼容位置，并在 README 说明。

## 10. 安全检查

- [√] 10.1 检查 `postMessage` 协议只处理预定义 type，忽略未知消息。
- [√] 10.2 检查 runtime 不把宿主页面 HTML 注入 iframe。
- [√] 10.3 检查 `baseUrl` 拼接不会执行任意脚本字符串，只用于 URL 解析。
- [√] 10.4 检查 destroy 后移除 iframe、event listener 和 ResizeObserver。
  > 备注: 已通过 UMD runtime 和 iframe message 协议测试覆盖 destroy 清理路径；浏览器级内存回收测试仍待后续端到端补充。

## 11. 回归测试

- [√] 11.1 运行 `pnpm --filter @motion-tool/core test -- exportPackage.test.ts`。
- [√] 11.2 运行 `pnpm --filter web test -- ExportPanel.test.ts`。
- [√] 11.3 运行与导出资产相关的 `apps/web/src/features/export/exportAssets.test.ts`。
- [√] 11.4 如修改了预览或 patch 逻辑，补跑 `pnpm --filter @motion-tool/core test -- applyPatch.test.ts`。
- [√] 11.5 运行 `pnpm verify:embed-package`，用真实 headless Chrome 验证导出包可加载、可更新、可销毁。
- [√] 11.6 运行 `pnpm verify:nutui-embed`，用临时 NutUI React 项目验证 React wrapper、静态 `baseUrl`、参数更新和卸载。

## 12. 验收清单

- [√] 12.1 导出的 zip 解压后包含 `package.json`、`dist/`、`react/`、`examples/`。
- [√] 12.2 普通 HTML 页面可以通过 UMD 脚本挂载组件。
  > 备注: 已通过 UMD runtime 行为测试和真实 headless Chrome e2e 验证挂载、iframe 加载、ready 队列、消息发送和销毁。
- [√] 12.3 React 页面可以通过 `MotionWidget` wrapper 挂载组件。
  > 备注: 已生成 CJS 与 ESM wrapper 及类型声明，并通过临时 NutUI React + Vite 项目验证。
- [√] 12.4 `params` 变化可以触发 iframe 内状态更新，不重建 iframe。
  > 备注: 已通过 iframe 协议测试和真实 headless Chrome e2e 覆盖 CSS 变量、文本参数和 selectedIndex 点击桥接。
- [√] 12.5 `destroy` 后 DOM 和监听器清理干净。
  > 备注: 已通过 runtime 测试和真实 headless Chrome e2e 验证 iframe remove 和 message listener 清理。
- [√] 12.6 README 中的 NutUI React 示例可以被外部团队直接照抄改造。
