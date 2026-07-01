# Fixture 命名规范

## 目录

所有帧间 fixture 存放于 `fixtures/frames/`。

## 命名格式

```
<场景>-<状态>.json
```

- **场景**：使用短横线分隔的英文小写关键词，描述 UI 场景类型
- **状态**：描述该帧所处的视觉/交互状态

## 示例

| 文件名 | 场景 | 状态 |
|--------|------|------|
| `info-collapsed.json` | 信息状态条 | 收起 |
| `info-expanded.json` | 信息状态条 | 展开 |
| `card-expand-collapsed.json` | 卡片展开 | 收起态 |
| `card-expand-expanded.json` | 卡片展开 | 展开态 |
| `bottom-sheet-hidden.json` | 底部弹层 | 隐藏 |
| `bottom-sheet-visible.json` | 底部弹层 | 可见 |
| `list-3-items.json` | 列表增删 | 3项 |
| `top-nav-tab-a.json` | 顶部导航 | Tab A 激活 |
| `top-nav-tab-b.json` | 顶部导航 | Tab B 激活 |

## 成对关系

帧间 morph 的 fixture 通常成对出现（from/to），通过状态后缀区分：

- `collapsed` / `expanded`
- `hidden` / `visible`
- `tab-a` / `tab-b`
- `before` / `after`

## 内容要求

每个 fixture 必须包含：
- `schemaVersion`: `"motion-copilot.frame-snapshot.v1"`
- `frameId`: 格式 `<场景>:<状态>`
- `name`: 中文可读名称
- `width` / `height`
- `elements`: 完整的节点树，保留 parent-child 关系

## 新增场景指南

1. 优先覆盖京东 App 常见交互模式
2. 每个场景至少 2 帧（首帧/尾帧）
3. 节点需包含真实尺寸和样式，不可使用占位值
4. nodeId 使用带场景前缀的短 id（如 `ce-1`, `bs-2`）避免跨文件冲突
