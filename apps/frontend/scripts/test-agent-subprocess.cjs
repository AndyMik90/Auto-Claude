#!/usr/bin/env node
/**
 * Test minimal reproducible agent subprocess communication.
 * This test simulates how the Electron app spawns Python to run agent SDK.
 *
 * Purpose: Diagnose why .exe packaging causes "Control request timeout: initialize"
 * while Git version works perfectly.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const FRONTEND_DIR = path.resolve(__dirname, '..');
const PYTHON_RUNTIME_DIR = path.join(FRONTEND_DIR, 'python-runtime');

console.log('=== Agent Subprocess Communication Test ===\n');

// Step 1: Find Python executable
console.log('1. Locating Python executable...');
function findPythonPath() {
  const platform = process.platform === 'win32' ? 'win' : process.platform === 'darwin' ? 'mac' : 'linux';
  const arch = process.arch;

  // Try bundled Python first (packaged app scenario)
  const runtimePath = path.join(PYTHON_RUNTIME_DIR, `${platform}-${arch}`, 'python');
  const bundledPython = process.platform === 'win32'
    ? path.join(runtimePath, 'python.exe')
    : path.join(runtimePath, 'bin', 'python3');

  if (fs.existsSync(bundledPython)) {
    console.log(`   ✓ Found bundled Python: ${bundledPython}`);
    return bundledPython;
  }

  // Fallback to system Python (dev mode scenario)
  const systemPython = process.platform === 'win32' ? 'python' : 'python3';
  console.log(`   ⚠ Bundled Python not found, using system: ${systemPython}`);
  return systemPython;
}

const pythonPath = findPythonPath();

// Step 2: Check site-packages location
console.log('\n2. Checking site-packages locations...');
function findSitePackages() {
  const platform = process.platform === 'win32' ? 'win' : process.platform === 'darwin' ? 'mac' : 'linux';
  const arch = process.arch;
  const runtimePath = path.join(PYTHON_RUNTIME_DIR, `${platform}-${arch}`, 'python');

  // Expected locations for bundled packages
  const locations = {
    // New correct location (after fix)
    correct: path.join(runtimePath, process.platform === 'win32' ? 'Lib' : 'lib', 'site-packages'),
    // Old incorrect location (before fix)
    legacy: path.join(FRONTEND_DIR, '..', '..', 'resources', 'python-site-packages'),
    // Alternative bundled location
    bundled: path.join(FRONTEND_DIR, 'python-site-packages')
  };

  console.log(`   Checking correct location: ${locations.correct}`);
  if (fs.existsSync(locations.correct)) {
    console.log(`   ✓ Found site-packages at correct location`);
    // Check for key packages
    const hasDotenv = fs.existsSync(path.join(locations.correct, 'dotenv'));
    const hasSDK = fs.existsSync(path.join(locations.correct, 'claude_agent_sdk'));
    console.log(`     - python-dotenv: ${hasDotenv ? '✓' : '✗'}`);
    console.log(`     - claude-agent-sdk: ${hasSDK ? '✓' : '✗'}`);
    return locations.correct;
  }

  console.log(`   ✗ Not found at correct location`);

  console.log(`   Checking legacy location: ${locations.legacy}`);
  if (fs.existsSync(locations.legacy)) {
    console.log(`   ⚠ Found at legacy location (needs sitecustomize.py fix)`);
    return locations.legacy;
  }

  console.log(`   Checking bundled location: ${locations.bundled}`);
  if (fs.existsSync(locations.bundled)) {
    console.log(`   ⚠ Found at bundled location`);
    return locations.bundled;
  }

  console.log(`   ✗ No bundled site-packages found`);
  return null;
}

const sitePackagesPath = findSitePackages();

// Step 3: Test Python imports
console.log('\n3. Testing Python imports...');
function testPythonImports() {
  return new Promise((resolve) => {
    const env = {
      ...process.env,
      PYTHONUNBUFFERED: '1',
      PYTHONIOENCODING: 'utf-8',
      PYTHONUTF8: '1',
      PYTHONDONTWRITEBYTECODE: '1',
      PYTHONNOUSERSITE: '1'
    };

    if (sitePackagesPath) {
      env.PYTHONPATH = sitePackagesPath;
      console.log(`   Setting PYTHONPATH: ${sitePackagesPath}`);
    }

    const testScript = [
      'import sys',
      'import time',
      'start = time.time()',
      'try:',
      '    import dotenv',
      '    print("✓ python-dotenv imported")',
      'except ImportError as e:',
      '    print(f"✗ python-dotenv failed: {e}")',
      '    sys.exit(1)',
      'try:',
      '    import anthropic',
      '    print("✓ anthropic imported")',
      'except ImportError as e:',
      '    print(f"✗ anthropic failed: {e}")',
      '    sys.exit(1)',
      'try:',
      '    import claude_agent_sdk',
      '    print("✓ claude_agent_sdk imported")',
      'except ImportError as e:',
      '    print(f"✗ claude_agent_sdk failed: {e}")',
      '    sys.exit(1)',
      'elapsed = time.time() - start',
      'print(f"Import time: {elapsed:.3f}s")'
    ].join('\n');

    const proc = spawn(pythonPath, ['-c', testScript], { env });

    let output = '';
    proc.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      process.stdout.write('   ' + text);
    });

    proc.stderr.on('data', (data) => {
      const text = data.toString();
      output += text;
      process.stderr.write('   ' + text);
    });

    proc.on('close', (code) => {
      resolve({ success: code === 0, output });
    });
  });
}

// Step 4: Test Claude SDK initialization
console.log('\n4. Testing Claude SDK client initialization...');
function testSDKInitialization() {
  return new Promise((resolve) => {
    const env = {
      ...process.env,
      PYTHONUNBUFFERED: '1',
      PYTHONIOENCODING: 'utf-8',
      PYTHONUTF8: '1',
      PYTHONDONTWRITEBYTECODE: '1',
      PYTHONNOUSERSITE: '1',
      // SDK requires OAuth token - use dummy for import test
      CLAUDE_CODE_OAUTH_TOKEN: process.env.CLAUDE_CODE_OAUTH_TOKEN || 'test-token'
    };

    if (sitePackagesPath) {
      env.PYTHONPATH = sitePackagesPath;
    }

    const testScript = [
      'import sys',
      'import time',
      'import os',
      '',
      'start = time.time()',
      'print(f"[{time.time() - start:.3f}s] Starting SDK test")',
      '',
      'try:',
      '    from claude_agent_sdk import ClaudeSDKClient',
      '    print(f"[{time.time() - start:.3f}s] ✓ ClaudeSDKClient imported")',
      'except ImportError as e:',
      '    print(f"[{time.time() - start:.3f}s] ✗ Import failed: {e}")',
      '    sys.exit(1)',
      '',
      '# Test client instantiation (will fail without valid token, but tests initialization)',
      'try:',
      '    print(f"[{time.time() - start:.3f}s] Attempting to create client...")',
      '    client = ClaudeSDKClient(',
      '        api_key=os.environ.get("CLAUDE_CODE_OAUTH_TOKEN", "test"),',
      '        model="claude-sonnet-4-5-20250929"',
      '    )',
      '    print(f"[{time.time() - start:.3f}s] ✓ Client created successfully")',
      'except Exception as e:',
      '    # Expected to fail with invalid token, but import/instantiation should work',
      '    error_msg = str(e)',
      '    if "authentication" in error_msg.lower() or "api" in error_msg.lower():',
      '        print(f"[{time.time() - start:.3f}s] ✓ Client creation reached auth (expected with test token)")',
      '    else:',
      '        print(f"[{time.time() - start:.3f}s] ✗ Unexpected error: {e}")',
      '        import traceback',
      '        traceback.print_exc()',
      '        sys.exit(1)',
      '',
      'elapsed = time.time() - start',
      'print(f"Total time: {elapsed:.3f}s")',
      'print(f"RESULT: {"SUCCESS" if elapsed < 60 else "TIMEOUT_RISK"}")'
    ].join('\n');

    const startTime = Date.now();
    const proc = spawn(pythonPath, ['-c', testScript], { env });

    let output = '';
    let hasResponse = false;

    proc.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      hasResponse = true;
      process.stdout.write('   ' + text);
    });

    proc.stderr.on('data', (data) => {
      const text = data.toString();
      output += text;
      process.stderr.write('   ' + text);
    });

    // Set timeout to detect hanging (like the .exe issue)
    const timeout = setTimeout(() => {
      if (!hasResponse) {
        console.log('   ✗ TIMEOUT: No response after 10 seconds (simulating .exe issue)');
        proc.kill();
      }
    }, 10000);

    proc.on('close', (code) => {
      clearTimeout(timeout);
      const elapsed = (Date.now() - startTime) / 1000;
      resolve({
        success: code === 0,
        output,
        elapsed,
        timedOut: !hasResponse
      });
    });
  });
}

// Run all tests
(async function main() {
  // Test imports first
  const importResult = await testPythonImports();

  if (!importResult.success) {
    console.log('\n=== FAILED ===');
    console.log('Python imports failed. Cannot proceed with SDK test.');
    console.log('\nDiagnosis:');
    console.log('- Check that python-runtime is downloaded: npm run python:download');
    console.log('- Check that site-packages are bundled to correct location');
    console.log('- On .exe, check resources/python/Lib/site-packages/ contains packages');
    process.exit(1);
  }

  // Test SDK initialization
  const sdkResult = await testSDKInitialization();

  console.log('\n=== Test Results ===');
  console.log(`Python Path: ${pythonPath}`);
  console.log(`Site Packages: ${sitePackagesPath || 'None (using system)'}`);
  console.log(`Imports: ${importResult.success ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`SDK Init: ${sdkResult.success ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`Timing: ${sdkResult.elapsed?.toFixed(3)}s`);

  if (sdkResult.timedOut) {
    console.log(`\n⚠ TIMEOUT DETECTED - This matches the .exe issue!`);
    console.log('The subprocess hung without any output.');
    console.log('\nPossible causes:');
    console.log('1. ASAR path resolution issues preventing module loading');
    console.log('2. stdio buffering in packaged environment');
    console.log('3. Environment variable not properly passed to subprocess');
    console.log('4. Permission issues with bundled Python executable');
  } else if (sdkResult.elapsed && sdkResult.elapsed > 5) {
    console.log(`\n⚠ WARNING: Initialization took ${sdkResult.elapsed.toFixed(1)}s (>5s threshold)`);
    console.log('This may indicate packaging-related performance issues.');
  } else {
    console.log(`\n✓ All tests passed in ${sdkResult.elapsed?.toFixed(3)}s`);
  }

  console.log('\n=== Next Steps ===');
  if (!sdkResult.success || sdkResult.timedOut) {
    console.log('To debug further:');
    console.log('1. Build .exe and run this test in packaged environment');
    console.log('2. Compare timing between dev and .exe versions');
    console.log('3. Check process spawn method in agent-process.ts');
    console.log('4. Add stdio buffering fixes if needed');
  } else {
    console.log('Test environment is working correctly.');
    console.log('If .exe still fails, issue is specific to electron-builder packaging.');
  }

  process.exit(sdkResult.success ? 0 : 1);
})();
