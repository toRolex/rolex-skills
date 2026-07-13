---
name: uv-python
description: Guide for using UV, the Python package and project manager. Use this when working with Python projects, scripts, packages, or tools.
---

# UV Python（UV Python 管理）

`uv` 是通用 Python 工具——它用一个快速二进制文件替代了 `pip`、`venv`、`poetry`、`pipx` 和 `pyenv`。所有 Python 项目和操作**必须**使用 UV 进行管理。当用户想要创建、运行或管理 Python 代码时，使用 UV 命令。

本机是 Apple Silicon（M4）上的 macOS。

## 常用命令

| 任务 | 命令 |
|---|---|
| 创建新项目 | `uv init <name>` |
| 添加依赖 | `uv add <package>` |
| 添加开发依赖 | `uv add --dev <package>` |
| 运行脚本 | `uv run <script.py>` |
| 在项目中运行命令 | `uv run <command>` |
| 从 lockfile 同步 | `uv sync` |
| 创建虚拟环境 | `uv venv` |
| 安装 Python 版本 | `uv python install <version>` |
| 列出已安装的 Python 版本 | `uv python list` |
| 锁定项目的 Python 版本 | `uv python pin <version>` |
| 构建项目 | `uv build` |
| 发布到 PyPI | `uv publish` |

## 关键原则

- **用 `uv add` 而不是 `pip install`** —— 项目使用 `uv add` 添加依赖；在项目内绝不使用 `pip install`。
- **用 `uv sync` 处理 lockfile** —— 使用 `uv sync` 从 `uv.lock` 安装所有依赖。
- **用 `uv run` 处理单个脚本** —— `uv run script.py` 自动创建临时虚拟环境并运行脚本。一次性脚本不需要 `uv init`；UV 通过内联脚本元数据（PEP 723）处理依赖。
- **工具运行** —— `uv tool run <tool>` 在隔离的临时环境中运行工具；`uv tool install <tool>` 持久安装它。
- **优先用 `uv run` 而不是激活 venv** —— 使用 `uv run <command>` 而不是手动激活虚拟环境。
