import 'virtual:uno.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import '@unocss/reset/tailwind.css';
import { GuideApp } from './GuideApp';

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <GuideApp />
    </React.StrictMode>
  );
}
