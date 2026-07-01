# Zero Motion Harness Todo

日期：2026-07-01

范围：`apps/motion-copilot`、`packages/motion-copilot-core`、`scripts/zero-layer-diagnose.*`。

## 目标

在项目独立运行时，提供一套 deterministic harness，用于读取 Zero MCP 原生图层、生成首尾帧动效诊断、定位还原不准的原因，并作为 CLI / UI / 自动化门禁共用的同一套判断逻辑。

## 已完成

- [x] 诊断 schema。
  - 验收：输出 `motion-copilot.zero-layer-diagnostic.v1`。
  - 验收：包含 read / matching / motion / geometry / styleCapabilities / risks / recommendations。
- [x] 诊断核心。
  - 验收：复用 `compileZeroLayerMotionBindings` 和 `compileZeroLayerMotionComposition`。
  - 验收：识别低置信匹配、坐标异常、样式不支持、vector 近似、父退出层遮挡、弱命名。
  - 验收：输出可执行建议，例如调整退出层级、修复坐标归一化、补充样式渲染、改善 Zero 命名。
- [x] CLI 入口。
  - 验收：`node scripts/zero-layer-diagnose.mjs --from <nodeId> --to <nodeId>`。
  - 验收：支持 `--fixture`。
  - 验收：支持 `--from-file` / `--to-file`。
  - 验收：支持 JSON 和 `--pretty` 输出。
  - 验收：支持 `--out <path>`。
- [x] 自动化门禁。
  - 验收：`--fail-on warning` 遇到 warning/error 返回非 0。
  - 验收：`--fail-on error` 只在 error 风险时返回非 0。
  - 验收：失败时仍输出完整报告，方便 harness/CI 保存证据。
- [x] 应用内诊断面板。
  - 验收：Zero 原生图层生成后显示 Harness 诊断。
  - 验收：显示 layer 读取数量、matched/enter/exit/unresolved、motion 时长、y-motion 数量。
  - 验收：显示风险码与建议，便于真机上直接定位问题。
- [x] 诊断报告持久化。
  - 验收：报告保存到 `ZeroLayerMorphSource.diagnosticReport`。
  - 验收：workspace 自动保存/恢复后仍能回看 Harness 诊断。
- [x] 截图像素对比门禁支持 Zero 原生 layer 导出。
  - 验收：`scripts/verify-zero-visual-export.mjs` 同时支持 `.mc-zero-stage` 与 `.mc-zero-layer-stage`。
  - 验收：Zero layer HTML 可通过同一截图 gate 校验首尾帧。
- [x] 回归测试。
  - 验收：core 诊断报告测试。
  - 验收：CLI fixture 测试。
  - 验收：CLI fail-on 门禁测试。
  - 验收：应用内 Zero 原生诊断展示测试。
  - 验收：诊断报告持久化恢复测试。
  - 验收：Zero layer screenshot gate 测试。

## 当前不做

- [ ] 不接入 LLM 自动修复。
- [ ] 不写回 Zero。
- [ ] 不自动修改用户稿件。
- [ ] 不把低保真/高保真/Zero 原生三套入口合并。
- [ ] 不新增新的 dev server 或端口。

## 后续可选

- [ ] 增加 Zero 命名规范检查的更细颗粒度提示。
- [ ] 增加 LLM suggestion 层，但只生成建议，不直接改图层。

## 常用命令

```bash
node scripts/zero-layer-diagnose.mjs --fixture --from 28:19 --to 28:2 --pretty
node scripts/zero-layer-diagnose.mjs --from 33:36 --to 33:35 --pretty
node scripts/zero-layer-diagnose.mjs --from 33:36 --to 33:35 --fail-on warning --out zero-diagnostic.json
node scripts/verify-zero-visual-export.mjs --html export.html --from from.png --to to.png --threshold 0.04
```
