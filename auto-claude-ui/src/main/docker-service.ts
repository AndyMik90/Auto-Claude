/**
 * Docker & FalkorDB Service
 *
 * Provides automatic detection and management of Docker and FalkorDB
 * for non-technical users. This eliminates the need for manual
 * "docker --version" verification steps.
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// FalkorDB container configuration
const FALKORDB_CONTAINER_NAME = 'auto-claude-falkordb';
const FALKORDB_IMAGE = 'falkordb/falkordb:latest';
const FALKORDB_DEFAULT_PORT = 6380;

export interface DockerStatus {
  installed: boolean;
  running: boolean;
  version?: string;
  error?: string;
}

export interface FalkorDBStatus {
  containerExists: boolean;
  containerRunning: boolean;
  containerName: string;
  port: number;
  healthy: boolean;
  error?: string;
}

export interface InfrastructureStatus {
  docker: DockerStatus;
  falkordb: FalkorDBStatus;
  ready: boolean; // True if both Docker is running and FalkorDB is healthy
}

/**
 * Check if Docker is installed and running
 */
export async function checkDockerStatus(): Promise<DockerStatus> {
  try {
    // Check if Docker CLI is available
    const { stdout: versionOutput } = await execAsync('docker --version', {
      timeout: 5000,
    });

    const version = versionOutput.trim();

    // Check if Docker daemon is running by trying to ping it
    try {
      await execAsync('docker info', { timeout: 10000 });
      return {
        installed: true,
        running: true,
        version,
      };
    } catch {
      return {
        installed: true,
        running: false,
        version,
        error: 'Docker is installed but not running. Please start Docker Desktop.',
      };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    // Check if it's a "command not found" type error
    if (
      errorMsg.includes('not found') ||
      errorMsg.includes('ENOENT') ||
      errorMsg.includes('not recognized')
    ) {
      return {
        installed: false,
        running: false,
        error: 'Docker is not installed. Please install Docker Desktop.',
      };
    }

    return {
      installed: false,
      running: false,
      error: `Docker check failed: ${errorMsg}`,
    };
  }
}

/**
 * Check FalkorDB container status
 */
export async function checkFalkorDBStatus(port: number = FALKORDB_DEFAULT_PORT): Promise<FalkorDBStatus> {
  const status: FalkorDBStatus = {
    containerExists: false,
    containerRunning: false,
    containerName: FALKORDB_CONTAINER_NAME,
    port,
    healthy: false,
  };

  try {
    // Check if container exists and get its status
    const { stdout } = await execAsync(
      `docker ps -a --filter "name=${FALKORDB_CONTAINER_NAME}" --format "{{.Status}}"`,
      { timeout: 5000 }
    );

    const containerStatus = stdout.trim();

    if (containerStatus) {
      status.containerExists = true;
      status.containerRunning = containerStatus.toLowerCase().startsWith('up');

      if (status.containerRunning) {
        // Check if FalkorDB is responding
        status.healthy = await checkFalkorDBHealth(port);
      }
    }

    return status;
  } catch (error) {
    status.error = error instanceof Error ? error.message : String(error);
    return status;
  }
}

/**
 * Check if FalkorDB is responding to connections
 */
async function checkFalkorDBHealth(port: number): Promise<boolean> {
  try {
    // Try to ping FalkorDB using redis-cli (FalkorDB uses Redis protocol)
    // Since we may not have redis-cli, we'll check if the port is listening
    await execAsync(`docker exec ${FALKORDB_CONTAINER_NAME} redis-cli PING`, {
      timeout: 5000,
    });
    return true;
  } catch {
    // Fallback: just check if container is running (less accurate)
    return false;
  }
}

/**
 * Get combined infrastructure status
 */
export async function getInfrastructureStatus(
  falkordbPort: number = FALKORDB_DEFAULT_PORT
): Promise<InfrastructureStatus> {
  const [docker, falkordb] = await Promise.all([
    checkDockerStatus(),
    checkFalkorDBStatus(falkordbPort),
  ]);

  return {
    docker,
    falkordb,
    ready: docker.running && falkordb.containerRunning && falkordb.healthy,
  };
}

/**
 * Start FalkorDB container
 * Creates a new container if it doesn't exist, or starts the existing one
 */
export async function startFalkorDB(
  port: number = FALKORDB_DEFAULT_PORT
): Promise<{ success: boolean; error?: string }> {
  try {
    // First, check Docker status
    const dockerStatus = await checkDockerStatus();
    if (!dockerStatus.running) {
      return {
        success: false,
        error: dockerStatus.error || 'Docker is not running',
      };
    }

    // Check if container already exists
    const falkordbStatus = await checkFalkorDBStatus(port);

    if (falkordbStatus.containerExists) {
      if (falkordbStatus.containerRunning) {
        // Already running
        return { success: true };
      }

      // Start existing container
      await execAsync(`docker start ${FALKORDB_CONTAINER_NAME}`, { timeout: 30000 });
    } else {
      // Create and start new container
      await execAsync(
        `docker run -d --name ${FALKORDB_CONTAINER_NAME} -p ${port}:6379 ${FALKORDB_IMAGE}`,
        { timeout: 60000 }
      );
    }

    // Wait for FalkorDB to be ready (up to 30 seconds)
    const ready = await waitForFalkorDB(port, 30000);

    if (!ready) {
      return {
        success: false,
        error: 'FalkorDB container started but is not responding. Please check Docker logs.',
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Stop FalkorDB container
 */
export async function stopFalkorDB(): Promise<{ success: boolean; error?: string }> {
  try {
    await execAsync(`docker stop ${FALKORDB_CONTAINER_NAME}`, { timeout: 30000 });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Wait for FalkorDB to be ready
 */
async function waitForFalkorDB(port: number, timeoutMs: number): Promise<boolean> {
  const startTime = Date.now();
  const checkInterval = 1000; // Check every second

  while (Date.now() - startTime < timeoutMs) {
    const status = await checkFalkorDBStatus(port);
    if (status.containerRunning && status.healthy) {
      return true;
    }
    // If container is running but not healthy yet, wait
    if (status.containerRunning) {
      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    } else {
      // Container stopped unexpectedly
      return false;
    }
  }

  return false;
}

/**
 * Open Docker Desktop application (macOS/Windows)
 */
export async function openDockerDesktop(): Promise<{ success: boolean; error?: string }> {
  try {
    if (process.platform === 'darwin') {
      // macOS
      await execAsync('open -a Docker', { timeout: 5000 });
    } else if (process.platform === 'win32') {
      // Windows
      spawn('cmd', ['/c', 'start', '', 'Docker Desktop'], {
        detached: true,
        stdio: 'ignore',
      });
    } else {
      // Linux - Docker doesn't have a GUI, suggest starting daemon
      return {
        success: false,
        error: 'On Linux, start Docker with: sudo systemctl start docker',
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get download URL for Docker Desktop
 */
export function getDockerDownloadUrl(): string {
  if (process.platform === 'darwin') {
    return 'https://www.docker.com/products/docker-desktop/';
  } else if (process.platform === 'win32') {
    return 'https://www.docker.com/products/docker-desktop/';
  }
  return 'https://docs.docker.com/engine/install/';
}
