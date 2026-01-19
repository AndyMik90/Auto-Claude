#!/usr/bin/env node
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { isWindows } = require('../src/shared/platform.cjs');
const { downloadPython } = require('./download-python.cjs');

const args = process.argv.slice(2);

const PLATFORM_FLAGS = new Map([
  ['--mac', 'mac'],
  ['--win', 'win'],
  ['--windows', 'win'],
  ['--linux', 'linux'],
]);

const ARCH_FLAGS = new Map([
  ['--x64', 'x64'],
  ['--arm64', 'arm64'],
  ['--universal', 'universal'],
]);

function mapHostPlatform(platform) {
  const map = { darwin: 'mac', win32: 'win', linux: 'linux' };
  return map[platform] || platform;
}

function resolvePlatforms() {
  const platforms = new Set();
  for (const arg of args) {
    const mapped = PLATFORM_FLAGS.get(arg);
    if (mapped) platforms.add(mapped);
  }

  if (platforms.size === 0) {
    platforms.add(mapHostPlatform(os.platform()));
  }

  return [...platforms];
}

function resolveArchs() {
  const archs = new Set();
  let wantsUniversal = false;

  for (const arg of args) {
    const mapped = ARCH_FLAGS.get(arg);
    if (!mapped) continue;
    if (mapped === 'universal') {
      wantsUniversal = true;
    } else {
      archs.add(mapped);
    }
  }

  if (wantsUniversal) {
    archs.add('x64');
    archs.add('arm64');
  }

  if (archs.size === 0) {
    archs.add(os.arch());
  }

  for (const arch of archs) {
    if (!['x64', 'arm64'].includes(arch)) {
      throw new Error(`Unsupported arch for bundled Python: ${arch}. Supported: x64, arm64.`);
    }
  }

  return [...archs];
}

function buildEnv(frontendDir) {
  const binDir = path.join(frontendDir, 'node_modules', '.bin');
  const rootBinDir = path.join(frontendDir, '..', '..', 'node_modules', '.bin');
  const pathParts = [binDir, rootBinDir];
  const pathValue = process.env.PATH
    ? `${pathParts.join(path.delimiter)}${path.delimiter}${process.env.PATH}`
    : pathParts.join(path.delimiter);
  return { ...process.env, PATH: pathValue };
}

function runCommand(command, commandArgs, cwd, env) {
  const bin = isWindows() ? `${command}.cmd` : command;
  const result = spawnSync(bin, commandArgs, {
    cwd,
    env,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const code = result.status ?? 1;
    throw new Error(`Command "${command}" failed with exit code ${code}.`);
  }
}

function toNodePlatform(platform) {
  const map = { mac: 'darwin', win: 'win32', linux: 'linux', darwin: 'darwin', win32: 'win32' };
  return map[platform] || platform;
}

function resolvePackageDir(baseDir, pkgName) {
  return path.join(baseDir, 'node_modules', ...pkgName.split('/'));
}

function copyPackage(fromDir, toDir) {
  if (!fs.existsSync(fromDir)) {
    throw new Error(`Required package not found: ${fromDir}`);
  }

  if (fs.existsSync(toDir)) {
    fs.rmSync(toDir, { recursive: true, force: true });
  }

  fs.mkdirSync(path.dirname(toDir), { recursive: true });
  fs.cpSync(fromDir, toDir, { recursive: true, dereference: true });
}

function readPackageJson(pkgDir) {
  const pkgPath = path.join(pkgDir, 'package.json');
  if (!fs.existsSync(pkgPath)) return null;
  return JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
}

function stageRuntimePackages(frontendDir, platform, arch) {
  const rootDir = path.join(frontendDir, '..', '..');
  const nodePlatform = toNodePlatform(platform);
  const packages = [
    '@lydell/node-pty',
    `@lydell/node-pty-${nodePlatform}-${arch}`,
    'minimatch',
  ];
  const outMainDir = path.join(frontendDir, 'out', 'main');
  const outModulesDir = path.join(outMainDir, 'node_modules');

  if (!fs.existsSync(outMainDir)) {
    throw new Error('Missing build output. Run electron-vite build before staging node-pty.');
  }

  fs.mkdirSync(outModulesDir, { recursive: true });

  const staged = new Set();

  function stagePackage(pkgName) {
    if (staged.has(pkgName)) return;
    staged.add(pkgName);

    const rootDirPath = resolvePackageDir(rootDir, pkgName);
    if (!fs.existsSync(rootDirPath)) {
      throw new Error(`Missing ${pkgName} in workspace. Run npm install before packaging.`);
    }

    const localDir = path.join(outModulesDir, ...pkgName.split('/'));
    console.log(`[package] Staging ${pkgName} into build output...`);
    copyPackage(rootDirPath, localDir);

    const pkgJson = readPackageJson(rootDirPath);
    if (!pkgJson) return;

    const deps = pkgJson.dependencies || {};
    const optionalDeps = pkgJson.optionalDependencies || {};

    for (const depName of Object.keys(deps)) {
      stagePackage(depName);
    }

    for (const depName of Object.keys(optionalDeps)) {
      const optionalPath = resolvePackageDir(rootDir, depName);
      if (fs.existsSync(optionalPath)) {
        stagePackage(depName);
      } else {
        console.log(`[package] Skipping optional dependency not installed: ${depName}`);
      }
    }
  }

  for (const pkgName of packages) {
    stagePackage(pkgName);
  }
}

async function main() {
  const frontendDir = path.join(__dirname, '..');
  const env = buildEnv(frontendDir);

  const platforms = resolvePlatforms();
  const archs = resolveArchs();

  for (const platform of platforms) {
    for (const arch of archs) {
      await downloadPython(platform, arch);
    }
  }

  runCommand('electron-vite', ['build'], frontendDir, env);

  for (const platform of platforms) {
    for (const arch of archs) {
      stageRuntimePackages(frontendDir, platform, arch);
    }
  }

  const builderArgs = [...args];
  const hasPublishFlag = builderArgs.some((arg) => arg === '--publish' || arg.startsWith('--publish='));
  if (!hasPublishFlag) {
    builderArgs.push('--publish', 'never');
  }

  runCommand('electron-builder', builderArgs, frontendDir, env);
}

main().catch((err) => {
  console.error(`[package] Error: ${err.message}`);
  process.exitCode = 1;
});
