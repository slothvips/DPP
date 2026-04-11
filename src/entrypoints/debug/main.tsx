import 'virtual:uno.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToastProvider } from '@/components/ui/toast';
import { useTheme } from '@/hooks/useTheme';
import '@unocss/reset/tailwind.css';
import { DebugOperationsTable } from './DebugOperationsTable';
import { DebugStats } from './DebugStats';
import { useDebugOperations } from './useDebugOperations';

function DebugApp() {
  useTheme();
  const { key, ops, filteredOps, loading, filter, setFilter, loadOps, decryptAll } =
    useDebugOperations();

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Sync Data Debugger</h1>
          <div className="flex gap-4">
            <Button onClick={() => void loadOps()} variant="outline">
              Reload Ops
            </Button>
            <Button onClick={() => void decryptAll()} disabled={loading || !key}>
              {loading ? 'Decrypting...' : 'Decrypt All'}
            </Button>
          </div>
        </div>

        <DebugStats ops={ops} hasKey={Boolean(key)} />

        <div className="space-y-2">
          <Label>Filter Results</Label>
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search in payload..."
          />
        </div>

        <DebugOperationsTable operations={filteredOps} />
      </div>
    </div>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ToastProvider>
        <ErrorBoundary>
          <DebugApp />
        </ErrorBoundary>
      </ToastProvider>
    </React.StrictMode>
  );
}
