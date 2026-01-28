/**
 * WSL2 Detection Script
 *
 * Validates that the development environment is running in WSL2 before allowing
 * --no-sandbox flag usage. This prevents accidental use of disabled Chromium
 * sandbox outside of WSL2 environments where it's required.
 *
 * Usage: node scripts/check-wsl2.cjs
 * Exit codes:
 *   0 - Running in WSL2 (safe to use --no-sandbox)
 *   1 - Not running in WSL2 (should not use --no-sandbox)
 */

const fs = require('fs');

/**
 * Check if running in WSL2 environment
 *
 * Detection methods (in order of reliability):
 * 1. WSL_DISTRO_NAME environment variable - set by WSL2 automatically
 * 2. /proc/version contains 'microsoft' - WSL2 kernel signature
 *
 * @returns {boolean} true if in WSL2, false otherwise
 */
function isWSL2() {
  // Check WSL_DISTRO_NAME environment variable (most reliable)
  if (process.env.WSL_DISTRO_NAME) {
    return true;
  }

  // Check /proc/version for WSL2 kernel signature (Linux only)
  if (process.platform === 'linux') {
    try {
      const versionInfo = fs.readFileSync('/proc/version', 'utf8').toLowerCase();
      return versionInfo.includes('microsoft');
    } catch {
      return false;
    }
  }

  return false;
}

// Main execution
const isWsl2 = isWSL2();

if (isWsl2) {
  console.log('✓ WSL2 environment detected - --no-sandbox flag is safe to use');
  process.exit(0);
} else {
  console.error('✗ Not running in WSL2!');
  console.error('');
  console.error('The dev:wsl2 script is designed for WSL2 environments only.');
  console.error('It disables Chromium sandbox (--no-sandbox) which is a security risk outside WSL2.');
  console.error('');
  console.error('Please use one of these alternatives:');
  console.error('  • npm run dev        - Development mode with Chromium sandbox enabled');
  console.error('  • npm run dev:debug  - Debug mode with Chromium sandbox enabled');
  console.error('');
  console.error('If you are in WSL2 but seeing this error, check:');
  console.error('  1. WSL_DISTRO_NAME environment variable is set');
  console.error('  2. Running WSL2 (not WSL1): wsl.exe --list --verbose');
  process.exit(1);
}
