import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ThemeProvider } from '@/shared/theme/ThemeProvider';
import '@/styles/globals.css';
import { initializePwa } from '@/pwa/register';

async function start() {
  try {
    await initializePwa({
      origin: window.location.origin,
      appUrl: import.meta.env.VITE_APP_URL,
      production: import.meta.env.PROD,
      secure: window.isSecureContext,
      document,
      serviceWorker: 'serviceWorker' in navigator ? navigator.serviceWorker : undefined,
      cacheStorage: 'caches' in window ? window.caches : undefined,
      reload: () => window.location.reload(),
    });
  } catch (error) {
    console.error('No se pudo inicializar la PWA.', error);
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </React.StrictMode>
  );
}

void start();
