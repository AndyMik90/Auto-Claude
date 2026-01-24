# Auto-Claude 安装指南

本指南将帮助您在不同操作系统上安装和配置 Auto-Claude。

**当前版本**: 2.7.5
**支持平台**: Windows 10+, macOS 10.13+, Linux (Ubuntu 18.04+)

---

## 📋 目录

- [Windows 安装](#windows-安装)
- [macOS 安装](#macos-安装)
- [Linux 安装](#linux-安装)
- [首次配置](#首次配置)
- [故障排查](#故障排查)
- [卸载](#卸载)

---

## Windows 安装

### 方法 1: 安装程序（推荐）

#### 1. 下载安装程序

从 [GitHub Releases](https://github.com/AndyMik90/Auto-Claude/releases) 下载最新版本：
- 文件名: `Auto-Claude-2.7.5-win32-x64.exe`
- 大小: 约 150 MB

#### 2. 运行安装程序

1. **双击下载的 `.exe` 文件**

2. **处理 Windows SmartScreen 警告**（如果出现）：
   - Windows 可能显示"Windows 已保护你的电脑"
   - 点击 **"更多信息"**
   - 点击 **"仍要运行"**

   > 注意: 开发版本未签名，生产版本已有数字签名

3. **安装向导步骤**：

   **欢迎页面**:
   - 阅读欢迎信息
   - 点击 **"下一步"**

   **许可协议**:
   - 阅读许可协议
   - 勾选 **"我接受协议"**
   - 点击 **"下一步"**

   **选择安装路径**:
   - 默认路径: `C:\Users\<用户名>\AppData\Local\Programs\Auto-Claude`
   - 可以点击 **"浏览"** 自定义安装路径
   - 点击 **"下一步"**

   **选择组件**:
   - 勾选 **"创建桌面快捷方式"**（推荐）
   - 勾选 **"创建开始菜单快捷方式"**（推荐）
   - 点击 **"下一步"**

   **准备安装**:
   - 检查安装设置
   - 点击 **"安装"**

   **安装进度**:
   - 等待安装完成（通常 1-2 分钟）

   **完成安装**:
   - 勾选 **"运行 Auto Claude"**（可选）
   - 点击 **"完成"**

#### 3. 首次启动

- 双击桌面快捷方式 **"Auto Claude"**
- 或从开始菜单启动

---

### 方法 2: 便携版

#### 1. 下载便携版

- 文件名: `Auto-Claude-2.7.5-win32-x64.zip`
- 大小: 约 200 MB

#### 2. 解压缩

1. 将 ZIP 文件解压到您选择的目录（如 `D:\Apps\Auto-Claude`）
2. 确保解压路径没有中文字符或特殊符号

#### 3. 运行

1. 进入解压目录
2. 双击 **`Auto-Claude.exe`**

---

### 方法 3: 从源码构建（高级用户）

查看 [BUILDING.md](BUILDING.md) 了解详细构建步骤。

---

## macOS 安装

### 1. 下载 DMG 文件

选择适合您 Mac 的版本：

- **Intel Mac**: `Auto-Claude-2.7.5-x64.dmg`
- **Apple Silicon (M1/M2/M3)**: `Auto-Claude-2.7.5-arm64.dmg`
- **Universal (推荐)**: `Auto-Claude-2.7.5-universal.dmg`

### 2. 挂载 DMG

1. 双击下载的 `.dmg` 文件
2. 会打开一个 Finder 窗口

### 3. 安装应用

1. 将 **`Auto Claude`** 图标拖动到 **`Applications`** 文件夹
2. 等待复制完成

### 4. 首次启动

1. 打开 **Launchpad** 或 **Applications** 文件夹
2. 找到 **Auto Claude**
3. **右键点击** → 选择 **"打开"**

   > 注意: 由于未经 Apple 公证，首次必须右键打开

4. 如果看到 **"无法打开"** 对话框：
   - 打开 **"系统偏好设置"** → **"安全性与隐私"** → **"通用"**
   - 找到 **"仍要打开"** 按钮并点击
   - 在确认对话框中点击 **"打开"**

### 5. 移除隔离属性（可选）

如果反复遇到安全警告，可以运行以下命令移除隔离属性：

```bash
sudo xattr -rd com.apple.quarantine /Applications/Auto\ Claude.app
```

---

## Linux 安装

### 方法 1: AppImage（推荐）

#### 1. 下载 AppImage

```bash
wget https://github.com/AndyMik90/Auto-Claude/releases/download/v2.7.5/Auto-Claude-2.7.5-x86_64.AppImage
```

#### 2. 添加执行权限

```bash
chmod +x Auto-Claude-2.7.5-x86_64.AppImage
```

#### 3. 运行

```bash
./Auto-Claude-2.7.5-x86_64.AppImage
```

#### 4. 桌面集成（可选）

首次运行时，AppImage 会询问是否集成到系统：
- 选择 **"Yes"** 将应用添加到应用菜单
- 选择 **"No"** 仅本次运行

#### 5. 故障排查

如果遇到 **"FUSE not found"** 错误：

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install libfuse2

# Fedora
sudo dnf install fuse-libs

# Arch Linux
sudo pacman -S fuse2
```

---

### 方法 2: Debian/Ubuntu 包

#### 1. 下载 .deb 包

```bash
wget https://github.com/AndyMik90/Auto-Claude/releases/download/v2.7.5/auto-claude_2.7.5_amd64.deb
```

#### 2. 安装

```bash
sudo apt install ./auto-claude_2.7.5_amd64.deb
```

或使用 dpkg：

```bash
sudo dpkg -i auto-claude_2.7.5_amd64.deb
sudo apt-get install -f  # 安装依赖
```

#### 3. 运行

```bash
auto-claude
```

或从应用菜单启动。

---

## 首次配置

安装完成后，需要配置 API 认证才能使用 Auto-Claude。

### 选项 1: OAuth Token（官方 Anthropic API）

#### 1. 获取 OAuth Token

打开终端运行：

```bash
claude setup-token
```

按照提示完成 OAuth 认证，复制生成的 Token。

#### 2. 在 Auto Claude 中配置

1. 打开 Auto Claude
2. 进入 **"设置"** 页面
3. 找到 **"OAuth Token"** 输入框
4. 粘贴您的 Token
5. 点击 **"保存"**

Token 将被安全地存储在系统 Keychain 中。

---

### 选项 2: API Profile（new-api/litellm/OpenRouter）

如果您使用 new-api、litellm、OpenRouter 或自托管实例，请使用 API Profile 配置。

#### 1. 打开 API Profiles 设置

1. 打开 Auto Claude
2. 进入 **"设置"** → **"API Profiles"**

#### 2. 创建新 Profile

1. 点击 **"添加配置"** 按钮
2. 填写配置信息：

   | 字段 | 说明 | 示例 |
   |------|------|------|
   | **Profile 名称** | 自定义名称 | `本地 new-api` |
   | **Base URL** | API 端点 URL | `http://localhost:3000/v1` |
   | **API Key** | 您的 API 密钥 | `sk-xxxxx` |
   | **模型映射** (可选) | 自定义模型名称 | `claude-3-5-sonnet-20241022` → `gpt-4` |

3. 点击 **"测试连接"** 验证配置
4. 测试成功后点击 **"保存"**

#### 3. 激活 Profile

1. 在 Profile 列表中找到刚创建的 Profile
2. 点击 **"设为激活"** 按钮
3. 激活的 Profile 将显示绿色标记

#### 4. 验证

创建新 Spec 或运行构建，检查是否使用了正确的 API 端点。

详细配置说明请参考: [API Profiles 配置指南](API_PROFILES.md)

---

## 故障排查

### Windows

#### 问题: "Windows 已保护你的电脑"

**原因**: 开发版本未签名

**解决**:
1. 点击 **"更多信息"**
2. 点击 **"仍要运行"**

#### 问题: 无法启动，报错 "Python 未找到"

**解决**:
1. 完全卸载应用
2. 重新下载安装程序
3. 确保安装过程完整无中断

#### 问题: 防火墙或杀毒软件拦截

**解决**:
1. 将 `Auto-Claude.exe` 添加到防火墙白名单
2. 将安装目录添加到杀毒软件排除列表

---

### macOS

#### 问题: "无法打开" 或 "已损坏"

**解决方法 1**: 右键打开
1. 右键点击应用
2. 选择 **"打开"**
3. 在弹出的对话框中点击 **"打开"**

**解决方法 2**: 移除隔离属性
```bash
sudo xattr -rd com.apple.quarantine /Applications/Auto\ Claude.app
```

#### 问题: "Auto Claude" is damaged and can't be opened

**解决**:
```bash
# 移除隔离属性
sudo xattr -rd com.apple.quarantine /Applications/Auto\ Claude.app

# 如果仍然无法打开，重新签名
sudo codesign --force --deep --sign - /Applications/Auto\ Claude.app
```

---

### Linux

#### 问题: AppImage 无法运行

**解决**: 安装 FUSE
```bash
# Ubuntu/Debian
sudo apt install libfuse2

# Fedora
sudo dnf install fuse-libs

# Arch Linux
sudo pacman -S fuse2
```

#### 问题: 权限错误

**解决**:
```bash
chmod +x Auto-Claude-2.7.5-x86_64.AppImage
```

#### 问题: 缺少依赖

**解决**: 安装必要的库
```bash
# Ubuntu/Debian
sudo apt install libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2

# Fedora
sudo dnf install nss atk at-spi2-atk cups-libs libdrm libxkbcommon libXcomposite libXdamage libXfixes libXrandr mesa-libgbm alsa-lib
```

---

### 通用问题

#### 问题: 启动缓慢

**可能原因**:
- 磁盘 I/O 慢
- 防火墙/杀毒软件扫描

**解决**:
1. 将应用安装到 SSD
2. 将应用目录添加到杀毒软件排除列表

#### 问题: 内存占用过高

**正常范围**:
- 空闲: 200-500 MB
- 运行构建: 500 MB - 2 GB

**优化**:
1. 关闭不使用的标签页
2. 减少并发构建任务

#### 问题: 无法连接 API

**检查清单**:
1. 网络连接正常
2. API Token/Key 正确
3. Base URL 正确（包含 `/v1` 后缀）
4. 防火墙未拦截

---

## 更新

### 自动更新（推荐）

Auto-Claude 支持自动更新检查：

1. 启动时会自动检查新版本
2. 如果有更新，会显示通知
3. 点击 **"更新"** 按钮自动下载并安装
4. 安装完成后重启应用

### 手动更新

1. 从 [GitHub Releases](https://github.com/AndyMik90/Auto-Claude/releases) 下载最新版本
2. 运行安装程序覆盖安装（Windows）
3. 或替换 Applications 中的应用（macOS）
4. 重启应用

**注意**: 更新不会影响用户数据和配置。

---

## 卸载

### Windows

#### 方法 1: 通过设置卸载

1. 打开 **"设置"** → **"应用"**
2. 找到 **"Auto Claude"**
3. 点击 **"卸载"**
4. 按照向导完成卸载

#### 方法 2: 运行卸载程序

1. 进入安装目录（如 `C:\Users\<用户名>\AppData\Local\Programs\Auto-Claude`）
2. 双击 **`Uninstall Auto Claude.exe`**
3. 按照向导完成卸载

#### 清理用户数据（可选）

卸载后，用户配置和数据会保留在：
- `%APPDATA%\Auto-Claude\`

如需完全清理：
```cmd
rmdir /s "%APPDATA%\Auto-Claude"
```

---

### macOS

#### 卸载应用

1. 打开 **Finder** → **"应用程序"**
2. 找到 **"Auto Claude"**
3. 拖到 **"废纸篓"**
4. 清空废纸篓

#### 清理用户数据（可选）

```bash
rm -rf ~/Library/Application\ Support/Auto-Claude
rm -rf ~/.config/Auto-Claude
```

---

### Linux

#### AppImage

直接删除 AppImage 文件：

```bash
rm Auto-Claude-2.7.5-x86_64.AppImage
```

#### Debian 包

```bash
sudo apt remove auto-claude
```

#### 清理用户数据（可选）

```bash
rm -rf ~/.config/Auto-Claude
rm -rf ~/.local/share/Auto-Claude
```

---

## 系统要求检查

运行以下命令检查您的系统是否满足要求：

### Windows

```powershell
# 检查 Windows 版本
systeminfo | findstr /B /C:"OS Name" /C:"OS Version"

# 检查内存
systeminfo | findstr /C:"Total Physical Memory"
```

### macOS

```bash
# 检查 macOS 版本
sw_vers

# 检查内存
sysctl hw.memsize
```

### Linux

```bash
# 检查发行版
lsb_release -a

# 检查内存
free -h
```

---

## 获取帮助

### 文档资源

- **用户指南**: [README.md](../README.md)
- **API Profile 配置**: [API_PROFILES.md](../guides/API_PROFILES.md)
- **构建指南**: [BUILDING.md](BUILDING.md)
- **测试清单**: [TEST_CHECKLIST.md](TEST_CHECKLIST.md)

### 社区支持

- **GitHub Issues**: [https://github.com/AndyMik90/Auto-Claude/issues](https://github.com/AndyMik90/Auto-Claude/issues)
- **GitHub Discussions**: [https://github.com/AndyMik90/Auto-Claude/discussions](https://github.com/AndyMik90/Auto-Claude/discussions)

### 报告问题

提交 Issue 时，请提供：
1. 操作系统和版本
2. Auto-Claude 版本
3. 错误信息和日志
4. 复现步骤

---

**版本**: 2.7.5
**更新日期**: 2024-01-XX

如有问题，请访问 [GitHub Issues](https://github.com/AndyMik90/Auto-Claude/issues)
