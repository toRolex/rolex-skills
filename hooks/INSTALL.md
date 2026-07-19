# Skill Guard Hooks — 独立安装

不依赖插件系统，clone 后复制粘贴即可。

## 安装

```bash
# 1. 链接 hook 脚本
bash scripts/link-hooks.sh

# 2. 在项目 .claude/settings.json 或 settings.local.json 中加入：
```

```json
{
  "hooks": {
    "UserPromptExpansion": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "\"$HOME/.claude/hooks/set-skill-mode.sh\""
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "\"$HOME/.claude/hooks/detect-skill-mode.sh\""
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "\"$HOME/.claude/hooks/block-code-files.sh\""
          }
        ]
      }
    ]
  }
}
```

## 效果

| Skill | 保护 |
|-------|------|
| `/wayfinder` | 禁止写 .py/.ts/.tsx/.js/.jsx 等代码文件 |
| `/grilling`, `/grill-me`, `/grill-with-docs` | 同上 |
| 其他命令 | 不受限制 |
| `.md` 文件 | 始终允许 |

## 已知边界

- 只对命令触发，自然语言说 "grill my plan" 依赖关键词检测
- 其他项目需在其 `.claude/settings.json` 中配 hooks 块
- 更新：`git pull` 即可，symlink 自动指向最新脚本
