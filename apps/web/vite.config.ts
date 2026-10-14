import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// En desarrollo y en vista previa, /api se reenvia a la API (sin el prefijo /api).
const destino = process.env.API_URL ?? 'http://127.0.0.1:3000';
const proxy = {
  '/api': { target: destino, changeOrigin: true, rewrite: (p: string) => p.replace(/^\/api/, '') },
};

export default defineConfig({
  plugins: [react()],
  server: { proxy },
  preview: { proxy },
});
