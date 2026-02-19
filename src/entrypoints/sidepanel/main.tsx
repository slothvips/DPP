import 'virtual:uno.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { App } from '@/entrypoints/popup/App';
import '@unocss/reset/tailwind.css';

function SidePanelApp() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <SidePanelApp />
    </React.StrictMode>
  );
}
