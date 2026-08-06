# Release Note 格式规范

每次 GitHub Release 必须遵循以下中文格式，使用 `gh release create` 或 `gh release edit` 发布。

## 模板

```markdown
## 变更内容

### ✨ 新功能
- <功能简述>

### 🐛 问题修复
- <修复简述>（无则写"无"）

### 📚 文档
- <文档变更简述>（无则写"无"）

### 🧪 测试
- <测试结果摘要>

### 🧹 杂项
- <构建/配置类变更>（无则写"无"）

## 摘要

<一段话概述本版本的核心变更，2-4 句>

## 升级指南

1. 拉取最新代码：`git pull origin main`
2. <项目特定的升级步骤>
3. 重启服务：<启动命令>

---

**完整变更**: https://github.com/<owner>/<repo>/compare/<previous-tag>...<new-tag>
```

## 示例

```markdown
## 变更内容

### ✨ 新功能
- JobRecord 新增 skip_subtitle 和 auto_approve 字段，支持无字幕输出和全自动模式
- 媒体桥和主控制器支持可选 srt_path，skip_subtitle=True 时跳过字幕 filter
- 控制面 auto_tick 支持 skip_subtitle 跳过字幕阶段和 auto_approve 自动审核推进
- 新增批量创建接口 POST /api/projects/{id}/jobs/batch，每 Job 可独立配置文案和字幕
- 前端 ProjectWorkbench 新增批量创建模式，支持 radio 切换单个/批量（2-20 个 Job）
- JobTable 新增序号列和多选导出（File System Access API）

### 🐛 问题修复
- 修正预览端点响应格式
- 移除 TTS 预览接口冗余的 Authorization 头

### 📚 文档
- 更新 TTS 模型支持说明

### 🧪 测试
- 后端 329 passed（1 个既有基线失败与本版本无关）
- 前端 tsc --noEmit 零类型错误

### 🧹 杂项
- 更新 app_config.json，添加 optimize_text_preview 配置

## 摘要

本版本包含两大块：MiMo TTS 模型适配和批量模式/无字幕输出链路。JobRecord 新增 skip_subtitle 和 auto_approve 字段，控制面 auto_tick 和 final_review 均已配合支持；前端 ProjectWorkbench 和 JobTable 补齐批量操作 UI。

## 升级指南

1. 拉取最新代码：`git pull origin main`
2. 如有自定义 app_config.json 或 TTS 配置，请参考 .env.example 同步
3. 前端如使用开发模式：`cd frontend && npm install && npm run build`
4. 重启 control_plane：`uv run python -m apps.control_plane`

---

**完整变更**: https://github.com/toRolex/ai-video-pipeline/compare/v0.3.2...v0.3.3
```

## 规则

- **分类固定**：新功能 / 问题修复 / 文档 / 测试 / 杂项，不可省略或改名
- **无变更时写"无"**：不要留空或删除该分类
- **序号列表**：每项以 `- ` 开头，描述简明、用现在时
- **摘要**：概括核心变更，2-4 句，不重复列举
- **升级指南**：给出具体的操作命令，不写泛泛的"升级即可"
- **完整变更链接**：尾部必须带 `v<旧>...v<新>` compare 链接
- **版本号格式**：统一用 Semantic Versioning，tag 为 `v<major>.<minor>.<patch>`
