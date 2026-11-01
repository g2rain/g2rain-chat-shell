# 发布记录

- [v1.0.0：知识对话主应用与 GHCR 镜像发布流程](v1.0.0.md)

源代码遵循现有 `feature/* → develop → main` 的 PR 流程。发布准备完成后，先将发布改动和发布说明合入 `main`，再在已验证的 `main` 提交创建 `v<major>.<minor>.<patch>` 标签。推送稳定版标签会触发 GHCR 镜像构建与发布；不会自动创建 GitHub Release 或部署服务。
