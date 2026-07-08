# Zero 原生候选帧与 Recipe Adapter Todolist

日期：2026-07-02

## A. 首尾帧候选识别

- [x] A1. 在 core 中定义首尾帧命名后缀常量：
  - `-首帧`
  - `_首帧`
  - ` 首帧`
  - `-尾帧`
  - `_尾帧`
  - ` 尾帧`
  - `-from`
  - `_from`
  - ` from`
  - `-to`
  - `_to`
  - ` to`

- [x] A2. 实现 `parseZeroLayerFrameRole(name)`：
  - 输入图层名。
  - 输出 `from` / `to` / `undefined`。
  - 输出 base name。
  - 只允许末尾匹配。

- [x] A3. 扩展 `deriveZeroLayerNodeCandidates`：
  - 增加 `role` 字段。
  - 增加 `baseName` 字段。
  - 增加 `priority` 字段。
  - 保持原有候选筛选条件：可见、非透明、有尺寸。

- [x] A4. 新增 `deriveZeroLayerFramePairs(fromSnapshot, toSnapshot)`：
  - 根据 base name 自动配对。
  - 输出 from nodeId、to nodeId、label、confidence、reasons。
  - 命名强匹配 confidence 高。
  - 疑似结构匹配 confidence 低。

- [x] A5. 候选排序优化：
  - root frame 优先。
  - 命名候选优先。
  - frame/group/component/instance 优先。
  - text/vector/ellipse 等细碎图层降低优先级。

- [x] A6. 候选搜索保留：
  - 继续支持 nodeId。
  - 继续支持 name。
  - 继续支持 kind。
  - 新增 base name 搜索。

## B. 候选 UI

- [x] B1. 在 `ZeroLayerMorphPanel` 中计算推荐 pair。

- [x] B2. 在候选区域顶部新增“推荐首尾帧”模块：
  - 展示 pair label。
  - 展示 `from nodeId -> to nodeId`。
  - 展示 confidence 文案。
  - 提供“使用”按钮。

- [x] B3. 点击“使用”后同时更新：
  - `fromNodeId`
  - `toNodeId`
  - 当前选中 node

- [x] B4. 候选左右列增加分组：
  - 命名候选。
  - 结构候选。
  - 其他图层。

- [x] B5. 没有命名命中时展示轻提示：
  - “未发现以 -首帧 / -尾帧 结尾的图层，可继续手动选择。”

- [x] B6. 调整样式：
  - 推荐 pair 不遮挡现有候选列表。
  - 候选列表在小屏下仍可滚动。
  - 保持现有 13px 字体规则。

## C. Recipe Adapter Core

- [x] C1. 新增 `adaptZeroLayerRecipeParameters.ts`。

- [x] C2. 定义 `ZeroLayerRecipeAdaptedParameters` 类型：
  - `durationMs`
  - `easing`
  - `staggerMs`
  - `maskAxis`
  - `offsetPx`
  - `scaleFrom`
  - `scaleTo`
  - `opacityFrom`
  - `opacityTo`
  - `overshootRatio`
  - `emphasisLevel`

- [x] C3. 从 `ZeroMotionSpec` 提取场景特征：
  - 主轴方向。
  - 面积变化比例。
  - matched / enter / exit 数量。
  - 主导图层。
  - corridor 边界。
  - 当前 gate 状态。

- [x] C4. 为横向展开生成适配参数：
  - `maskAxis: x`
  - 位移沿 x 轴。
  - 内容按 x 或视觉顺序错峰。
  - 禁止超出 corridor。

- [x] C5. 为纵向展开生成适配参数：
  - `maskAxis: y`
  - 位移沿 y 轴。
  - 内容按 y 顺序错峰。
  - 禁止超出 corridor。

- [x] C6. 为轻状态变化生成适配参数：
  - 缩短 duration。
  - 减小 offset。
  - 增强 opacity / scale 差异。
  - 保持尾帧严格还原。

- [x] C7. 为内容新增/消失生成适配参数：
  - enter 使用 stagger。
  - exit 使用短退场。
  - matched 图层优先保证形变稳定。

- [x] C8. 为所有参数加边界：
  - duration 最小值。
  - duration 最大值。
  - stagger 最大值。
  - offset 不超过 corridor。
  - overshoot 默认 0，除非明确允许。

## D. Recipe 应用与推荐

- [ ] D1. 更新 recipe 定义，增加可适配参数 schema。

- [x] D2. 更新 `applyZeroLayerMotionRecipe`：
  - 支持传入 adapted parameters。
  - 无参数时保留当前默认行为。

- [x] D3. 更新 `recommendZeroLayerRecipes`：
  - 推荐结果包含 adapted params summary。
  - 推荐理由包含场景特征。

- [x] D4. 更新 `evaluateZeroMotionSalience`：
  - 纳入 adapted parameters。
  - 对“差异弱”的方案给出明确提示。

- [x] D5. 更新 `createZeroMotionRepairAdvice`：
  - 如果显著性低，推荐更强 recipe。
  - 如果 corridor 风险高，推荐更稳 recipe。

## E. Harness 与报告

- [x] E1. 更新 recipe sample report：
  - 输出每个 recipe 的 adapted signature。
  - 输出 distinct signature 数量。
  - 输出显著性评分。

- [x] E2. 增加 corridor 检查：
  - matched 图层过程不越界。
  - enter / exit 过程按规则约束。

- [x] E3. 增加尾帧严格还原检查：
  - 最终 transform 清零。
  - 最终 bounds 等于尾帧。
  - 最终 opacity 等于尾帧。

- [x] E4. 增加修复建议：
  - 动效差异弱。
  - 参数过激。
  - 候选帧疑似选错。

## F. UI 参数解释

- [x] F1. 智能推荐卡片展示 adapted params：
  - 主轴。
  - 时长。
  - 错峰。
  - 遮罩方向。
  - 显著性。

- [x] F2. 当前 recipe 面板展示参数摘要：
  - “横向展开 / X 轴 / 720ms / 错峰 48ms”

- [x] F3. 如果显著性低，展示提示：
  - “该方案在当前首尾帧上的体感差异较弱。”

- [x] F4. 如果参数被 corridor 限制，展示提示：
  - “已限制位移范围，确保不超出尾帧空间。”

## G. 自动化测试

- [x] G1. Core 测试：`parseZeroLayerFrameRole` 中文后缀。

- [x] G2. Core 测试：`parseZeroLayerFrameRole` 英文后缀。

- [x] G3. Core 测试：非末尾关键词不匹配。

- [x] G4. Core 测试：from/to 自动配对。

- [x] G5. Core 测试：重复命名不会自动唯一选择。

- [x] G6. Core 测试：候选排序优先 frame/group/component。

- [x] G7. Core 测试：横向展开 adapter 参数。

- [x] G8. Core 测试：纵向展开 adapter 参数。

- [x] G9. Core 测试：轻状态变化 adapter 参数。

- [x] G10. Core 测试：adapter 参数不越 corridor。

- [x] G11. App 测试：推荐 pair 展示。

- [x] G12. App 测试：点击 pair 更新首尾帧 nodeId。

- [x] G13. App 测试：没有命名命中时回退提示。

## H. 文件级首尾帧发现

- [x] H1. 新增 Zero MCP 文件级扫描入口：
  - bridge 支持 `--discover-frame-pairs`。
  - 扫描当前 Zero 文件的页面，而不是只扫描输入 nodeId 子树。
  - 只收集命名命中的 frame / group / component / instance / section。

- [x] H2. 新增文件级发现数据结构：
  - `ZeroLayerFramePairCandidate`。
  - `ZeroLayerFramePairDiscovery`。
  - pair 支持记录 `fromPageName` / `toPageName`。

- [x] H3. 新增 app API：
  - dev/prod 均支持 `POST /api/zero/layer-frame-pairs`。
  - 复用 `ZERO_MCP_LAYER_COMMAND` / `ZERO_MCP_LAYER_ARGS`。
  - 自动把普通 layer snapshot 参数转换为 `--discover-frame-pairs`。

- [x] H4. 新增前端操作入口：
  - Zero 原生面板增加“发现文件首尾帧”。
  - 展示文件级 pair 数量、候选数量、页面数量。
  - 点击 pair 后自动填入首帧 nodeId 与尾帧 nodeId。

- [x] H5. 增加自动化验证：
  - production server route 测试覆盖文件级发现。
  - App 测试覆盖点击文件级 pair 后写入 nodeId。
  - app/core typecheck 通过。

- [x] H6. 真机联调验证：
  - 5177 dev server 接入 `/api/zero/layer-frame-pairs`。
  - 当前 Zero MCP 文件返回 `source: real-zero-mcp-http`。
  - 当前文件扫描到 4 个候选、4 个页面、2 组文件级首尾帧 pair。

- [x] H7. 首尾帧宽松配对：
  - 严格同名仍保持最高置信度。
  - 支持 `收起状态` / `展开状态` 等状态词归一化配对。
  - 支持同页唯一首帧 + 唯一尾帧兜底配对。
  - 文件级配对按页面隔离，避免跨页面同名图层误合并。

- [x] G14. App 测试：智能推荐展示参数摘要。

## H. 验证命令

- [x] H1. 运行 core 测试：
  - `./node_modules/.bin/vitest run test/zeroLayerMorph.test.ts`
  - 工作目录：`packages/motion-copilot-core`

- [x] H2. 运行 core 类型检查：
  - `./node_modules/.bin/tsc --noEmit`
  - 工作目录：`packages/motion-copilot-core`

- [x] H3. 运行 app 测试：
  - `./node_modules/.bin/vitest run src/App.test.tsx src/server/productionServer.test.ts`
  - 工作目录：`apps/motion-copilot`

- [x] H4. 运行 app 类型检查：
  - `./node_modules/.bin/tsc --noEmit`
  - 工作目录：`apps/motion-copilot`

- [x] H5. 运行 app build：
  - `npm run build`
  - 工作目录：`apps/motion-copilot`

## I. 真机测试 Checklist

- [ ] I1. Zero 文件中准备一组 `-首帧` / `-尾帧` 命名节点。

- [ ] I2. 打开 `http://127.0.0.1:5177/`。

- [ ] I3. 进入 Zero 原生帧间能力。

- [ ] I4. 读取 Zero 图层。

- [ ] I5. 确认候选区出现“推荐首尾帧”。

- [ ] I6. 点击推荐 pair 后，首帧和尾帧 nodeId 同时更新。

- [ ] I7. 应用智能推荐。

- [ ] I8. 横向展开场景下，动效主方向为横向。

- [ ] I9. 纵向展开场景下，动效主方向为纵向。

- [ ] I10. 轻状态变化场景下，动效更短、更克制。

- [ ] I11. 多图层新增场景下，有明显错峰。

- [ ] I12. 动效结束后尾帧严格还原 Zero 尾帧。

- [ ] I13. 动效过程中不明显越出首尾帧空间范围。

- [ ] I14. 下载 HTML 后离线打开仍保持同样效果。

## J. 完成定义

- [x] J1. 用户不需要手动从大量候选中找首尾帧。

- [x] J2. 命名规范场景下，系统能自动推荐首尾帧组合。

- [x] J3. 非命名规范场景下，用户仍能手动选择。

- [x] J4. 至少三类场景产生可感知不同的动效参数。

- [x] J5. harness 报告能解释 recipe 参数来源和风险。

- [x] J6. 所有自动化验证通过。

- [ ] J7. 真机测试通过。
