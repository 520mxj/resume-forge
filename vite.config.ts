import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' 让 dist 既能放在 GitHub Pages 的项目子路径下，也能直接双击本地打开
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1800,
  },
  server: {
    port: 5273,
    strictPort: true,
  },
  preview: {
    port: 4173,
  },
});
