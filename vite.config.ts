import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const loadedEnv = loadEnv(mode, '.', '');
  const dotEnvPath = path.resolve(__dirname, '.env');
  const dotEnvFile = fs.existsSync(dotEnvPath)
    ? dotenv.parse(fs.readFileSync(dotEnvPath, 'utf-8'))
    : {};

  const pickEnv = (keys: string[], allowEmptyFromFile = false): string => {
    for (const k of keys) {
      if (Object.prototype.hasOwnProperty.call(dotEnvFile, k)) {
        const fileVal = (dotEnvFile[k] || '').trim();
        if (fileVal !== '' || allowEmptyFromFile) {
          return fileVal;
        }
      }
    }
    for (const k of keys) {
      const procVal = (loadedEnv[k] || '').trim();
      if (procVal !== '') {
        return procVal;
      }
    }
    return '';
  };

  const resolvedSupabaseUrl = (() => {
    const fromFile = pickEnv(['VITE_SUPABASE_URL', 'SUPABASE_URL']);
    if (fromFile.startsWith('https://')) return fromFile;
    const alt = [
      dotEnvFile.SUPABASE_URL,
      dotEnvFile.VITE_SUPABASE_URL,
      loadedEnv.SUPABASE_URL,
      loadedEnv.VITE_SUPABASE_URL,
    ]
      .map(v => (v || '').trim())
      .find(v => v.startsWith('https://'));
    return alt || fromFile;
  })();

  const resolvedSupabaseKey = pickEnv([
    'VITE_SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_PUBLISHABLE_KEY',
    'VITE_SUPABASE_ANON_KEY',
    'VITE_ANON_KEY',
    'ANON_KEY',
  ]);

  const resolvedDataSource = pickEnv(['VITE_DATA_SOURCE', 'DATA_SOURCE']) || 'supabase';
  const resolvedSpreadsheetId = pickEnv(['VITE_SPREADSHEET_ID', 'SPREADSHEET_ID'], true);
  const resolvedScriptUrl = pickEnv(['VITE_SCRIPT_URL', 'SCRIPT_URL'], true);

  return {
    plugins: [
      react(),
      tailwindcss()
    ],

    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(pickEnv(['GEMINI_API_KEY'])),
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(resolvedSupabaseUrl),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(resolvedSupabaseKey),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(resolvedSupabaseKey),
      'import.meta.env.VITE_DATA_SOURCE': JSON.stringify(resolvedDataSource),
      'import.meta.env.VITE_SPREADSHEET_ID': JSON.stringify(resolvedSpreadsheetId),
      'import.meta.env.VITE_SCRIPT_URL': JSON.stringify(resolvedScriptUrl),
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