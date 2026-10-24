# 多用户切换

- 状态：待确认
- 范围：chat-shell 的用户列表查询与切换（含 g2rain-basis 接口改造）；用户姓名必填另行处理
- 需求编号：15

## 1. 背景

一个账号（passport）可以在多个机构下各有一个用户（user）。chat-shell 需要在账号菜单里切换到同账号下的其他用户。

## 2. 接口

不新增接口，复用两个已有接口。

| 用途 | 接口 | 说明 |
|---|---|---|
| 查询可切换用户 | `GET /basis/user/identities` | 由 `/user/user_options` 改造而来（见第 3 节），无参数，返回当前账号在当前应用中可切换的用户身份 |
| 切换 Token | `POST /auth/token`，`grantType=exchange_token`，`userId` | 后端校验：目标用户属于同一 passport、DPoP 公钥与旧 Token 一致、refresh 未过期；访客、会员禁止换票。前端已有 `sso.switchToken(userId)` |

需要确认的配置：

- chat-shell 应用的网关资源 / 控制单元放行 `/basis/user/identities`（与之前删除会话接口一样）。`/auth/token` 已在刷新时使用，无需调整。

## 3. 后端改造（g2rain-basis）

### 3.1 现状

- `/user/user_options` 目前没有任何调用方，只在 `g2rain-basis.sql` 的资源表登记过（id=64）。
- 它按当前 `passportId` 查询，语义是"当前账号在各机构下的用户身份"，不是通用的用户下拉，原名称和描述容易误用。
- 不过滤机构状态，也不判断机构是否开通、用户是否有权限，列表里会出现切不过去的用户。

### 3.2 接口调整

| 项 | 原 | 新 |
|---|---|---|
| 路径 | `GET /user/user_options` | `GET /user/identities` |
| 参数 | 无 | 无。当前应用取自请求身份（`PrincipalContextHolder.getApplicationId()`） |
| 描述 | 获取用户下拉选项 | 当前账号可切换的用户身份 |
| 返回 | `List<UserOptionVo>` | `List<UserIdentityVo>`，字段不变：`userId`、`userName`（取 `realName`）、`organId`、`organName` |

同步修改：

- `UserApi`、`UserController`、`UserService` 的方法名与描述（命名在实现时确定）。
- `g2rain-basis.sql`（`scripts/` 与 `g2rain-deploy/config/mysql/` 两份）资源表 id=64 的路径、名称、描述，并给出线上 `UPDATE` 语句。
- 网关 / 控制单元中原路径的引用（如有）。

### 3.3 过滤规则

当前应用不由前端传入：网关校验 DPoP 证明中的 `acd` 属于 Token 的 `applicationScopes` 后写入请求身份，前端无法篡改。

按当前账号查出名下全部用户（跨机构，不走数据隔离），逐个按换票规则过滤，与 `LoginTokenServiceImpl#fetchTokenContext` 一致：

1. 机构状态为 `ACTIVE`。
2. 当前应用不是默认主应用（`landing=true && canIntegrate=false`）时，还要求：
   - 机构对该应用的授权（`application_authorization`）状态为 `ACTIVATED`；
   - 用户的控制单元总数 > 0（`countRoleControlUnits`）；
   - 用户可用的控制单元数 > 0。

说明：应用授权是机构级的，控制单元是用户级的，机构开通不代表每个用户都有角色；少了这一步仍会出现"列表能切、切过去报错"。每个用户多一次计数查询，一个账号下用户很少，可以接受。

### 3.4 规则复用

第 3.3 节的判定抽成 `ApplicationEntryExaminer`（`service/impl`），列表过滤与换票校验共用，避免两边规则分叉。应用授权改用不走数据隔离的 `checkApplicationAuthorizationExists`，切换列表里的机构不是当前登录机构。

- 换票：`check()`，不满足时按原错误码抛出（`ORGAN_UNAVAILABLE`、`APPLICATION_AUTHORIZATION_MISSING`、`UNAUTHORIZED`、`BUSINESS_CAPABILITY_DISABLED`），行为不变。
- 列表：`permits()`，不满足时跳过该用户。

## 4. 查询时机

- 每次打开账号菜单时查询，与现有 `session.loadAccount()` 并行，不缓存。
  - 一个账号下用户数很少，请求很轻。
  - 刚通过邀请加入新机构，下次打开菜单即可看到。
- 启动时不查。
- 访客没有账号菜单，不查。

## 5. chat-shell 切换流程

1. `SidebarAccount.vue` 已有"机构卡 → 二级用户列表"界面，`userChoices` 目前是写死的 demo 数据，改为 `GET /basis/user/identities` 的结果。
2. 当前用户：用 Token 中的 `userId` 比对后高亮。
3. 选择其他用户 → `sso.switchToken(userId)`：
   - 成功：整页刷新回首页（与 main-shell 账号开通页一致），会话列表、当前对话、模型 / 路由选项、子应用一并重置。
   - 失败：提示后端返回的错误信息。
4. 移动端：二级列表目前靠 hover 打开，触屏（`hover: none`）改为点击展开。

## 6. 交付顺序

1. g2rain-basis：接口改名、过滤规则、规则复用、资源 SQL（已完成）。
2. 网关 / 控制单元放行新路径。
3. chat-shell：接入列表与切换（已完成）。
