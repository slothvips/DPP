import { useLiveQuery } from 'dexie-react-hooks';
import 'virtual:uno.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToastProvider } from '@/components/ui/toast';
import { type JenkinsMetricSnapshot, db } from '@/db';
import { useTheme } from '@/hooks/useTheme';
import '@unocss/reset/tailwind.css';
import { DebugOperationsTable } from './DebugOperationsTable';
import { DebugStats } from './DebugStats';
import { useDebugOperations } from './useDebugOperations';

function DebugApp() {
  useTheme();
  const { key, ops, filteredOps, loading, filter, setFilter, loadOps, decryptAll } =
    useDebugOperations();
  const jenkinsSyncStates = useLiveQuery(() => db.jenkinsSyncState.toArray(), [], []);

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

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Jenkins Sync Diagnostics</h2>
          {jenkinsSyncStates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No Jenkins sync state recorded.</p>
          ) : (
            <div className="overflow-x-auto rounded border">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left">
                  <tr>
                    <th className="px-3 py-2">Environment</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Last Attempt</th>
                    <th className="px-3 py-2">Last Success</th>
                    <th className="px-3 py-2">Pipeline</th>
                    <th className="px-3 py-2">Queue</th>
                    <th className="px-3 py-2">Metrics</th>
                    <th className="px-3 py-2">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {jenkinsSyncStates.map((state) => (
                    <tr key={state.envId} className="border-b last:border-0">
                      <td className="px-3 py-2 font-mono">{state.envId}</td>
                      <td className="px-3 py-2">{state.status}</td>
                      <td className="px-3 py-2">{formatDebugTime(state.lastAttemptAt)}</td>
                      <td className="px-3 py-2">{formatDebugTime(state.lastSuccessAt)}</td>
                      <td className="px-3 py-2">
                        {state.capabilities?.pipelineRest?.status ?? '-'}
                      </td>
                      <td className="px-3 py-2">
                        {state.queueState
                          ? `${state.queueState.state}${state.queueState.expired ? ' (expired)' : ''} · timeout ${state.queueState.timeouts}`
                          : '-'}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {formatDebugMetrics(state.metrics)}
                      </td>
                      <td className="max-w-md px-3 py-2 break-words">
                        {state.errorCode ? `${state.errorCode}: ${state.errorMessage || ''}` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

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

function formatDebugTime(timestamp: number | undefined): string {
  return timestamp ? new Date(timestamp).toLocaleString() : '-';
}

function formatDebugMetrics(metrics: JenkinsMetricSnapshot | undefined): string {
  if (!metrics) return '-';
  return `req ${metrics.requests.total}/${metrics.requests.failed} fail · cache ${metrics.cache.jobs}/${metrics.cache.builds} · queue ${metrics.queue.polls}/${metrics.queue.cancellations} · log ${metrics.logs.chunks}`;
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
