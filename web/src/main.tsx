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
import { LaunchSplash } from './components/LaunchSplash';
if (import.meta.env.DEV && import.meta.env.VITE_MOCK === '1') await import('./mock/install');
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <LaunchSplash />
      <AppErrorBoundary>
        <ThemeProvider>
          <ToastProvider>
            <PwaUpdates />
            <RouterProvider router={router} />
          </ToastProvider>
        </ThemeProvider>
      </AppErrorBoundary>
    </QueryClientProvider>
  </React.StrictMode>,
);
