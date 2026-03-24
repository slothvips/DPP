import 'virtual:uno.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ToastProvider } from '@/components/ui/toast';
import { DataDiffView } from '@/features/toolbox/components/DataDiffTool/DataDiffView';
import '@unocss/reset/tailwind.css';

function DataDiffApp() {
  return (
    <div className="h-screen w-screen bg-background text-foreground">
      <DataDiffView />
    </div>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ToastProvider>
        <ErrorBoundary>
          <DataDiffApp />
        </ErrorBoundary>
      </ToastProvider>
    </React.StrictMode>
  );
}
