# MotionLens 模块边界

## 定位

MotionLens 是独立于 Motion Copilot 的动效机会洞察模块。它面向设计师评审静态设计稿，核心输出是标注、理由、推荐参数、知识依据、风险诊断和评审报告。

Motion Copilot 继续保留为独立功能模块，不作为 MotionLens 的页面或流程入口。

## 模块组成

- `apps/motion-lens`：MotionLens 独立 Vite/React 页面，默认端口 `5176`。
- `packages/motion-lens-core`：稿件元素、机会点、动效预览、评审 JSON 的核心 schema 与规则。
- `packages/motion-knowledge`：动效原则、模式、案例、风险规则的结构化知识库。

## 本地命令

```bash
pnpm motion-lens:dev
pnpm motion-lens:test
pnpm motion-lens:typecheck
pnpm motion-lens:build
```

## AI 配置

MotionLens 浏览器端不接收 API key。模型调用只经过 Vite 本地 API：

- `GET /api/motion-lens/config`：返回非敏感配置，包括 endpoint、模型名、是否配置 key、超时时间。
- `POST /api/motion-lens/analyze`：上传稿件分析，返回 Motion Blueprint。

当前默认模型是 `gpt-5.5`。如果没有配置 `OPENAI_API_KEY`，模块会进入 fallback-only 状态，保留本地规则兜底。

## 当前能力

- 上传 PNG/JPG/WebP 设计稿并发起 AI 分析。
- 根据真实稿件或手动框选区域生成动效机会点。
- 展示机会点标注、理由、推荐参数、风险、知识依据。
- 提供模式化动效预览。
- 导出/导入评审 JSON。
- 导出包含标注、风险、诊断、不建议动效区域的 HTML 报告。
- 对模型输出进行质量门检查：推荐同质化、缺少知识依据、循环强调动效、时长异常、低置信度。

## 当前边界

- 真实图片评估集尚未建立，模型质量还不能做稳定结论。
- 知识库当前是静态 TypeScript 数据，不包含后台管理、在线 PDF 解析或向量数据库。
- MotionLens 不负责生成最终可上线动效组件；它负责评审建议和参数化预览。
