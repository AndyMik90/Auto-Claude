import { ConnectionStatus } from './components/ConnectionStatus';

export function App() {
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
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-foreground">
            Web UI Loading...
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Setting up Auto-Claude web interface
          </p>
        </div>
      </main>
    </div>
  );
}
