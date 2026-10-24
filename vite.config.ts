import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [
      react(),
      tailwindcss()
    ],

    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://qhxdujbsipgwthrgvncl.supabase.co'),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('sb_publishable_Iyu6_roB7iGGd8-1xxK7tA_G7y7E0bL'),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('sb_publishable_Iyu6_roB7iGGd8-1xxK7tA_G7y7E0bL'),
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },

    server: {
      host: '0.0.0.0',
      port: 5173,
      allowedHosts: true,
      hmr: process.env.DISABLE_HMR !== 'true',
    },

    preview: {
      host: '0.0.0.0',
      port: 5173,
      allowedHosts: true,
    }
  };
});