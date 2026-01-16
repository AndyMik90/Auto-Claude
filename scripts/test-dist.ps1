# Auto-Claude 安装包测试脚本
# 版本: 1.0.0

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Auto-Claude 安装包测试工具" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Continue"
$testsPassed = 0
$testsFailed = 0

function Test-Item {
    param(
        [string]$Description,
        [scriptblock]$Test
    )

    Write-Host "测试: $Description..." -NoNewline
    try {
        $result = & $Test
        if ($result) {
            Write-Host " ✅ 通过" -ForegroundColor Green
            $script:testsPassed++
            return $true
        } else {
            Write-Host " ❌ 失败" -ForegroundColor Red
            $script:testsFailed++
            return $false
        }
    } catch {
        Write-Host " ❌ 错误: $_" -ForegroundColor Red
        $script:testsFailed++
        return $false
    }
}

# ============================================================
# 1. 检查构建产物
# ============================================================
Write-Host "`n📦 [1/5] 检查构建产物" -ForegroundColor Cyan
Write-Host "----------------------------------------------------" -ForegroundColor Gray

$distDir = "apps/frontend/dist"
if (-not (Test-Path $distDir)) {
    Write-Host "❌ 构建目录不存在: $distDir" -ForegroundColor Red
    Write-Host "   请先运行: npm run dist" -ForegroundColor Yellow
    exit 1
}

# 检查 EXE 文件
Test-Item "安装程序 (*.exe) 存在" {
    $exeFile = Get-ChildItem "$distDir/*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($exeFile) {
        $sizeMB = [math]::Round($exeFile.Length/1MB, 2)
        Write-Host "`n   📄 文件: $($exeFile.Name)" -ForegroundColor White
        Write-Host "   📊 大小: $sizeMB MB" -ForegroundColor White
        return $true
    }
    return $false
}

# 检查 ZIP 文件
Test-Item "便携版 (*.zip) 存在" {
    $zipFile = Get-ChildItem "$distDir/*.zip" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($zipFile) {
        $sizeMB = [math]::Round($zipFile.Length/1MB, 2)
        Write-Host "`n   📄 文件: $($zipFile.Name)" -ForegroundColor White
        Write-Host "   📊 大小: $sizeMB MB" -ForegroundColor White
        return $true
    }
    Write-Host "`n   ⚠️  未找到 ZIP 文件（可选）" -ForegroundColor Yellow
    return $true  # ZIP 是可选的
}

# 检查 latest.yml
Test-Item "更新配置文件 (latest.yml) 存在" {
    return Test-Path "$distDir/latest.yml"
}

# ============================================================
# 2. 检查 Python 运行时
# ============================================================
Write-Host "`n🐍 [2/5] 检查 Python 运行时" -ForegroundColor Cyan
Write-Host "----------------------------------------------------" -ForegroundColor Gray

$pythonDir = "apps/frontend/python-runtime/win-x64/python"
$pythonExe = "$pythonDir/python.exe"

Test-Item "Python 运行时目录存在" {
    return Test-Path $pythonDir
}

Test-Item "Python 可执行文件存在" {
    return Test-Path $pythonExe
}

if (Test-Path $pythonExe) {
    Test-Item "Python 版本验证" {
        $version = & $pythonExe --version 2>&1
        Write-Host "`n   🐍 版本: $version" -ForegroundColor White
        return $version -match "Python 3\.12"
    }

    # 检查关键包
    Write-Host "`n   验证关键依赖包:" -ForegroundColor White

    $packages = @(
        @{Name="claude-agent-sdk"; Import="claude_agent_sdk"},
        @{Name="graphiti-core"; Import="graphiti_core"},
        @{Name="pydantic"; Import="pydantic"},
        @{Name="openai"; Import="openai"},
        @{Name="anthropic"; Import="anthropic"},
        @{Name="httpx"; Import="httpx"}
    )

    foreach ($pkg in $packages) {
        Test-Item "   - $($pkg.Name)" {
            $result = & $pythonExe -c "import $($pkg.Import); print('OK')" 2>&1
            return $result -match "OK"
        }
    }
}

# ============================================================
# 3. 检查前端构建产物
# ============================================================
Write-Host "`n🎨 [3/5] 检查前端构建" -ForegroundColor Cyan
Write-Host "----------------------------------------------------" -ForegroundColor Gray

Test-Item "前端主进程构建 (out/main)" {
    return Test-Path "apps/frontend/out/main"
}

Test-Item "前端渲染进程构建 (out/renderer)" {
    return Test-Path "apps/frontend/out/renderer"
}

Test-Item "主进程入口文件 (index.js)" {
    return Test-Path "apps/frontend/out/main/index.js"
}

Test-Item "预加载脚本 (preload.js)" {
    return Test-Path "apps/frontend/out/main/preload.js"
}

# ============================================================
# 4. 检查资源文件
# ============================================================
Write-Host "`n📁 [4/5] 检查资源文件" -ForegroundColor Cyan
Write-Host "----------------------------------------------------" -ForegroundColor Gray

Test-Item "应用图标 (icon.ico)" {
    return Test-Path "apps/frontend/assets/icon.ico"
}

Test-Item "国际化文件 (i18n/locales)" {
    $locales = @("en", "zh-CN")
    foreach ($locale in $locales) {
        $path = "apps/frontend/src/shared/i18n/locales/$locale"
        if (-not (Test-Path $path)) {
            Write-Host "`n   ❌ 缺少语言包: $locale" -ForegroundColor Red
            return $false
        }
    }
    Write-Host "`n   ✅ 语言包完整 (en, zh-CN)" -ForegroundColor White
    return $true
}

# ============================================================
# 5. 检查配置文件
# ============================================================
Write-Host "`n⚙️  [5/5] 检查配置文件" -ForegroundColor Cyan
Write-Host "----------------------------------------------------" -ForegroundColor Gray

Test-Item "Package.json 构建配置" {
    $packageJson = Get-Content "apps/frontend/package.json" -Raw | ConvertFrom-Json
    return $packageJson.build -ne $null
}

Test-Item "后端环境变量示例 (.env.example)" {
    return Test-Path "apps/backend/.env.example"
}

Test-Item "后端 Python 依赖 (requirements.txt)" {
    return Test-Path "apps/backend/requirements.txt"
}

# ============================================================
# 测试总结
# ============================================================
Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "  测试总结" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ 通过: $testsPassed" -ForegroundColor Green
Write-Host "❌ 失败: $testsFailed" -ForegroundColor Red
Write-Host "📊 总计: $($testsPassed + $testsFailed)" -ForegroundColor White
Write-Host ""

if ($testsFailed -eq 0) {
    Write-Host "🎉 所有测试通过！安装包已准备就绪。" -ForegroundColor Green
    exit 0
} else {
    Write-Host "⚠️  部分测试失败，请检查上述错误。" -ForegroundColor Yellow
    exit 1
}
