import { useState } from 'react';
import { ConnectionStatus } from './components/ConnectionStatus';
import { ipc } from './lib/ipc-abstraction';

export function App() {
  const [testResult, setTestResult] = useState<string>('');

  const sendTestMessage = () => {
    setTestResult('Sending test message...');

    // Send echo test
    ipc.send('echo', { message: 'Hello from Web UI!', timestamp: Date.now() });

    // Listen for response
    const handleResponse = (data: any) => {
      setTestResult(`✓ Received response: ${JSON.stringify(data)}`);
      ipc.off('echo', handleResponse);
    };

    ipc.on('echo', handleResponse);

    // Timeout after 5 seconds
    setTimeout(() => {
      if (testResult === 'Sending test message...') {
        setTestResult('✗ No response received (timeout)');
      }
    }, 5000);
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header with connection status */}
      <header className="flex items-center justify-between border-b px-4 py-2">
        <h1 className="text-lg font-semibold text-foreground">
          Auto-Claude Web UI
        </h1>
        <ConnectionStatus />
      </header>

      {/* Main content */}
      <main className="flex flex-1 items-center justify-center">
        <div className="max-w-2xl space-y-6 text-center">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">
              WebSocket Communication Test
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Test the WebSocket connection between web UI and backend
            </p>
          </div>

          <div className="space-y-4">
            <button
              onClick={sendTestMessage}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 active:bg-blue-800 transition-colors"
            >
              Send Test Message
            </button>

            {testResult && (
              <div className="rounded-md border border-gray-700 bg-gray-800/50 p-4">
                <pre className="text-left text-xs text-gray-300 whitespace-pre-wrap font-mono">
                  {testResult}
                </pre>
              </div>
            )}
          </div>

          <div className="mt-8 rounded-md border border-blue-500/20 bg-blue-500/10 p-4 text-left">
            <h3 className="mb-2 text-sm font-semibold text-blue-400">
              Verification Steps:
            </h3>
            <ol className="list-decimal space-y-1 pl-5 text-xs text-blue-300">
              <li>Check that the connection status shows "Connected" (green)</li>
              <li>Click "Send Test Message" button</li>
              <li>Verify response appears below the button</li>
              <li>Check browser console for WebSocket logs</li>
              <li>Check backend logs for message receipt</li>
            </ol>
          </div>
        </div>
      </main>
    </div>
  );
}
