#!/usr/bin/env node
/**
 * Auto-Claude 安装包测试脚本
 * 版本: 1.0.0
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ANSI 颜色代码
const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  white: '\x1b[37m',
  gray: '\x1b[90m'
};

let testsPassed = 0;
let testsFailed = 0;

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function testItem(description, testFn) {
  process.stdout.write(`测试: ${description}...`);
  try {
    const result = testFn();
    if (result) {
      log(' ✅ 通过', 'green');
      testsPassed++;
      return true;
    } else {
      log(' ❌ 失败', 'red');
      testsFailed++;
      return false;
    }
  } catch (error) {
    log(` ❌ 错误: ${error.message}`, 'red');
    testsFailed++;
    return false;
  }
}

function getFileSize(filePath) {
  const stats = fs.statSync(filePath);
  return (stats.size / (1024 * 1024)).toFixed(2);
}

function getDirectorySize(dirPath) {
  let totalSize = 0;
  const files = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const file of files) {
    const filePath = path.join(dirPath, file.name);
    if (file.isDirectory()) {
      totalSize += getDirectorySize(filePath);
    } else {
      totalSize += fs.statSync(filePath).size;
    }
  }

  return totalSize;
}

// ============================================================
// 测试开始
// ============================================================
log('==================================================', 'cyan');
log('  Auto-Claude 安装包测试工具', 'cyan');
log('==================================================', 'cyan');
log('');

// ============================================================
// 1. 检查构建产物
// ============================================================
log('\n📦 [1/5] 检查构建产物', 'cyan');
log('----------------------------------------------------', 'gray');

const distDir = path.join(__dirname, '../apps/frontend/dist');
if (!fs.existsSync(distDir)) {
  log(`❌ 构建目录不存在: ${distDir}`, 'red');
  log('   请先运行: npm run dist', 'yellow');
  process.exit(1);
}

// 检查 EXE 文件
testItem('安装程序 (*.exe) 存在', () => {
  const files = fs.readdirSync(distDir);
  const exeFile = files.find(f => f.endsWith('.exe'));
  if (exeFile) {
    const filePath = path.join(distDir, exeFile);
    const sizeMB = getFileSize(filePath);
    log(`\n   📄 文件: ${exeFile}`, 'white');
    log(`   📊 大小: ${sizeMB} MB`, 'white');
    return true;
  }
  return false;
});

// 检查 ZIP 文件
testItem('便携版 (*.zip) 存在', () => {
  const files = fs.readdirSync(distDir);
  const zipFile = files.find(f => f.endsWith('.zip'));
  if (zipFile) {
    const filePath = path.join(distDir, zipFile);
    const sizeMB = getFileSize(filePath);
    log(`\n   📄 文件: ${zipFile}`, 'white');
    log(`   📊 大小: ${sizeMB} MB`, 'white');
    return true;
  }
  log('\n   ⚠️  未找到 ZIP 文件（可选）', 'yellow');
  return true; // ZIP 是可选的
});

// 检查 latest.yml
testItem('更新配置文件 (latest.yml) 存在', () => {
  return fs.existsSync(path.join(distDir, 'latest.yml'));
});

// ============================================================
// 2. 检查 Python 运行时
// ============================================================
log('\n🐍 [2/5] 检查 Python 运行时', 'cyan');
log('----------------------------------------------------', 'gray');

const pythonDir = path.join(__dirname, '../apps/frontend/python-runtime/win-x64/python');
const pythonExe = path.join(pythonDir, 'python.exe');

testItem('Python 运行时目录存在', () => {
  return fs.existsSync(pythonDir);
});

testItem('Python 可执行文件存在', () => {
  return fs.existsSync(pythonExe);
});

if (fs.existsSync(pythonExe)) {
  testItem('Python 版本验证', () => {
    try {
      const version = execSync(`"${pythonExe}" --version`, { encoding: 'utf-8' });
      log(`\n   🐍 版本: ${version.trim()}`, 'white');
      return version.includes('Python 3.12');
    } catch (error) {
      return false;
    }
  });

  // 检查关键包
  log('\n   验证关键依赖包:', 'white');

  const packages = [
    { name: 'claude-agent-sdk', importName: 'claude_agent_sdk' },
    { name: 'graphiti-core', importName: 'graphiti_core' },
    { name: 'pydantic', importName: 'pydantic' },
    { name: 'openai', importName: 'openai' },
    { name: 'anthropic', importName: 'anthropic' },
    { name: 'httpx', importName: 'httpx' }
  ];

  packages.forEach(pkg => {
    testItem(`   - ${pkg.name}`, () => {
      try {
        const result = execSync(
          `"${pythonExe}" -c "import ${pkg.importName}; print('OK')"`,
          { encoding: 'utf-8', stdio: 'pipe' }
        );
        return result.includes('OK');
      } catch (error) {
        return false;
      }
    });
  });
}

// ============================================================
// 3. 检查前端构建产物
// ============================================================
log('\n🎨 [3/5] 检查前端构建', 'cyan');
log('----------------------------------------------------', 'gray');

testItem('前端主进程构建 (out/main)', () => {
  return fs.existsSync(path.join(__dirname, '../apps/frontend/out/main'));
});

testItem('前端渲染进程构建 (out/renderer)', () => {
  return fs.existsSync(path.join(__dirname, '../apps/frontend/out/renderer'));
});

testItem('主进程入口文件 (index.js)', () => {
  return fs.existsSync(path.join(__dirname, '../apps/frontend/out/main/index.js'));
});

testItem('预加载脚本 (preload.js)', () => {
  return fs.existsSync(path.join(__dirname, '../apps/frontend/out/main/preload.js'));
});

// ============================================================
// 4. 检查资源文件
// ============================================================
log('\n📁 [4/5] 检查资源文件', 'cyan');
log('----------------------------------------------------', 'gray');

testItem('应用图标 (icon.ico)', () => {
  return fs.existsSync(path.join(__dirname, '../apps/frontend/assets/icon.ico'));
});

testItem('国际化文件 (i18n/locales)', () => {
  const locales = ['en', 'zh-CN'];
  for (const locale of locales) {
    const localePath = path.join(__dirname, '../apps/frontend/src/shared/i18n/locales', locale);
    if (!fs.existsSync(localePath)) {
      log(`\n   ❌ 缺少语言包: ${locale}`, 'red');
      return false;
    }
  }
  log('\n   ✅ 语言包完整 (en, zh-CN)', 'white');
  return true;
});

// ============================================================
// 5. 检查配置文件
// ============================================================
log('\n⚙️  [5/5] 检查配置文件', 'cyan');
log('----------------------------------------------------', 'gray');

testItem('Package.json 构建配置', () => {
  const packageJson = require('../apps/frontend/package.json');
  return packageJson.build !== undefined;
});

testItem('后端环境变量示例 (.env.example)', () => {
  return fs.existsSync(path.join(__dirname, '../apps/backend/.env.example'));
});

testItem('后端 Python 依赖 (requirements.txt)', () => {
  return fs.existsSync(path.join(__dirname, '../apps/backend/requirements.txt'));
});

// ============================================================
// 测试总结
// ============================================================
log('\n==================================================', 'cyan');
log('  测试总结', 'cyan');
log('==================================================', 'cyan');
log('');
log(`✅ 通过: ${testsPassed}`, 'green');
log(`❌ 失败: ${testsFailed}`, 'red');
log(`📊 总计: ${testsPassed + testsFailed}`, 'white');
log('');

if (testsFailed === 0) {
  log('🎉 所有测试通过！安装包已准备就绪。', 'green');
  process.exit(0);
} else {
  log('⚠️  部分测试失败，请检查上述错误。', 'yellow');
  process.exit(1);
}
