import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/guitar/',
  plugins: [
    react(),
    {
      name: 'redirect-guitar',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/guitar') {
            res.writeHead(301, { Location: '/guitar/' });
            res.end();
            return;
          }
          next();
        });
      },
    },
  ],
  server: {
    host: '0.0.0.0',
    port: 5174,
    proxy: {
      '/guitar-api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/guitar-images': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      }
    }
  }
})
