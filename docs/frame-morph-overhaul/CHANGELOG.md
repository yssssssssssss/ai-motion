# 帧间动效重构 · 实施变更记录

> 统一过程管理目录：`docs/frame-morph-overhaul/`。所有过程文件集中于此，不分散。
> 本文件是总记录：每完成一个模块更新一次，带时间戳，记录「改了什么 / 实现了什么 / 如何调试还原」。
> 方案蓝图见：[`../superpowers/plans/2026-07-13-frame-morph-overhaul.md`](../superpowers/plans/2026-07-13-frame-morph-overhaul.md)

---

## 背景与总方向

motion-copilot「帧间动效」(zeroLayerMorph) 重构。三痛点根因与方向决策见蓝图。

- 方向：混合渲染 + LLM 编排 + 物理运行时 + 可编辑 track；规则引擎降为 fallback。
- 阶段：P0 数据地基 → P1 混合渲染 → P2 物理运行时 → P4 可编辑 UI → P3 LLM 编排。

### Zero MCP 实测结论（2026-07-13）

用探针脚本验证 Relay 运行时（真实节点 `28:19`，16 图层）：

- 富样式数据源**全部可读**：rotation / blendMode / letterSpacing / fontName.style / textCase / textDecoration / lineHeight / 渐变 gradientStops+gradientTransform / imageHash。当前 bridge 只是没提取。
- `node.exportAsync({format:"SVG_STRING"})` 与 PNG **全节点可用**（实测 SVG 2740B、PNG 12086B）。→ P1 混合渲染切图可行。
- 结论：P0 / P1 均无前置阻塞。"图标/矢量/渐变还原不了"的根因是 `zero-mcp-layer-bridge.mjs` 提取脚本过于保守（`assets:[]` 空导出、渐变丢 stops、富样式不提取）。

---

## 变更记录

### [2026-07-21] P1-P4 收口 · MotionPlan 运行时、编辑器与 LLM 编排

**模块**：`packages/motion-copilot-core/src/zeroLayerMorph/`、`apps/motion-copilot/src/features/zeroLayerMorph/`

**改了什么**

- 预览、WAAPI 和导出共用 MotionPlan 采样/烘焙语义；spring、polyline path、rotation 与 reduced-motion 均有确定性回退。
- HTML exporter 对规则轨道继续编译 expression strategy，避免新 MotionPlan 通道压平下拉揭示、列表推开等视觉差异；用户、LLM、path 与 spring 轨道使用 MotionPlan keyframe 编译器。
- 单轨编辑器已挂入 Zero 原生帧间工作台，可编辑类型、delay/duration、曲线、首尾关键帧与 personality；局部编辑只提升该轨道为 `source:"user"`。
- 新增严格 MotionPlanDraft 服务端编排链路，模型只输出受限的意图与节奏建议；assembler 固定图层绑定和空间约束，失败时保留规则方案，并用 25/50/75% 采样拒绝重复候选。
- 视觉脚本默认采集 0/25/50/75/100%，首尾帧为硬像素门禁，中间帧支持 baseline 比较与更新。

**验证**：`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`、`pnpm verify:zero-motion` 均通过；浏览器确认单轨编辑器、时间轴、Zero 图层预览与 AI 编排入口同时可见。

**遗留**：真实设备/真实 Zero 首尾参考图尚未提供，故五检查点脚本的“真实素材 baseline”验收仍保持待执行，不以 fixture 或单测替代。

### [2026-07-21] P1 · Zero 混合渲染样式消费

**模块**：Zero 图层预览与 standalone HTML exporter

**改了什么**

- 新增共享 `zeroLayerPaintStyle`，让 React 中间预览与 HTML 导出用同一规则编译 fill、stroke、effect、base rotation 和 blend mode。
- 多 fill 使用 CSS 多背景合成；额外 stroke 转为 inset shadow；复杂 vector/boolean/image 的 `renderMode: "image"` 使用 bridge 输出的 SVG/PNG asset。
- 预览补齐 letterSpacing、fontStyle、textDecoration、textTransform、rotation、blendMode 与多个 effect 的消费；移除重复节点渲染。
- 导出层内联 style 现在经 HTML 属性转义，避免 asset URL 或 CSS 内容破坏文档结构。
- 新增无 DOM 的 MotionPlan 采样器和 CSS keyframe 编译器；现有 preview/export 通过 MotionPlan → CompositionStep 兼容投影共享轨道窗口语义。
- Inspector 修改 Zero 图层片段的时间、状态或 easing 时，已写入该 layer 的 `source: "user"` MotionPlan 轨道，重新生成不会覆盖它。

**实现了什么**：Zero MCP 已提供的富样式与 asset 不再在预览/导出阶段被缩减为 `fills[0]` 和 `strokes[0]`，中间态保留更多真实设计信息。

**验证**：新增 `zeroLayerPaint.test.ts`、`motionPlanRuntime.test.ts`；motion-copilot-core 189 tests（含视觉导出门禁）、app 92 tests、production build、app/core typecheck 和根级 lint 通过。

**状态**：RENDER-01/02/03 已完成；下一步补 0/25/50/75/100% 截帧硬门禁与 WAAPI 运行时。

---

### [2026-07-21] P0B · MotionPlan recipe 适配层

**模块**：`packages/motion-copilot-core/src/zeroLayerMorph/`

**改了什么**

- 新增 `compileMotionPlanFromRecipe` 与 `deriveCompositionFromMotionPlan`，将规则 recipe 编译为每 layer 一条可持久化轨道，并投影为现有 CompositionStep 消费者可用的兼容视图。
- `compileZeroLayerMotionComposition` 与 `applyZeroLayerMotionRecipe` 已切到“先 MotionPlan，后兼容步骤”的桥接主链，计划写入 `visualSource.motionPlan`。
- 归一化增加完整性不变量：空轨道丢弃、关键帧补齐 0/1、按 layer 去重、user 优先、stage 时长覆盖全部轨道时间窗。
- 新增适配层测试，验证 recipe 的窗口、端点、easing 和 node 绑定能够往返，且重新生成不会覆盖 user 轨道。

**实现了什么**：动效不再仅是一次性的 recipe 产物；保存数据已有稳定 MotionPlan 锚点，同时预览、导出和旧项目继续复用成熟的 CompositionStep 路径。

**如何调试/还原**：查看 `visualSource.motionPlan`。删除该可选字段后，旧 recipe 路径仍然可用；代码回退时应同时回退适配函数与两个接入点，避免新旧轨道事实不一致。

**验证**：motion-copilot-core 184 tests、motion-copilot app 92 tests、`pnpm lint` 和对应 typecheck 通过。

**状态**：已完成。下一步进入 P1 混合渲染与同源导出。

---

### [2026-07-21] P0A · Zero asset 代理安全收口

**模块**：`apps/motion-copilot` 服务端 Zero asset 代理

**改了什么**

- `/api/zero/asset` 从开放 URL 代理收紧为来源白名单；缺省配置拒绝所有远程 URL。
- 开发与生产路径均从 `ZERO_MCP_HTTP_URL` 和可选的 `ZERO_ASSET_ALLOWED_ORIGINS` 构造可信来源；可选 `ZERO_ASSET_MAX_BYTES` 配置响应大小上限，默认 5 MiB。
- 上游请求禁止跟随重定向，只接受 SVG、PNG、JPEG、WebP，并在 `Content-Length` 和流读取阶段双重限制响应体。
- 新增 handler 回归测试，覆盖允许图片、未允许来源、重定向、非图片、声明或流式超限、HEAD；生产服务测试显式验证受信来源可以代理。

**实现了什么**：Zero 本机桥接资产仍可在显式配置后正常显示，同时浏览器请求不再能借由应用访问任意地址或透传任意内容。

**如何调试/还原**：用 `ZERO_ASSET_ALLOWED_ORIGINS` 追加逗号分隔的可信来源；未配置时返回 403。若需回退代码，回退本条涉及的 handler、开发插件和生产入口改动；不要恢复开放代理行为。

**验证**：`pnpm --filter @motion-copilot/app test -- src/dev-api/zeroAssetProxy.test.ts src/server/productionServer.test.ts`（16 tests）与 `pnpm motion-copilot:typecheck` 通过，相关文件 Prettier 检查通过。

**状态**：已完成。下一步单独处理根级 ESLint 门禁（QLT-01）。

---

### [2026-07-21] P0A · 根级质量门禁恢复

**模块**：ESLint 配置、跨产品线静态清理、内置组件 manifest

**改了什么**

- 为 `scripts/` 声明 Node 20 与 Chrome CDP 执行片段所需的全局变量，消除错误的未定义全局报错，不在脚本内添加分散的禁用注释。
- 删除不可达或未使用实现，修正 React Hook 依赖、正则、类型断言与无效赋值，保持原有运行时语义。
- 补齐 `jd-horizontal-switch` 的三份可替换图片参数和六个实际视觉 layer，恢复非原子代码组件的 manifest 契约。

**实现了什么**：根级 lint、类型检查与递归测试重新成为可用门禁，组件元数据与真实 HTML/CSS 图层对应，不再由测试空指针掩盖契约缺失。

**验证**：`pnpm lint`、`pnpm typecheck`、`pnpm test` 全部通过；内置组件 48 tests、motion-copilot-core 181 tests、core 154 tests 均包含在递归回归内。

**状态**：已完成。下一步进入 P0B 的 MotionPlan 适配层。

---

### [2026-07-13 18:42] P0 起步 · 扩展 ZeroLayer schema 富样式字段

**模块**：`packages/motion-copilot-core/src/zeroLayerMorph/schema.ts`

**改了什么**

- `ZeroLayerTextStyle` 新增可选字段：`letterSpacing?: number`、`fontStyle?: "normal"|"italic"`、`textDecoration?: "none"|"underline"|"line-through"`、`textCase?: "none"|"upper"|"lower"|"capitalize"`。
- （待续本条目）`ZeroLayerNode` 计划新增：`rotation?: number`、`blendMode?: string`、`renderMode?: "dom"|"image"`。

**实现了什么**：为富样式还原提供数据结构承载位（全部可选，向后兼容，旧快照不受影响）。

**如何调试/还原**：`git diff packages/motion-copilot-core/src/zeroLayerMorph/schema.ts`；回滚只需删除新增字段行。字段全可选，删除不影响既有逻辑。

**状态**：进行中。下一步补 `ZeroLayerNode` 字段 → normalize 承接 → render 使用 → bridge 提取。

---

### [2026-07-18] Recipe 清单化改造落地 + 过程文档归档 + lint 清理（本地提交 `7cb79d4`）

**模块**：`zeroLayerMorph`(recipe/推荐/表达策略)、schema、过程文档

**改了什么**

- 新增 `zeroLayerRecipeManifests.ts`：recipe 携带结构化元数据 `intent`/`targets`/`restraint`/`bestFor`/`avoidWhen`。
- 推荐器 `zeroLayerRecipeRecommender.ts` 收敛到 manifest 驱动，精简散落打分逻辑(-158 行)。
- 重写 `zeroLayerMotionRecipes.ts`(±450)、扩展 `zeroLayerExpressionStrategies.ts`(+224)。
- schema 富样式承载字段(P0 功能1/2)一并纳入本次提交。
- 归档帧间动效重构蓝图与 P0-P4 过程文档;补 `AGENTS.md`;`.gitignore` 忽略 `.pnpm-store/` 与 `.tmp-*`。
- lint 清理:误命名的 `use*` 辅助函数改名(`useFramePair`→`applyFramePair`、`useFrameMorphFixtureIds`→`stubFrameMorphFixtureIds`),删死代码与未用 import。

**实现了什么**：为「差异化编排」提供了 recipe 元数据地基——manifest 是 P0 数据地基的合理前奏,但**不等同**蓝图 P0 功能3/4(`MotionPlan` 动效一等数据仍未开工)。

**如何调试/还原**：`git show 7cb79d4`;回滚整条提交 `git revert 7cb79d4`。

**验证**：motion-copilot-core 171/171、app 87/87 全绿,ESLint 干净。

**状态**：已完成(本地)。下一步进入 P0 功能3——`MotionTrack`/`MotionPlan` 数据模型。

---

### [2026-07-18] P0 功能3 · 动效一等数据模型 MotionTrack / MotionPlan

**模块**：`packages/motion-copilot-core/src/zeroLayerMorph/`(schema + normalizeMotionPlan)

**改了什么**

- `schema.ts` 新增动效一等数据类型:`MotionTrackKind`/`MotionTrackSource`/`MotionKeyframe`/`MotionPhysics`(spring|ease)/`MotionPersonality`/`LayerMotionTrack`/`MotionPlan`,`ZeroLayerMorphSource` 增 `motionPlan?`(全部可选/新增,向后兼容)。
- 新增 `normalizeMotionPlan.ts` + `MOTION_PLAN_SCHEMA_VERSION`:持久化 restore 的校验/钳制/排序归一化,无效输入返回空 plan 不抛异常,幂等。
- 新增测试 `test/normalizeMotionPlan.test.ts`(10 例,需求驱动)。index.ts 导出。

**实现了什么**：让动效从「spec 确定性推导的临时产物」升级为可持久化、可局部编辑的一等对象——P2 物理运行时与 P4 可编辑 UI 的数据地基。此步只落数据模型与归一化,尚未接入编译链(功能4)与渲染。

**如何调试/还原**：`git diff` schema.ts / normalizeMotionPlan.ts / index.ts;回滚删除新增类型块与 normalizeMotionPlan.ts,`motionPlan` 字段可选删除不影响既有逻辑。

**验证**：motion-copilot-core typecheck 干净、181/181(新增 10)、ESLint 干净。

**状态**：已完成(本地)。下一步 P0 功能4——`compileMotionPlan` 适配层(现有 recipe 输出 → MotionPlan)。
