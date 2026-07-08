# Zero 原生帧间动效首次生成优化

## 目标

Zero 原生帧间动效的主流程改为：发现或输入首尾帧后，第一次点击「生成首尾帧动效」就直接应用系统推荐的 recipe。用户不再需要先生成保守模板，再二次点击「应用推荐方案」。

## 范围

- Motion Copilot 独立模块。
- Zero 原生图层帧间链路。
- legacy 低保真和高保真预览只清理默认调试 nodeId，不改变其数据结构。

## 行为变化

- Zero 原生首尾帧 nodeId 默认值为空。
- legacy 低保真和高保真预览 nodeId 默认值为空。
- 高保真预览补充首尾帧 nodeId 输入框，避免清空默认值后没有输入入口。
- Zero 原生生成时先构造 `ZeroLayerMorphSource`，再运行 `buildZeroMotionSpec` 和 `recommendZeroLayerRecipes`。
- 如果存在推荐 recipe，首次生成直接调用 `applyZeroLayerMotionRecipe`。
- 如果没有推荐 recipe，回退到 `compileZeroLayerMotionComposition`。
- 首次生成后 `activeRecipeId` 指向已应用 recipe，推荐卡和更多方案列表同步显示选中态。

## 验收清单

- [ ] 页面初始进入 Zero 原生模式时，首帧和尾帧 nodeId 输入为空。
- [ ] 未选择或填写首尾帧时，点击「生成首尾帧动效」不请求 `/api/zero/layer-snapshot`。
- [ ] 文件级首尾帧发现后，点击某组帧对会生成推荐 recipe 动效。
- [ ] 手动填写首尾帧后，第一次点击生成即可看到推荐 recipe 的动效片段。
- [ ] 推荐 recipe 卡片显示「已应用」。
- [ ] 更多动效方案里的同名 recipe `aria-pressed=true`。
- [ ] 任意 recipe 的最终状态仍严格还原 Zero 尾帧。
- [ ] 导出的 Zero 原生动效 HTML 与页面预览一致。

## 验证命令

```bash
cd apps/motion-copilot && ./node_modules/.bin/vitest run src/App.test.tsx
cd apps/motion-copilot && ./node_modules/.bin/tsc --noEmit
cd packages/motion-copilot-core && ./node_modules/.bin/vitest run test/zeroLayerMorph.test.ts
cd packages/motion-copilot-core && ./node_modules/.bin/tsc --noEmit
node scripts/zero-layer-diagnose.mjs --fixture --from 28:19 --to 28:2 --emit-spec --recommend-recipes --emit-salience --emit-repair-advice --pretty
node scripts/zero-layer-diagnose.mjs --fixture --from 28:19 --to 28:2 --recipe-samples --pretty
npm run verify:zero-motion
```

## 备注

`package.json` 增加了 `verify:zero-motion`，用于串联两条 Zero 原生诊断命令。`npm run verify:zero-motion` 已验证通过。在当前 Codex runtime 中，直接执行 `pnpm verify:zero-motion` 会被 pnpm 11 的 ignored build scripts 审批机制拦截；这不是诊断脚本失败。
