import 'virtual:uno.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ToastProvider } from '@/components/ui/toast';
import { DiffView } from '@/features/toolbox/components/DiffTool/DiffView';
import '@unocss/reset/tailwind.css';

function DiffApp() {
  return (
    <div className="h-screen w-screen bg-background text-foreground">
      <DiffView />
    </div>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ToastProvider>
        <ErrorBoundary>
          <DiffApp />
        </ErrorBoundary>
      </ToastProvider>
    </React.StrictMode>
  );
}
