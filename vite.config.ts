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
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary', 'html'],
      reportsDirectory: './coverage',
      // Report on the source the refactor actually moves. Route files and
      // step components are covered by Playwright, not here, so counting
      // them would make this number meaningless as a refactor gate.
      include: ['lib/**/*.ts', 'components/**/*.tsx', 'hooks/**/*.ts'],
      exclude: [
        'lib/database.types.ts', // generated; CLAUDE.md section 8 says do not test
        'lib/supabase/**', // thin SDK factories, tested upstream
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/__tests__/**',
      ],
      all: true, // count untested files as 0% instead of omitting them
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      // `server-only` throws unless the importer resolves the "react-server"
      // export condition, which vitest does not — so every module guarded by
      // it was unimportable from a test. Stub it globally instead of repeating
      // vi.mock("server-only") in each file. See test-stubs/server-only.ts.
      'server-only': path.resolve(__dirname, './test-stubs/server-only.ts'),
    },
  },
  define: {
    'process.env.NEXT_PUBLIC_SUPABASE_URL': '"http://localhost:54321"',
    'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': '"test-key"',
    'process.env.NODE_ENV': '"test"',
  },
});