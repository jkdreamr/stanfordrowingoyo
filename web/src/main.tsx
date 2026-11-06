import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from './routes';
import './styles.css';
if (!localStorage.getItem('theme') ? matchMedia('(prefers-color-scheme: dark)').matches : localStorage.getItem('theme') === 'dark') document.documentElement.classList.add('dark');
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><QueryClientProvider client={new QueryClient()}><RouterProvider router={router}/></QueryClientProvider></React.StrictMode>);
if ('serviceWorker' in navigator) window.addEventListener('load', () => { if (import.meta.env.PROD) void navigator.serviceWorker.register('/sw.js'); });
