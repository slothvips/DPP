import 'virtual:uno.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import '@unocss/reset/tailwind.css';
import { PlayerApp } from './PlayerApp';

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <ErrorBoundary>
        <PlayerApp />
      </ErrorBoundary>
    </React.StrictMode>
  );
}
