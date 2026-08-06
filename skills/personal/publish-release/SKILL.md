---
name: publish-release
description: 当用户说发版/发布/release/publish/bump version/tag，或想从 develop 切 release 时使用。
argument-hint: "[auto-qa]"
---

# Publish Release

通过 Git Flow 从 `develop` 切 release：在 release branch 上升级版本号，向 `main` 开 PR，合并，然后将 `main` 同步回 `develop`，并为 `main` 打 tag。

## 前置条件

开始之前：

- 你处于一个配置了 `origin` 的 git 仓库中。
- `gh` CLI 已安装并完成认证。
- `main` 是受保护分支；所有 release 通过 PR 合入。
- `develop` 可以在本地合入以进行同步回写。如果 `develop` 也是受保护分支，则执行本 skill 直到 PR-to-main 步骤，然后单独从 `main` 向 `develop` 开一个 sync-back PR。
- `develop` 包含了本次 release 所需的所有内容。
- 用户已确认新版本号。默认是 patch bump（`+0.0.1`）。

## 流程

### 1. 确定新版本号

```bash
git tag --sort=-version:refname | head -3
```

以最新 tag 为基准，应用用户的 bump 规则，将新版本号记录为 `vX.Y.Z`。

完成标志：选定具体的 `vX.Y.Z`，如果与默认值不同则与用户确认。

### 2. 检测版本文件

在仓库根目录中查找携带项目版本号的文件。按顺序检查：

- `pyproject.toml`
- `package.json`
- `Cargo.toml`

记录哪些文件存在。至少必须存在一个。

完成标志：确定需要升级的版本文件列表。

### 3. 同步 develop 并创建 release branch

首先通过 `/safe-pull` 确保 `develop` 是最新的：

```bash
git checkout develop
# /safe-pull
```

然后创建 release branch：

```bash
git checkout -b release/X.Y.Z
```

完成标志：`develop` 已与远端同步；`release/X.Y.Z` branch 已存在并已 checkout。

### 4. 升级版本号

在每个检测到的版本文件中将 `version` 字段更新为 `X.Y.Z`（不带 `v` 前缀）。然后提交：

```bash
git add <version-files>
git commit -m "chore: bump version to X.Y.Z"
```

完成标志：每个检测到的版本文件都显示 `X.Y.Z`；bump commit 位于 `release/X.Y.Z` 上。

### 5. 起草 release notes

从上一个 tag 生成原始变更列表：

```bash
git log <previous-tag>..develop --oneline
```

按照 [RELEASE_NOTES.md](RELEASE_NOTES.md) 的格式编写 release notes。将 commits 分组为：

- **Added** — 新功能
- **Changed** — 现有功能的变更
- **Fixed** — bug 修复
- **Removed** — 已弃用或删除的功能
- **Security** — 安全漏洞修复

将 release notes 保存到文件以便后续使用：

```bash
cat > /tmp/release-notes-vX.Y.Z.md << 'EOF'
## vX.Y.Z (YYYY-MM-DD)

### Added
- ...

### Fixed
- ...

EOF
```

完成标志：release notes 文件已保存至 `/tmp/release-notes-vX.Y.Z.md`，可用于 PR body 和 GitHub Release。

### 6. 推送 release branch

```bash
git push -u origin release/X.Y.Z
```

完成标志：`release/X.Y.Z` 已在 `origin` 上。

### 7. 向 main 开 PR（远端）

从远端拉取最新的 `main`，然后通过 GitHub CLI 创建 PR 指向**远端** `main` branch。`gh pr create --base main` 始终解析为远端仓库的 `main` branch——**不要** checkout 或合并到本地 `main`。

```bash
git fetch origin main
gh pr create --base main --head release/X.Y.Z
```

PR body 必须包含版本升级信息和分组后的 release notes。

完成标志：从 `release/X.Y.Z` 到 `origin/main` 的 PR 已打开；PR 编号已记录。

### 8. 移交审查

停下来，报告 PR URL 和 release 摘要。用户通过 GitHub UI 或其他审批渠道审查并合并 PR——**不要**在本地合并到 `main`，也**不要**自动调用 `gh pr merge`。所有对 `main` 的合并都通过 GitHub 的远端 PR merge 进行。

完成标志：PR URL 和 release 摘要已报告给用户；agent 停止并等待合并确认。

### 9. QA 门禁

一旦 PR 被合并（merge commit 现在位于 `origin/main` 上），在打 tag 之前运行 QA。

首先生成 QA 计划（覆盖自上个 tag 以来的变更）：

```
/qa-plan
```

然后根据 ARGUMENTS 决定执行方式：

- **默认（手动 QA）**：向用户报告 QA 计划，等待用户在测试环境自行执行并通过后继续。
- **ARGUMENTS 包含 `auto-qa`**：自动执行 QA——运行完整测试套件 + 验证关键 API 端点，向用户报告结果。

无论哪种模式，发现问题时修 bug → 重跑 → 确认修复。在 QA 通过之前**不要**打 tag。

完成标志：QA 已通过（手动：用户确认 / auto-qa：测试套件 + 端点验证通过）。

### 10. 从 origin/main 拉取 merge commit 并打 tag

QA 通过后，拉取 `origin/main` 以获取 merge commit，将其 checkout 为 detached HEAD（如果需要可创建本地 tracking branch），然后打 tag。**不要**对 `main` 做任何本地修改。

```bash
git fetch origin main
git checkout main       # 必要时从 origin/main 创建本地 tracking branch
git merge --ff-only origin/main  # fast-forward 到准确的 merge commit
git tag vX.Y.Z
git push origin vX.Y.Z
```

如果本地 `main` 尚不存在，`git checkout main` 会自动从 `origin/main` 创建。如果它存在但落后了，`git merge --ff-only origin/main` 会推进它而不产生 merge commit。

完成标志：`vX.Y.Z` 已存在于 `origin` 上，并指向 `origin/main` 上的 merge commit。

### 11. 发布 GitHub Release

使用第 5 步起草的 release notes 创建 GitHub Release：

```bash
gh release create vX.Y.Z \
  --title "vX.Y.Z" \
  --notes-file /tmp/release-notes-vX.Y.Z.md
```

如果是预发布版本（alpha、beta、rc），添加 `--prerelease`。对于首个 major release 或重要里程碑，也显式添加 `--latest` flag。

完成标志：GitHub Release 已发布，包含完整的 release notes，可在 release URL 查看。

### 12. 同步回写 develop

```bash
git checkout develop
git fetch origin main
git merge origin/main --no-edit
git push origin develop
```

完成标志：`develop` HEAD 包含了版本升级和来自 `origin/main` 的已打 tag release commit。

### 13. 验证

运行以下检查并确认每项通过：

```bash
git tag --sort=-version:refname | head -3           # vX.Y.Z 是最新的
git log origin/main -1 --oneline                    # origin/main 指向该 tag
git log origin/develop -1 --oneline                 # origin/develop 与 main 保持一致
gh pr view <PR_NUMBER> --json state                 # state 为 MERGED
gh release view vX.Y.Z --json name,tagName          # release 已发布
```

完成标志：所有五项检查均返回预期结果。

### 14. 清理 release branch

```bash
/clean-branches
```

通过 `/clean-branches` 清理已合并的 `release/X.Y.Z` 本地和远端分支。

完成标志：已合并的 release branch 已从本地和远端移除。

## 参考

- **权威来源**：git tag 是规范的版本号；版本文件只是镜像。**Tag 必须始终指向 `origin/main` 上的 commit**，绝不能指向 release branch、本地 `main` 或 develop。**`origin/main` 上的每一个 commit 都必须有 tag**——main 始终处于已打 tag、可发布的状态。
- **远端优先**：所有涉及 `main` 的操作必须引用 `origin/main`（fetch、checkout tracking branch、从远端 merge-ff）。绝不要在 `main` 上直接提交或进行本地 merge commit。
- **同步回写**：打 tag 后，必须将 `origin/main` 合并入 `develop`。跳过此步骤会导致 develop 上丢失版本升级，破坏下一次 release。
- **受保护的 develop**：如果 `develop` 也是受保护分支，在第 8 步后停止，再从 `origin/main` 向 `develop` 开第二个 PR 以完成同步回写。
- **Release branch 生命周期**：创建 → 升级 → PR to main → 通过 GitHub 合并 → 在 merge commit 上打 tag → 同步回写。PR 合并后可以删除 release branch。
- **Bump 范围**：只修改 `version` 字段。将 release branch 的变更限制在版本号本身。
