import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// BASE_PATH diisi otomatis oleh GitHub Actions (mis. "/fokus-app/").
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
  build: { chunkSizeWarningLimit: 1000 },
});
