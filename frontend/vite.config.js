import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendPort = env.BACKEND_PORT || 3005;
  const backendHost = env.BACKEND_HOST || 'localhost';
  const frontendPort = parseInt(env.FRONTEND_PORT || '5185', 10);
  const frontendHost = env.FRONTEND_HOST || '0.0.0.0';
  const apiBaseUrl = env.VITE_API_BASE_URL || '/api';

  return {
    plugins: [vue()],
    define: {
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(apiBaseUrl)
    },
    server: {
      port: frontendPort,
      host: frontendHost,
      strictPort: true,
      proxy: {
        '/api': {
          target: `http://${backendHost}:${backendPort}`,
          changeOrigin: true
        }
      }
    }
  };
});
