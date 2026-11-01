# 部署

## 构建（静态）

```bash
# 确保 CONTEXT_PATH / 端口已是具体值
npm ci
npm run build
```

产物位于 `dist/`，静态资源以 `VITE_CONTEXT_PATH` 为 `base`。

## 容器镜像

构建依赖 npm Registry 上的 `@g2rain/*@1.0.0`；镜像内执行 `npm ci` / `npm install`，不再拷贝本地 kits 制品。

```bash
./build.sh --tag 1.0.0
# 等价：docker build -t ghcr.io/g2rain/g2rain-chat-shell:1.0.0 .
```

### GitHub Container Registry（GHCR）发布

镜像地址为 `ghcr.io/g2rain/g2rain-chat-shell:<tag>`。本地 `build.sh` 与 CI 都使用根目录 `Dockerfile`；镜像运行在 OpenResty 上，入口为 `/docker-entrypoint.sh`，监听 `8080`，并写入 OCI 源仓库、版本、提交和许可证元数据。与 main-shell 一样，构建上下文包含已跟踪的 `.env.production`，供 Vite 读取 `/chat` 等构建配置；其中 SSO 地址和匿名接入码仅为运行时占位符，实际值由容器环境注入。其他 `.env*` 本地配置和整个 `lua/keys/` 仍被排除。

工作流位于 `.github/workflows/image.yml`。它只在推送严格格式的稳定版标签（如 `v1.0.0`）时运行，不响应普通分支推送，也没有手动运行入口。工作流校验标签格式、标签提交属于 `main` 历史、以及 `docs/releases/v1.0.0.md` 存在，然后执行 `npm ci` 和 `npm run build`。本项目没有独立测试脚本，因此完整可用构建即为当前自动验证范围。

构建成功后，工作流使用 GitHub 自动提供的 `GITHUB_TOKEN` 推送 `1.0.0` 和 `sha-<完整提交 SHA>`；不会创建 GitHub Release、部署服务或更新 `latest`。权限仅为 `contents: read` 和 `packages: write`。仓库/组织仍须允许 Actions 创建和写入该容器包；若已有包，也须授予本仓库 Actions 写权限。

现有分支流程为 `feature/* → develop → main`。先把发布改动和 `docs/releases/v<版本>.md` 按该流程合入 `main`，在经过验证的 `main` 提交上创建并推送标签：

```bash
git tag v1.0.0
git push origin v1.0.0
```

首次成功推送后，如需允许匿名拉取，请在 GitHub 仓库右侧 **Packages → g2rain-chat-shell** 打开包页面，进入 **Package settings → Change visibility → Public**，输入包名确认。此设置对同一包的后续版本持续生效，通常只需一次。若组织策略禁用该操作，请联系组织管理员授予权限或代为设置。公开镜像可被任何人拉取，绝不能包含密钥、Token 或私有数据。

产物镜像需在 `g2rain-deploy` 的 `services.conf` / Compose 中登记后，由 `./update.sh <service>` 拉取构建并启动。入口路径示例：`/admin/`。

## OpenResty 镜像（含 Application-DPoP）

模板提供 `Dockerfile` + `nginx/default.conf.template` + `lua/`：

1. 本地生成密钥：`./scripts/generate-sign-keys.sh`（或 `scripts/generate-sign-keys.ps1`）
2. 将真实 **IAM** 公钥写入 `lua/keys/iam-public-key.pem`（勿提交）
3. 构建镜像时 **不** 把私钥打进层；运行时由 deploy 挂载 `config/<project>/keys`
4. 暴露 `/lua/sign_code`、`/keys/iam-key-id`、`/keys/iam-public-key`（另有 Context Path 前缀变体）

本地签名侧车（开发）：

```bash
docker compose -f docker-compose.sign.yml up --build
```

开发环境可将 `VITE_BACKEND_ORIGIN` 指向签名侧车（仅测签名）或指向同时提供 `/admin/api`、`/admin/auth`、`/admin/lua` 的上游（与 main-shell 同款）。在 deploy 栈内由本容器 OpenResty 提供签名，无需侧车。

## Nginx 纯静态示例

参考 `nginx/default.conf.example`（无 Lua）。生产签名必须用 OpenResty 模板或等价边缘。

## 检查清单

- [ ] Context Path 与网关入口文档一致
- [ ] 私钥仅 volume / secret 注入，未进 Git / 镜像层
- [ ] 静态资源 404 回退正确
- [ ] 子应用 `entry` 仅来自受信配置
- [ ] 生产 `SSO_BASE_URL` 已注入（`env-config.js`）
- [ ] 需开放匿名访问时：deploy `.env` 已设 `CHAT_ANONYMOUS_ENTRY_KEY`，容器内映射为 `ANONYMOUS_ENTRY_KEY` 并写入 `env-config.js`；不需要则留空
