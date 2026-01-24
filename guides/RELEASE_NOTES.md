# Auto-Claude v2.7.5 发布说明

**发布日期**: 2024-01-XX
**版本号**: 2.7.5

---

## 🎉 主要亮点

### 全新 API Profile 配置管理系统

Auto-Claude v2.7.5 引入了革命性的 API Profile 配置管理功能，让您无需编辑配置文件即可轻松管理多个 API 端点。

**核心功能**:
- ✅ **图形化配置管理** - 在 UI 中创建、编辑、删除 API 配置
- ✅ **一键切换** - 无需重启即可切换不同的 API 端点
- ✅ **连接测试** - 内置测试功能验证配置有效性
- ✅ **自定义模型映射** - 为每个 Profile 配置不同的模型名称
- ✅ **完整中文支持** - 适合中国用户使用国内大模型

**适用场景**:
- 🇨🇳 **中国用户**: 通过 new-api 连接智谱AI、百度文心、阿里通义等国内大模型
- 🏢 **企业用户**: 统一管理内部 API 网关和自托管实例
- 👨‍💻 **开发者**: 快速在测试/开发/生产环境之间切换
- 🌐 **多平台用户**: 支持 OpenRouter、litellm 等聚合服务

**使用方法**:
1. 打开 Auto Claude UI → 设置 → API Profiles
2. 点击"添加配置"创建新 Profile
3. 填写 Base URL 和 API Key
4. 测试连接并激活

详细文档: [API Profiles 配置指南](API_PROFILES.md)

---

## 📦 安装包下载

### Windows

**安装程序** (推荐):
- 文件: `Auto-Claude-2.7.5-win32-x64.exe`
- 大小: 约 150 MB
- 特点:
  - 包含完整 Python 3.12.8 运行时
  - 所有依赖已预装
  - 支持自定义安装路径
  - 自动创建桌面和开始菜单快捷方式

**便携版**:
- 文件: `Auto-Claude-2.7.5-win32-x64.zip`
- 大小: 约 200 MB
- 特点:
  - 解压即用，无需安装
  - 适合移动设备或受限环境
  - 可放置在任意目录

### macOS

- **Intel Mac**: `Auto-Claude-2.7.5-x64.dmg`
- **Apple Silicon**: `Auto-Claude-2.7.5-arm64.dmg`
- **Universal**: `Auto-Claude-2.7.5-universal.dmg` (推荐)

### Linux

- **AppImage**: `Auto-Claude-2.7.5-x86_64.AppImage` (通用格式)
- **Debian/Ubuntu**: `auto-claude_2.7.5_amd64.deb`

---

## 🔧 系统要求

**最低要求**:
- **Windows**: Windows 10 或更高版本（64位）
- **macOS**: macOS 10.13 或更高版本
- **Linux**: Ubuntu 18.04 或更高版本

**推荐配置**:
- **内存**: 8 GB RAM
- **磁盘**: 1 GB 可用空间
- **网络**: 稳定的互联网连接

**依赖**:
- Python 3.12.8（已包含在安装包中）
- Git（用于 worktree 功能，需要单独安装）

---

## 📝 完整更新日志

### ✨ 新增功能

#### API Profile 配置管理系统
- **客户端 API 配置管理**: 新增完整的 API Profile 管理系统，支持在 UI 中配置和切换多个 API 端点
- **一键切换功能**: 无需编辑环境变量，在设置中一键切换不同的 API 配置
- **连接测试**: 内置连接测试功能，验证配置是否有效
- **自定义模型映射**: 每个 Profile 可以配置自定义的模型名称映射
- **完整中文支持**: API Profile 界面完全支持中文

#### 支持的使用场景
- **new-api 集成**: 支持通过 new-api 代理连接中国大模型（智谱AI、百度文心、阿里通义等）
- **litellm 网关**: 支持 litellm 多提供商网关
- **OpenRouter**: 支持 OpenRouter 统一 API
- **自托管实例**: 支持企业内部 Claude 实例

### 🛠️ 改进

- **构建体积优化**: Python 依赖打包体积减少 74.6%（445 MB → 111 MB）
- **自动化测试**: 添加构建产物验证脚本（test-dist.ps1, test-dist.js）
- **体积分析工具**: 添加 analyze-bundle.js 监控包大小分布
- **文档改进**: 新增完整的构建文档和发布流程说明

### 🐛 Bug 修复

- 修复 `ThemeSelector.tsx` 语法错误（缺少注释结束标签）

### 📦 构建系统

- 添加 Windows 安装包构建（NSIS + ZIP）
- 优化 Python 3.12.8 运行时打包
- 自动验证关键依赖包（claude-agent-sdk, graphiti-core 等）
- 新增构建文档 `docs/BUILDING.md`
- 新增测试清单 `docs/TEST_CHECKLIST.md`
- 新增安装指南 `docs/INSTALLATION.md`

### 🔐 安全性

- API Key 加密存储在配置文件中
- 配置文件权限控制（600）
- 输入验证（URL 格式、Token 格式）

### 📚 文档

- 新增 `guides/API_PROFILES.md` - 完整的 API Profile 配置指南
- 更新 `CLAUDE.md` - 添加 API Profiles 使用说明
- 更新 `.env.example` - 添加 new-api 配置示例
- 新增中文翻译 `zh-CN/settings.json` - API Profile 界面中文化

### 📊 技术细节

- **配置存储**: `~/.config/Auto-Claude/profiles.json`（Windows: `%APPDATA%\Auto-Claude\profiles.json`）
- **配置优先级**: API Profile > 环境变量 > OAuth Token
- **后端集成**: `apps/backend/config/api_profiles.py` + `apps/backend/core/auth.py`
- **前端组件**: `ProfileList.tsx`, `ProfileEditDialog.tsx`

---

## 🚀 升级指南

### 从 v2.7.4 升级

**Windows**:
1. 下载最新的安装程序
2. 运行安装程序（会自动覆盖旧版本）
3. 重新启动应用

**macOS**:
1. 下载最新的 DMG 文件
2. 将新版本拖到 Applications 文件夹（覆盖旧版本）
3. 重新启动应用

**Linux**:
1. 下载最新的 AppImage 或 .deb 包
2. 替换旧版本或运行新包
3. 重新启动应用

**注意**:
- 升级过程不会影响现有配置和数据
- OAuth Token 和 API Profiles 将自动保留
- 建议升级前备份 `~/.config/Auto-Claude/` 目录

---

## 🐛 已知问题

- **Windows**: 本地构建暂时禁用代码签名（生产版本已签名）
  - 首次运行可能显示 Windows SmartScreen 警告
  - 点击"更多信息" → "仍要运行"即可

- **macOS**: 首次启动可能需要在"系统偏好设置"中允许
  - 打开"系统偏好设置" → "安全性与隐私" → "通用"
  - 点击"仍要打开"

- **Linux**: AppImage 需要 FUSE 支持
  - 如果无法运行，请安装: `sudo apt install libfuse2`

---

## 📚 文档资源

### 用户文档
- **用户指南**: [README.md](../README.md)
- **API Profile 配置**: [API_PROFILES.md](../guides/API_PROFILES.md)
- **安装指南**: [INSTALLATION.md](INSTALLATION.md)
- **测试清单**: [TEST_CHECKLIST.md](TEST_CHECKLIST.md)

### 开发文档
- **构建指南**: [BUILDING.md](BUILDING.md)
- **开发文档**: [CLAUDE.md](../CLAUDE.md)
- **更新日志**: [CHANGELOG.md](../CHANGELOG.md)

---

## 💬 反馈与支持

### 问题报告
- **GitHub Issues**: [https://github.com/AndyMik90/Auto-Claude/issues](https://github.com/AndyMik90/Auto-Claude/issues)
- 请提供以下信息：
  - 操作系统和版本
  - Auto-Claude 版本
  - 复现步骤
  - 错误日志（如有）

### 功能请求
- **GitHub Discussions**: [https://github.com/AndyMik90/Auto-Claude/discussions](https://github.com/AndyMik90/Auto-Claude/discussions)
- 描述您希望添加的功能和使用场景

### 文档改进
- 发现文档错误或不清楚？请提交 Issue 或 Pull Request
- 我们欢迎任何文档改进建议

---

## 🙏 致谢

感谢所有贡献者和用户的支持！

**特别感谢**:
- Claude Agent SDK 团队
- Electron Builder 社区
- Graphiti 项目
- 所有测试用户和反馈者

**贡献者**:
- @AndyMik90 - 项目维护者
- 所有提交 Issue 和 PR 的社区成员

---

## 🔜 下一步计划

v2.8.0 计划中的功能：
- [ ] 多语言支持扩展（日语、韩语等）
- [ ] 更多 LLM 提供商支持
- [ ] 增强的 QA 测试能力
- [ ] 性能优化和启动速度提升
- [ ] 更详细的构建日志和调试功能

关注我们的 [GitHub Repository](https://github.com/AndyMik90/Auto-Claude) 获取最新动态！

---

**版本**: 2.7.5
**发布日期**: 2024-01-XX
**构建日期**: 自动生成

如有问题，请访问 [GitHub Issues](https://github.com/AndyMik90/Auto-Claude/issues)
