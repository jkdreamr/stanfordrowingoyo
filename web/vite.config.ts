import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { pwaPlugin } from './pwaPlugin';
export default defineConfig({
  plugins: [react(), pwaPlugin()],
  server: { proxy: { '/api': 'http://127.0.0.1:8787' } },
});
