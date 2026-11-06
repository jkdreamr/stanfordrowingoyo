import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from './routes';
import './styles.css';
import { ThemeProvider } from './lib/theme';
import { ToastProvider } from './components/ui/Toast';
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={new QueryClient()}>
      <ThemeProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
if ('serviceWorker' in navigator)
  window.addEventListener('load', () => {
    if (import.meta.env.PROD) void navigator.serviceWorker.register('/sw.js');
  });
