import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import config from '../config.json' with { type: 'json' };

export default defineConfig({
  plugins: [vue()],
  server: {
    port: config.frontend.port,
    host: config.frontend.host,
    strictPort: true,
    proxy: {
      '/api': {
        target: `http://${config.backend.host}:${config.backend.port}`,
        changeOrigin: true
      }
    }
  }
});
