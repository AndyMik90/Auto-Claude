
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runPythonSubprocess } from './subprocess-runner';
import * as childProcess from 'child_process';
import EventEmitter from 'events';

// Mock child_process.spawn
vi.mock('child_process', () => ({
  spawn: vi.fn(),
  exec: vi.fn(),
}));

// Mock parsePythonCommand
vi.mock('../../../python-detector', () => ({
  parsePythonCommand: vi.fn((path) => {
    // specific behavior for spaced paths can be mocked here or overwridden in tests
    if (path.includes(' ')) {
        return [path, []]; // Simple pass-through for test
    }
    return [path, []];
  }),
}));

import { parsePythonCommand } from '../../../python-detector';

describe('runPythonSubprocess', () => {
  let mockSpawn: any;
  let mockChildProcess: any;

  beforeEach(() => {
    mockSpawn = vi.mocked(childProcess.spawn);
    mockChildProcess = new EventEmitter();
    mockChildProcess.stdout = new EventEmitter();
    mockChildProcess.stderr = new EventEmitter();
    mockChildProcess.kill = vi.fn();
    mockSpawn.mockReturnValue(mockChildProcess);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should handle python path with spaces', async () => {
    // Arrange
    const pythonPath = '/path/with spaces/python';
    const mockArgs = ['-c', 'print("hello")'];
    
    // Mock parsePythonCommand to return the path split logic if needed, 
    // or just rely on the mock above. 
    // Let's make sure our mock enables the scenario we want.
    vi.mocked(parsePythonCommand).mockReturnValue(['/path/with spaces/python', []]);
    
    // Act
    runPythonSubprocess({
      pythonPath,
      args: mockArgs,
      cwd: '/tmp',
    });

    // Assert
    expect(parsePythonCommand).toHaveBeenCalledWith(pythonPath);
    expect(mockSpawn).toHaveBeenCalledWith(
      '/path/with spaces/python',
      expect.arrayContaining(mockArgs),
      expect.any(Object)
    );
  });

  it('should pass user arguments AFTER python arguments', async () => {
    // Arrange
    const pythonPath = 'python';
    const pythonBaseArgs = ['-u', '-X', 'utf8'];
    const userArgs = ['script.py', '--verbose'];
    
    // Setup mock to simulate what parsePythonCommand would return for a standard python path
    vi.mocked(parsePythonCommand).mockReturnValue(['python', pythonBaseArgs]);

    // Act
    runPythonSubprocess({
      pythonPath,
      args: userArgs,
      cwd: '/tmp',
    });

    // Assert
    // The critical check: verify the ORDER of arguments in the second parameter of spawn
    // expect call to be: spawn('python', ['-u', '-X', 'utf8', 'script.py', '--verbose'], ...)
    const expectedArgs = [...pythonBaseArgs, ...userArgs];
    
    expect(mockSpawn).toHaveBeenCalledWith(
      expect.any(String),
      expectedArgs, // Exact array match verifies order
      expect.any(Object)
    );
  });

  it('should timeout and kill subprocess when timeout is exceeded', async () => {
    // Arrange
    const pythonPath = 'python';
    const timeout = 100; // 100ms timeout
    const onTimeout = vi.fn();
    const onError = vi.fn();
    
    vi.mocked(parsePythonCommand).mockReturnValue(['python', []]);
    
    // Act
    const { promise } = runPythonSubprocess({
      pythonPath,
      args: ['script.py'],
      cwd: '/tmp',
      timeout,
      onTimeout,
      onError,
    });
    
    // Wait for timeout to trigger
    await vi.waitFor(
      () => {
        expect(onTimeout).toHaveBeenCalled();
      },
      { timeout: 200 }
    );
    
    // Assert
    const result = await promise;
    expect(result.success).toBe(false);
    expect(result.error).toContain('timed out');
    expect(mockChildProcess.kill).toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('timed out'));
  });

  it('should clear timeout when subprocess completes successfully', async () => {
    // Arrange
    const pythonPath = 'python';
    const timeout = 1000; // 1 second timeout
    const onComplete = vi.fn((stdout) => ({ result: 'success' }));
    const onTimeout = vi.fn();
    
    vi.mocked(parsePythonCommand).mockReturnValue(['python', []]);
    
    // Act
    const { promise } = runPythonSubprocess({
      pythonPath,
      args: ['script.py'],
      cwd: '/tmp',
      timeout,
      onComplete,
      onTimeout,
    });
    
    // Simulate successful completion before timeout
    setTimeout(() => {
      mockChildProcess.stdout.emit('data', Buffer.from('output\n'));
      mockChildProcess.emit('close', 0);
    }, 50);
    
    // Assert
    const result = await promise;
    expect(result.success).toBe(true);
    expect(onComplete).toHaveBeenCalled();
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('should clear timeout when subprocess fails', async () => {
    // Arrange
    const pythonPath = 'python';
    const timeout = 1000; // 1 second timeout
    const onError = vi.fn();
    const onTimeout = vi.fn();
    
    vi.mocked(parsePythonCommand).mockReturnValue(['python', []]);
    
    // Act
    const { promise } = runPythonSubprocess({
      pythonPath,
      args: ['script.py'],
      cwd: '/tmp',
      timeout,
      onError,
      onTimeout,
    });
    
    // Simulate process error before timeout
    setTimeout(() => {
      mockChildProcess.emit('error', new Error('Process failed'));
    }, 50);
    
    // Assert
    const result = await promise;
    expect(result.success).toBe(false);
    expect(onError).toHaveBeenCalledWith('Process failed');
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('should not set timeout when timeout parameter is not provided', async () => {
    // Arrange
    const pythonPath = 'python';
    const onTimeout = vi.fn();
    
    vi.mocked(parsePythonCommand).mockReturnValue(['python', []]);
    
    // Act
    const { promise } = runPythonSubprocess({
      pythonPath,
      args: ['script.py'],
      cwd: '/tmp',
      // No timeout parameter
      onTimeout,
    });
    
    // Simulate delayed completion
    setTimeout(() => {
      mockChildProcess.emit('close', 0);
    }, 200);
    
    // Assert
    const result = await promise;
    expect(result.success).toBe(true);
    expect(onTimeout).not.toHaveBeenCalled();
  });
});
