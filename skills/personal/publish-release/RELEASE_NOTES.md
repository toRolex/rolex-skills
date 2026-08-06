# Release Notes Best Practices (2026)

## Format: Keep a Changelog

遵循 [keepachangelog.com](https://keepachangelog.com) 标准，按以下分类组织：

```markdown
## v1.2.0 (2026-07-13)

### Added
- 新增的功能

### Changed
- 现有功能的变更

### Deprecated
- 即将移除的功能

### Removed
- 已移除的功能

### Fixed
- Bug 修复

### Security
- 安全漏洞修复
```

## 每条 Change 的写法

```
- 做了什么。 (#PR_NUMBER)
```

| 规则 | 示例 |
|------|------|
| 面向用户描述，不描述内部实现 | `- 搜索结果现在支持按日期排序。 (#123)` 而不是 `- 重构了 SearchController 的排序逻辑` |
| 一句话说清变化 | 一行一条，不需要多段解释 |
| 附 PR 编号 | 方便追溯完整讨论和代码 diff |
| 用句号结尾 | 保持统一 |

## 版本号

遵循 [Semantic Versioning](https://semver.org)：

| Bump | 何时用 |
|------|--------|
| Patch (`v1.0.1`) | Bug 修复，行为不变 |
| Minor (`v1.1.0`) | 新增向后兼容的功能 |
| Major (`v2.0.0`) | 不兼容的 API 变更 |

## Release Notes 的三个层级

| 层级 | 受众 | 内容 |
|------|------|------|
| **Title + 一句话摘要** | 所有人 | "v1.2.0 新增深色模式和导出 CSV 功能" |
| **分组 Change Log** | 用户和开发者 | Added/Changed/Fixed 分组 |
| **Migration Guide** | 升级用户 | 仅 Major 版本需要，说明如何迁移 |

## 完整示例

```markdown
## v2.1.0 (2026-07-13)

> 新增批量操作和 Webhook 通知，修复了 Safari 下的登录问题。

### Added
- 支持多选后批量删除和导出。 (#234)
- 任务状态变更时可通过 Webhook 通知外部系统。 (#245)

### Changed
- 默认分页大小从 20 调整为 50。 (#240)

### Fixed
- 修复 Safari 17 下 SSO 登录无限跳转的问题。 (#238)
- 修复日文环境下日期格式显示异常。 (#242)

### Security
- 升级 `jsonwebtoken` 到 v9 修复 CVE-2026-1234。 (#250)

---

**Full Changelog**: https://github.com/user/repo/compare/v2.0.1...v2.1.0
```

## 反模式

| 反模式 | 正确做法 |
|--------|----------|
| 直接贴 `git log` 输出 | 按 Added/Changed/Fixed 分组重写 |
| 写内部实现的细节 | 描述用户感知到的变化 |
| "修复了一些 bug" | 列出具体修复了什么 |
| 空 release notes 或 "minor fixes" | 每条 release 至少有一项实质内容 |
| 不附 PR 链接 | 每条 change 附 PR 编号 |
| "Various improvements and bug fixes" | 不要用，这是最糟糕的 release notes |

## 自动生成 vs 人工润色

- `git log` 可以作为**原材料**，但不能作为最终 release notes。
- PR title 通常已经接近用户语言，可以作为分组依据。
- 最终 release notes 应该由一个了解产品的人审阅，确保每条 change 对用户有意义。
