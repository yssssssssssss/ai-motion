# 帧间动效重构 TODO

> 唯一执行进度面。`README.md` 记录架构与阶段总览，`modules/` 记录设计细节，`CHANGELOG.md` 只记录已完成且验证过的变更。
> 任务只有在验收命令通过后才能从 `[ ]` 改为 `[x]`；被阻断时改为 `[-]` 并记录原因和恢复条件。

## 当前控制合同

- 主目标：Zero 首尾帧动效在预览和导出中保真、可单轨编辑，并保留确定性 fallback。
- 护栏：不暴露 `OPENAI_API_KEY`；不新增端口或独立服务；旧项目可打开；预览与导出使用同一份 MotionPlan。
- 回退：`motionPlan` 缺失时走既有 recipe；任何新运行时失败时不写坏保存数据。
- 慢门禁：真机和 Chromium 截帧验证只在具备 Zero MCP 与浏览器环境时执行，不能用单测替代。

## P0A 安全与质量门禁

- [x] SEC-01 收紧 `/api/zero/asset`：只允许已配置来源、拒绝重定向、限制响应体及 MIME。
  - 文件：`apps/motion-copilot/src/dev-api/zeroAssetProxy.ts`、`apps/motion-copilot/src/server/productionServer.ts`。
  - 验收：已配置的本机 Zero MCP 资源允许；未配置 host（包括私网地址）、重定向、非图片和超大响应拒绝；生产 server 回归测试通过。
  - 回退：保留 handler API，由 `allowedOrigins` 缺省时拒绝外部 URL，不恢复开放代理。
  - 证据（2026-07-21）：`pnpm --filter @motion-copilot/app test -- src/dev-api/zeroAssetProxy.test.ts src/server/productionServer.test.ts`（16 tests）；`pnpm motion-copilot:typecheck`；相关文件 Prettier 检查通过。
- [x] QLT-01 修复根级 ESLint，并把 `lint + typecheck + test` 固化为根级检查命令。
  - 验收：`pnpm lint`、`pnpm typecheck`、`pnpm test` 通过。
  - 回退：仅静态质量改动，无运行时回退成本。
  - 证据（2026-07-21）：三条根命令全部通过；补齐 `jd-horizontal-switch` 缺失的 layer manifest 契约后，内置组件 48 tests 通过。

## P0B MotionPlan 适配层

- [x] MP-01 新增 `compileMotionPlanFromRecipe`，把现有 recipe 结果映射为 `MotionPlan`。
  - 文件：`packages/motion-copilot-core/src/zeroLayerMorph/compileMotionPlan.ts`、`zeroLayerMotionRecipes.ts`、`index.ts`。
  - 验收：同一 fixture 的 recipe 与 MotionPlan 时间窗、终态和绑定一致。
  - 证据（2026-07-21）：新增 `compileMotionPlan.test.ts` 锁定时间窗、端点、easing、node 绑定；core 184 tests 通过。
- [x] MP-02 新增 `deriveCompositionFromMotionPlan`，旧 `CompositionStep` 只作为兼容视图。
  - 验收：旧保存项目和无 `motionPlan` 项目继续可预览、可导出。
  - 证据（2026-07-21）：主 recipe 路径已先生成 MotionPlan 再投影兼容步骤；motion-copilot app 92 tests 通过。
- [x] MP-03 补 MotionPlan 不变量：轨道唯一、关键帧完整、时间窗合法、用户轨道不可被重生成覆盖。
  - 验收：core 单测覆盖合法、非法、恢复、recipe fallback 与用户编辑保留。
  - 证据（2026-07-21）：normalize 新增端点补齐、每 layer 去重、stage 时间窗扩展和 user 优先；归一化及适配层 13 tests 通过。

## P1 混合渲染与同源导出

- [x] RENDER-01 让渲染和导出消费 `renderMode`；复杂 vector/boolean/image 使用 SVG 或 PNG asset。
  - 证据（2026-07-21）：`zeroLayerPaintStyle` 统一预览/导出样式；`renderMode: "image"` 与 image layer 以 asset 渲染。
- [x] RENDER-02 合成多 fill、多 stroke、基础 rotation/blend 与动效 transform，避免互相覆盖。
  - 证据（2026-07-21）：新增 `zeroLayerPaint.test.ts` 覆盖多 fill、多 stroke、effect、rotation 和 blend；Zero 图层导出视觉门禁通过。
- [x] RENDER-03 新增纯 `sampleMotionPlan` 与 CSS keyframe 编译器，预览和导出共用一份轨道语义。
  - 证据（2026-07-21）：`motionPlanRuntime.ts` 提供采样和 keyframe 编译；生成路径由 MotionPlan 投影兼容步骤，现有预览和 exporter 因此共用轨道时间窗；新增 2 个 runtime 测试。
- [x] RENDER-04 建立 0/25/50/75/100% 截帧回归，首尾帧为像素硬门禁。
  - 验收：`pnpm verify:zero-visual-export` 通过；中间帧无闪烁、越界或尾帧瞬切。
  - 证据（2026-07-21）：脚本默认采样 0/25/50/75/100%，0 和 100% 必须提供参考图且执行像素差异门禁；中间帧支持 `--baseline-dir` 与 `--update-baseline`。core 回归通过该脚本的五检查点路径。

## P2 物理运行时与 P4 可编辑 UI

- [x] RUN-01 用浏览器 WAAPI 执行 MotionPlan；支持 ease、spring、path、rotation 和 reduced-motion fallback。
  - 证据（2026-07-21）：`motionPlanRuntime.ts` 统一采样、关键帧烘焙与 CSS；React 预览播放时走 WAAPI，暂停/拖动走纯采样，HTML 导出和 `prefers-reduced-motion` 落在尾帧。
- [ ] UI-01 从 `App.tsx` 提取帧间工作区、MotionPlan 编辑状态和时间轴组件。
- [x] UI-02 支持单轨 delay、duration、关键帧、曲线与 personality 编辑；保存为 `source: "user"`。
  - 验收：单轨编辑不重算其他轨道；重新生成保留用户轨道；app 测试与手工预览通过。
  - 证据（2026-07-21）：`MotionPlanEditor` 已接入 Zero 原生帧间工作台；真实浏览器确认单轨编辑器、delay/duration、AI 编排入口和时间轴并存。`patchMotionPlanTrack` 只提升目标轨道为 `source: "user"`。

## P3 LLM 编排

- [x] LLM-01 定义严格 `MotionPlanDraft` schema，LLM 只输出意图、轨道选择和节奏建议。
- [x] LLM-02 用确定性 assembler 绑定 nodeId、约束时间窗和终态；非法输出回退 recipe。
- [x] LLM-03 比较候选方案中间采样，拒绝仅标签或 easing 不同的重复方案。
  - 验收：断网/超时/非法 JSON 不破坏项目；三种 personality 的中间帧可量化区分。
  - 证据（2026-07-21）：服务端 `POST /api/copilot/zero-motion-plan` 使用 strict schema；assembler 不接受 nodeId、坐标、CSS 或原始关键帧；客户端在 25/50/75% 比较候选，不通过则保留规则方案。

## 收尾门禁

- [x] REL-01 完整回归：`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`。
  - 证据（2026-07-21）：四条根命令通过；motion-copilot app 100 tests、core 195 tests 通过。
- [-] REL-02 在具备 Zero MCP 与浏览器的环境运行视觉脚本和真机检查清单。
  - 已完成：浏览器工作台核验、fixture 五检查点采样、`pnpm verify:zero-motion`。
  - 恢复条件：提供真实 Zero 导出 HTML、首尾参考 PNG/SVG 与认可的 25/50/75% baseline 后，运行 `pnpm verify:zero-visual-export -- --html <export.html> --from <from.png> --to <to.png> --baseline-dir <dir>`。
- [x] REL-03 更新 `README.md`、模块状态和 `CHANGELOG.md`，归档已完成任务证据。
