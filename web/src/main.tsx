import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { router } from './routes';
import './styles.css';
import { ThemeProvider } from './lib/theme';
import { ToastProvider } from './components/ui/Toast';
import { PwaUpdates } from './components/PwaUpdates';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { OfflineBanner } from './components/OfflineBanner';
import { listenForInstall } from './lib/install';

listenForInstall();
if (import.meta.env.DEV && import.meta.env.VITE_MOCK === '1') await import('./mock/install');
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ToastProvider>
            <PwaUpdates />
            <OfflineBanner />
            <RouterProvider router={router} />
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  </React.StrictMode>,
);
