#!/usr/bin/env node
/**
 * Cross-platform backend installer script
 * Handles Python venv creation and dependency installation on Windows/Mac/Linux
 * Uses uv for fast dependency installation (10-100x faster than pip)
 */

const { execSync, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const isWindows = os.platform() === 'win32';
const isMac = os.platform() === 'darwin';
const backendDir = path.join(__dirname, '..', 'apps', 'backend');
const venvDir = path.join(backendDir, '.venv');

console.log('Installing Auto Claude backend dependencies...\n');

// Helper to run commands
function run(cmd, options = {}) {
  console.log(`> ${cmd}`);
  try {
    execSync(cmd, { stdio: 'inherit', cwd: backendDir, ...options });
    return true;
  } catch (error) {
    return false;
  }
}

// Check if uv is installed
function checkUv() {
  try {
    const result = spawnSync('uv', ['--version'], {
      encoding: 'utf8',
      shell: true,
    });
    if (result.status === 0) {
      console.log(`Found uv: ${result.stdout.trim()}`);
      return true;
    }
  } catch (e) {
    // uv not found
  }
  return false;
}

// Install uv package manager
function installUv() {
  console.log('\nInstalling uv package manager (10-100x faster than pip)...');
  if (isWindows) {
    // Use PowerShell installer on Windows
    if (!run('powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"', { cwd: process.cwd() })) {
      console.error('Failed to install uv via PowerShell');
      return false;
    }
  } else {
    // Use curl installer on Unix
    if (!run('curl -LsSf https://astral.sh/uv/install.sh | sh', { cwd: process.cwd(), shell: '/bin/bash' })) {
      console.error('Failed to install uv');
      return false;
    }
  }
  console.log('uv installed successfully');
  return true;
}

// Find Python 3.12 or 3.13 (NOT 3.14 - real-ladybug doesn't have wheels for it yet)
// Prefer 3.12 first since it has the most stable wheel support for native packages
function findPython() {
  // Note: Python 3.14 excluded because real-ladybug doesn't have pre-built wheels for it
  // This causes compilation from source which requires C++ compilers on Windows
  const candidates = isWindows
    ? ['py -3.12', 'py -3.13', 'python3.12', 'python3.13', 'python3', 'python']
    : ['python3.12', 'python3.13', 'python3', 'python'];

  for (const cmd of candidates) {
    try {
      const result = spawnSync(cmd.split(' ')[0], [...cmd.split(' ').slice(1), '--version'], {
        encoding: 'utf8',
        shell: true,
      });
      // Accept Python 3.12 or 3.13 only (3.14+ lacks pre-built wheels for real-ladybug)
      if (result.status === 0) {
        const versionMatch = result.stdout.match(/Python (\d+)\.(\d+)/);
        if (versionMatch) {
          const major = parseInt(versionMatch[1], 10);
          const minor = parseInt(versionMatch[2], 10);
          if (major === 3 && (minor === 12 || minor === 13)) {
            console.log(`Found Python ${major}.${minor}: ${cmd} -> ${result.stdout.trim()}`);
            return { command: cmd, version: `${major}.${minor}` };
          }
          }
        }
      }
    } catch (e) {
      // Continue to next candidate
    }
  }
  return null;
}

// Main installation
async function main() {
  // Check for Python 3.12 or 3.13
  const python = findPython();
  if (!pythonDetails) {
    console.error('\nError: Python 3.12 or 3.13 is required but not found.');
    console.error('Note: Python 3.14 is not supported yet (real-ladybug lacks pre-built wheels).');
    console.error('\nPlease install Python 3.12 or 3.13:');
    if (isWindows) {
      console.error('  scoop bucket add versions');
      console.error('  scoop install versions/python312');
      console.error('  # or');
      console.error('  scoop install versions/python313');
    } else if (isMac) {
      console.error('  brew install python@3.12');
    } else {
      console.error('  sudo apt install python3.12 python3.12-venv');
    }
    process.exit(1);
  }

  // Check for uv and install if needed
  let hasUv = checkUv();
  if (!hasUv) {
    console.log('\nuv not found. Would you like to install it for faster dependency installation?');
    console.log('uv is 10-100x faster than pip for installing Python packages.');

    // Auto-install uv (it's the recommended approach)
    if (!installUv()) {
      console.error('\nFailed to install uv. Falling back to pip...');
      console.error('You can manually install uv later: https://docs.astral.sh/uv/getting-started/installation/');
    } else {
      hasUv = true;
    }
  }

  // Remove existing venv if present
  if (fs.existsSync(venvDir)) {
    console.log('\nRemoving existing virtual environment...');
    fs.rmSync(venvDir, { recursive: true, force: true });
  }

  // Create virtual environment
  console.log('\nCreating virtual environment...');
  if (hasUv) {
    // Use uv to create venv (faster and handles Python version automatically)
    if (!run(`uv venv --python ${python.replace('py -', '').replace('python', '')}`)) {
      console.error('Failed to create virtual environment with uv');
      process.exit(1);
    }
  } else {
    // Fallback to standard venv
    if (!run(`${python} -m venv .venv`)) {
      console.error('Failed to create virtual environment');
      process.exit(1);
    }
  }

  // Install dependencies
  console.log('\nInstalling dependencies...');
  if (hasUv) {
    // Use uv pip for much faster installation
    if (!run('uv pip install -r requirements.txt')) {
      console.error('Failed to install dependencies');
      process.exit(1);
    }
  } else {
    // Fallback to pip
    const pip = isWindows
      ? path.join(venvDir, 'Scripts', 'pip.exe')
      : path.join(venvDir, 'bin', 'pip');
    if (!run(`"${pip}" install -r requirements.txt`)) {
      console.error('Failed to install dependencies');
      process.exit(1);
    }
  }

  // Install test dependencies (needed for pre-commit hooks and development)
  console.log('\nInstalling test dependencies...');
  if (hasUv) {
    if (!run('uv pip install -r ../../tests/requirements-test.txt')) {
      console.error('Failed to install test dependencies');
      process.exit(1);
    }
  } else {
    const pip = isWindows
      ? path.join(venvDir, 'Scripts', 'pip.exe')
      : path.join(venvDir, 'bin', 'pip');
    if (!run(`"${pip}" install -r ../../tests/requirements-test.txt`)) {
      console.error('Failed to install test dependencies');
      process.exit(1);
    }
  }

  // Create .env file from .env.example if it doesn't exist
  const envPath = path.join(backendDir, '.env');
  const envExamplePath = path.join(backendDir, '.env.example');

  if (fs.existsSync(envPath)) {
    console.log('\n✓ .env file already exists');
  } else if (fs.existsSync(envExamplePath)) {
    console.log('\nCreating .env file from .env.example...');
    try {
      fs.copyFileSync(envExamplePath, envPath);
      console.log('✓ Created .env file');
      console.log('  Please configure it with your credentials:');
      console.log(`  - Run: claude setup-token`);
      console.log(`  - Or edit: ${envPath}`);
    } catch (error) {
      console.warn('Warning: Could not create .env file:', error.message);
      console.warn('You will need to manually copy .env.example to .env');
    }
  } else {
    console.warn('\nWarning: .env.example not found. Cannot auto-create .env file.');
    console.warn('Please create a .env file manually if your configuration requires it.');
  }

  console.log('\n✓ Backend installation complete!');
  console.log(`  Virtual environment: ${venvDir}`);
  console.log(`  Package manager: ${hasUv ? 'uv (fast)' : 'pip (fallback)'}`);
  console.log('  Runtime dependencies: installed');
  console.log('  Test dependencies: installed (pytest, etc.)');
}

main().catch((err) => {
  console.error('Installation failed:', err);
  process.exit(1);
});
