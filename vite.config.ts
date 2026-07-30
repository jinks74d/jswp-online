/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test-setup.ts'],
    // Schema/RLS suites talk to a live Supabase project and need real fetch
    // plus the node environment. They run under their own config via
    // `npm run test:rls`; collecting them here made `test:run` fail always
    // (jsdom + the mocked fetch in test-setup.ts), which in turn meant the
    // documented pre-PR gate could never pass.
    exclude: ['**/node_modules/**', '**/dist/**', '__tests__/schema/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  define: {
    'process.env.NEXT_PUBLIC_SUPABASE_URL': '"http://localhost:54321"',
    'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': '"test-key"',
    'process.env.NODE_ENV': '"test"',
  },
});