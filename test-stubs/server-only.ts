/**
 * Test stub for the `server-only` marker package.
 *
 * `server-only` throws unless the importer resolves the "react-server"
 * export condition, which vitest does not. Modules that guard themselves with
 * `import "server-only"` are therefore unimportable from a test — including
 * the pure parsing and validation logic this repo keeps behind that guard.
 *
 * vite.config.ts aliases the package here so the guard is inert under test.
 * The real guard still applies to the Next.js bundler, which is the only place
 * it does anything: it exists to keep jsdom and service-role keys out of the
 * client bundle, not to constrain the test runner.
 *
 * Replaces the per-file `vi.mock("server-only", () => ({}))` incantation.
 */

export {};
