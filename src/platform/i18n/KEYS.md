# chat-shell 文案 key

> Tag：`G2_*` → `G2RAIN_SHARED`；`MS_*` → `MAIN_SHELL`；`CS_*` → `CHAT_SHELL`。
> 文案包：`VITE_I18N_TAGS=G2RAIN_SHARED,MAIN_SHELL,CHAT_SHELL`

## CHAT_SHELL（壳内专属）

| Key | 默认中文 | 位置 |
|-----|----------|------|
| CS_SET_TITLE | 系统设置 | ShellSettingsDialog |
| CS_SET_THEME | 主题 | ShellSettingsDialog |
| CS_SET_LANG | 语言 | ShellSettingsDialog |
| CS_ACC_VISITOR | 访客 | SidebarAccount |
| CS_ACC_VISITOR_INITIAL | 访 | SidebarAccount |
| CS_ACC_VISITOR_HINT | 当前浏览器无法保存访客记录，关闭页面后对话将丢失 | SidebarAccount |
| CS_ACC_LOGIN | 登录 | SidebarAccount / SsoCallback |
| CS_ACC_SETTINGS | 设置 | SidebarAccount |
| CS_ACC_MENU_ARIA | 账号菜单 | SidebarAccount |
| CS_ACC_GUEST | 游客 | SidebarAccount |
| CS_ACC_USER | 用户 | SidebarAccount |
| CS_ACC_LOADING | 加载中… | SidebarAccount |
| CS_ACC_NO_ORGAN | 未选择机构 | SidebarAccount |
| CS_CHAT_GREETING | 我能帮你什么忙吗 | ChatPanel |
| CS_CHAT_GREETING_MARK | ？ | ChatPanel |
| CS_CHAT_GREETING_NAME | ，{name}？ | ChatPanel |
| CS_CHAT_PROMPT_TEMPLATES | 试试这样提问 | ChatPanel |
| CS_CHAT_JUMP_BOTTOM | 回到底部 | ChatPanel |
| CS_CHAT_ACT_CONFIRM | 确认 | ChatInput 字典兜底 |
| CS_CHAT_ACT_REJECT | 拒绝 | ChatInput 字典兜底 |
| CS_CHAT_ACT_CANCEL | 取消 | ChatInput 字典兜底 |
| CS_CHAT_ACT_REPLY | 回复 | ChatInput 字典兜底 |
| CS_CHAT_INPUT_PH | 有问题，随便问 | ChatInput |
| CS_CHAT_AGENT | 数字员工 | ChatInput |
| CS_CHAT_AGENT_DEFAULT | 默认路由 | ChatInput |
| CS_CHAT_MODEL | 模型 | ChatInput |
| CS_CHAT_MODEL_DEFAULT | 默认模型 | ChatInput |
| CS_CHAT_SEND | 发送 | ChatInput |
| CS_CHAT_DISCLAIMER | G2rain Chat 由 AI 生成内容… | ChatInput |
| CS_CHAT_MSG_LOADING | 加载历史消息… | MessageList |
| CS_CHAT_ELAPSED | 耗时 | MessageList |
| CS_CHAT_TRACE | 追踪号 | MessageList / ProgressTimeline |
| CS_CHAT_COPY_TRACE | 复制完整追踪号 | MessageList / ProgressTimeline |
| CS_CHAT_COPY | 复制 | MessageList |
| CS_CHAT_COPIED | 已复制 | MessageList |
| CS_CHAT_PROCESSING | 正在处理 | ProgressTimeline |
| CS_CHAT_PROGRESS | 执行过程 | ProgressTimeline |
| CS_CHAT_NEW | 新对话 | ConversationList / ChatPage |
| CS_CHAT_RECENT | 最近 | ConversationList |
| CS_CHAT_LIST_LOADING | 加载中… | ConversationList |
| CS_CHAT_LIST_EMPTY | 暂无历史对话 | ConversationList |
| CS_CHAT_MORE | 更多 | ConversationList |
| CS_CHAT_COPY_ID | 复制会话 ID | ConversationList |
| CS_CHAT_COPY_ID_OK | 已复制会话 ID | ConversationList |
| CS_CHAT_COPY_FAIL | 复制失败 | ConversationList |
| CS_CHAT_DELETE_TITLE | 删除会话 | ConversationList |
| CS_CHAT_DELETE_CONFIRM | 确定删除「{title}」吗？删除后不可恢复。 | ConversationList |
| CS_CHAT_OPEN_SIDEBAR | 打开侧栏 | ConversationList / ChatPage |
| CS_CHAT_CLOSE_SIDEBAR | 关闭侧栏 | ConversationList |
| CS_CHAT_ERR_LIST | 加载会话列表失败 | ChatPage |
| CS_CHAT_ERR_HISTORY | 加载历史消息失败 | ChatPage |
| CS_CHAT_ERR_DELETE | 删除会话失败 | ChatPage |
| CS_CHAT_ERR_SEND | 发送失败 | ChatPage |
| CS_AU_ENTRY_UNAVAILABLE | 该入口暂不可用 | SsoCallback |
| CS_AU_REENTER | 重新进入 | SsoCallback |
| CS_AU_ENTERING | 正在进入应用... | SsoCallback |
| CS_AU_LOGOUT_DESC_PREFIX | 账户已在本应用退出。如需彻底退出，请访问 | Logout |
| CS_AU_IAM_SHORT | IAM 系统 | Logout |
| CS_AU_LOGOUT_DESC_SUFFIX | 。系统将在 | Logout |
| CS_AU_LOGOUT_COUNTDOWN | 秒后自动跳转。 | Logout |
| CS_REDIR_JUMP | 正在跳转... | SubAppRedirectGateway |
| CS_REDIR_TO_LOGIN | 正在跳转登录... | SubAppRedirectGateway |
| CS_REDIR_LOGIN_FAIL | 跳转登录失败 | SubAppRedirectGateway |
| CS_REDIR_OPEN_APP | 正在打开应用... | SubAppRedirectGateway |

## 字典（业务页）

| usageCode | 用途 | 是否已有 dictionary_item |
|-----------|------|--------------------------|
| RT_RESUME_ACTION | 恢复动作按钮文案（确认/拒绝/取消/回复） | dictionary_item + DICTIONARY zh/en/ja 已齐 |

## 复用（不在 CHAT_SHELL 重复造）

- `G2_BTN_*` / `G2_ERR_NO_LOGIN`
- `MS_FTR_*` / `MS_THEME_*` / `MS_HDR_*` / `MS_AU_*`
