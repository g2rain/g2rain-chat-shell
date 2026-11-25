# 回复附件与图表渲染

- 状态：已完成
- 范围：chat-shell 对话消息渲染 Runtime 下发的回复附件；报告中的图表块渲染为图表
- Context Path / applicationCode：`/chat` / `g2rain-chat-shell`（不变）
- 布局、Workspace、子应用契约、SSO / Token、部署：无影响

## 1. 背景

Runtime 的能力工具可以为本轮回复添加附件（目前只有 `REPORT` 一种：Markdown 报告，可含图表块）。附件随 `RESULT` 事件下发，也在历史消息接口中返回。数据结构与报告格式以 Runtime 的 `docs/SSE_EVENTS.md`（附件、`REPORT`、`chart` 图表块）为准。

## 2. 数据

- 消息模型与 `RESULT` 事件增加 `attachments?: { type: string; title: string; content: string }[]`；历史消息接口返回同名字段。
- 无附件时字段不出现。

## 3. 渲染

1. 回复气泡下方逐个渲染附件；`REPORT` 以卡片展示：卡片头为标题与「展开 / 收起」，缺省只展开第一个；正文用 markdown-it 渲染。未知类型不渲染。
2. 图表：为附件正文单独创建一个 markdown-it 实例，增加 `chart` 围栏规则，输出占位元素并携带 JSON；组件挂载后解析 JSON，用 ECharts 渲染柱状（`BAR`）、折线（`LINE`）、饼图（`PIE`），按需引入；窗口尺寸变化时重绘，组件卸载时销毁实例。JSON 不合法或 `kind` 未知时原样显示代码块。
3. 回复正文的 markdown-it 实例不加 `chart` 规则，正文中的同名代码块按普通代码显示（避免模型在正文中伪造图表）。
4. 图表与卡片样式只用 `--g2-*` 主题变量，亮色、暗色主题下都可读。
5. 界面文案走国际化：`CS_CHAT_ATTACHMENT_EXPAND`（展开）、`CS_CHAT_ATTACHMENT_COLLAPSE`（收起），文案已在 Infra 的 `UI_MESSAGE` / `CHAT_SHELL` 中登记。

## 4. 依赖

- 新增 `echarts`，按需引入（`echarts/core` + 柱状、折线、饼图及所需组件、Canvas 渲染器）。

## 5. 不做

- 报告导出、下载。
- 修改其他前端项目。

## 6. 验收

- `npm run build`（含 `vue-tsc` 类型检查）通过。
- 手工：开发环境模拟数据中放一个含柱状图、折线图、饼图、表格的报告样例，检查渲染；非法 JSON 显示为代码块；正文中的 `chart` 代码块不渲染为图表；刷新后历史消息中的报告正常显示；切换亮色、暗色主题后图表可读。
