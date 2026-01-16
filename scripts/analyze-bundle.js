#!/usr/bin/env node
/**
 * Auto-Claude 构建体积分析工具
 * 版本: 1.0.0
 */

const fs = require('fs');
const path = require('path');

// ANSI 颜色代码
const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function getDirectorySize(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return 0;
  }

  let totalSize = 0;
  const files = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const file of files) {
    const filePath = path.join(dirPath, file.name);
    try {
      if (file.isDirectory()) {
        totalSize += getDirectorySize(filePath);
      } else {
        const stats = fs.statSync(filePath);
        totalSize += stats.size;
      }
    } catch (error) {
      // 忽略无法访问的文件
    }
  }

  return totalSize;
}

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

function getPercentage(part, total) {
  if (total === 0) return '0.00';
  return ((part / total) * 100).toFixed(2);
}

function countFiles(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return 0;
  }

  let count = 0;
  const files = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const file of files) {
    const filePath = path.join(dirPath, file.name);
    try {
      if (file.isDirectory()) {
        count += countFiles(filePath);
      } else {
        count++;
      }
    } catch (error) {
      // 忽略无法访问的文件
    }
  }

  return count;
}

// ============================================================
// 主函数
// ============================================================
function analyzeBundle() {
  log('==================================================', 'cyan');
  log('  Auto-Claude 构建体积分析', 'cyan');
  log('==================================================', 'cyan');
  log('');

  const distDir = path.join(__dirname, '../apps/frontend/dist');
  const unpackedDir = path.join(distDir, 'win-unpacked');

  if (!fs.existsSync(distDir)) {
    log('❌ 构建目录不存在，请先运行: npm run dist', 'red');
    process.exit(1);
  }

  // ============================================================
  // 1. 分析安装包文件
  // ============================================================
  log('📦 [1/3] 安装包文件分析', 'cyan');
  log('----------------------------------------------------', 'gray');
  log('');

  const files = fs.readdirSync(distDir);
  const exeFile = files.find(f => f.endsWith('.exe'));
  const zipFile = files.find(f => f.endsWith('.zip'));

  if (exeFile) {
    const filePath = path.join(distDir, exeFile);
    const size = fs.statSync(filePath).size;
    log(`  📄 安装程序: ${exeFile}`, 'white');
    log(`     大小: ${formatSize(size)}`, 'white');
    log('');
  }

  if (zipFile) {
    const filePath = path.join(distDir, zipFile);
    const size = fs.statSync(filePath).size;
    log(`  📦 便携版: ${zipFile}`, 'white');
    log(`     大小: ${formatSize(size)}`, 'white');
    log('');
  }

  // ============================================================
  // 2. 分析解包目录结构
  // ============================================================
  log('🔍 [2/3] 解包目录结构分析', 'cyan');
  log('----------------------------------------------------', 'gray');
  log('');

  if (!fs.existsSync(unpackedDir)) {
    log('⚠️  未找到 win-unpacked 目录', 'yellow');
    log('');
  } else {
    const components = [
      {
        name: 'Python 运行时',
        path: path.join(unpackedDir, 'resources/app.asar.unpacked/python-runtime')
      },
      {
        name: 'Node 模块',
        path: path.join(unpackedDir, 'resources/app.asar.unpacked/node_modules')
      },
      {
        name: 'Electron 应用代码 (asar)',
        path: path.join(unpackedDir, 'resources/app.asar'),
        isFile: true
      },
      {
        name: 'Electron 框架',
        path: path.join(unpackedDir, 'resources')
      },
      {
        name: 'Electron 可执行文件',
        path: path.join(unpackedDir, 'Auto-Claude.exe'),
        isFile: true
      }
    ];

    const sizes = {};
    let totalSize = 0;

    for (const component of components) {
      if (fs.existsSync(component.path)) {
        let size;
        if (component.isFile) {
          size = fs.statSync(component.path).size;
        } else {
          size = getDirectorySize(component.path);
        }
        sizes[component.name] = size;
        totalSize += size;
      } else {
        sizes[component.name] = 0;
      }
    }

    // 显示组件大小
    const sortedComponents = Object.entries(sizes).sort((a, b) => b[1] - a[1]);

    for (const [name, size] of sortedComponents) {
      const percentage = getPercentage(size, totalSize);
      const bar = '█'.repeat(Math.round(percentage / 2));
      log(`  ${name.padEnd(30)} ${formatSize(size).padStart(12)} (${percentage}%)`, 'white');
      log(`  ${bar}`, 'cyan');
      log('');
    }

    log(`  ${'总计'.padEnd(30)} ${formatSize(totalSize).padStart(12)}`, 'bold');
    log('');
  }

  // ============================================================
  // 3. Python 运行时详细分析
  // ============================================================
  log('🐍 [3/3] Python 运行时详细分析', 'cyan');
  log('----------------------------------------------------', 'gray');
  log('');

  const pythonDir = path.join(__dirname, '../apps/frontend/python-runtime/win-x64/python');

  if (!fs.existsSync(pythonDir)) {
    log('⚠️  未找到 Python 运行时目录', 'yellow');
    log('');
  } else {
    const pythonComponents = [
      { name: 'site-packages', path: path.join(pythonDir, 'Lib/site-packages') },
      { name: '标准库 (Lib)', path: path.join(pythonDir, 'Lib') },
      { name: 'DLLs', path: path.join(pythonDir, 'DLLs') },
      { name: 'Python 可执行文件', path: path.join(pythonDir, 'python.exe'), isFile: true },
      { name: '其他文件', path: pythonDir }
    ];

    const pythonSizes = {};
    let pythonTotalSize = 0;

    for (const component of pythonComponents) {
      if (fs.existsSync(component.path)) {
        let size;
        if (component.isFile) {
          size = fs.statSync(component.path).size;
        } else {
          size = getDirectorySize(component.path);
        }
        pythonSizes[component.name] = size;
        pythonTotalSize += size;
      } else {
        pythonSizes[component.name] = 0;
      }
    }

    // 排序并显示
    const sortedPython = Object.entries(pythonSizes).sort((a, b) => b[1] - a[1]);

    for (const [name, size] of sortedPython) {
      const percentage = getPercentage(size, pythonTotalSize);
      log(`  ${name.padEnd(25)} ${formatSize(size).padStart(12)} (${percentage}%)`, 'white');
    }

    log('');
    log(`  ${'Python 运行时总计'.padEnd(25)} ${formatSize(pythonTotalSize).padStart(12)}`, 'bold');
    log('');

    // site-packages 详细分析
    const sitePackagesDir = path.join(pythonDir, 'Lib/site-packages');
    if (fs.existsSync(sitePackagesDir)) {
      log('  📦 site-packages 前 10 大包:', 'cyan');
      log('');

      const packages = fs.readdirSync(sitePackagesDir, { withFileTypes: true })
        .filter(item => item.isDirectory())
        .map(item => {
          const pkgPath = path.join(sitePackagesDir, item.name);
          return {
            name: item.name,
            size: getDirectorySize(pkgPath),
            files: countFiles(pkgPath)
          };
        })
        .sort((a, b) => b.size - a.size)
        .slice(0, 10);

      for (const pkg of packages) {
        log(`     ${pkg.name.padEnd(35)} ${formatSize(pkg.size).padStart(10)} (${pkg.files} 文件)`, 'white');
      }
      log('');
    }
  }

  // ============================================================
  // 优化建议
  // ============================================================
  log('==================================================', 'cyan');
  log('  💡 优化建议', 'cyan');
  log('==================================================', 'cyan');
  log('');

  const suggestions = [];

  // 获取 Python 运行时大小
  const pythonSize = fs.existsSync(pythonDir) ? getDirectorySize(pythonDir) : 0;

  if (pythonSize > 150 * 1024 * 1024) {
    suggestions.push('- Python 运行时较大（> 150 MB），可以考虑：');
    suggestions.push('  · 移除未使用的标准库模块（tkinter, turtle, idlelib, lib2to3）');
    suggestions.push('  · 压缩 .py 文件为 .pyc');
    suggestions.push('  · 移除 .dist-info 和 .egg-info 中的 RECORD 文件');
  }

  // 检查 Node 模块大小（如果在 unpacked 中）
  const nodeModulesPath = path.join(unpackedDir, 'resources/app.asar.unpacked/node_modules');
  const nodeModulesSize = fs.existsSync(nodeModulesPath) ? getDirectorySize(nodeModulesPath) : 0;

  if (nodeModulesSize > 50 * 1024 * 1024) {
    suggestions.push('- Node 模块较大（> 50 MB），可以考虑：');
    suggestions.push('  · 使用 asar 打包');
    suggestions.push('  · 移除开发依赖');
    suggestions.push('  · 检查是否有重复的依赖');
  }

  const exeSize = exeFile ? fs.statSync(path.join(distDir, exeFile)).size : 0;
  if (exeSize > 200 * 1024 * 1024) {
    suggestions.push('- 安装包较大（> 200 MB），可以考虑：');
    suggestions.push('  · 使用更高的压缩级别（7z ultra）');
    suggestions.push('  · 启用固实压缩');
  }

  if (suggestions.length === 0) {
    log('✅ 构建体积已优化，暂无建议', 'green');
  } else {
    suggestions.forEach(s => log(s, 'yellow'));
  }

  log('');
  log('==================================================', 'cyan');
  log('');
}

// 运行分析
try {
  analyzeBundle();
} catch (error) {
  log(`❌ 分析失败: ${error.message}`, 'red');
  process.exit(1);
}
