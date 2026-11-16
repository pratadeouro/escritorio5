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
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || env.SUPABASE_URL || ''),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY || env.VITE_ANON_KEY || env.ANON_KEY || ''),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || env.VITE_ANON_KEY || env.ANON_KEY || ''),
      'import.meta.env.VITE_DATA_SOURCE': JSON.stringify(env.VITE_DATA_SOURCE || env.DATA_SOURCE || 'supabase'),
      'import.meta.env.VITE_SPREADSHEET_ID': JSON.stringify(env.VITE_SPREADSHEET_ID || env.SPREADSHEET_ID || ''),
      'import.meta.env.VITE_SCRIPT_URL': JSON.stringify(env.VITE_SCRIPT_URL || env.SCRIPT_URL || ''),
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