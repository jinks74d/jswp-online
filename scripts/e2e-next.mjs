/**
 * Runs `next build` / `next start` for the E2E suite with NEXT_DIST_DIR set.
 *
 * Exists because npm scripts cannot set an environment variable in a way that
 * works on both Windows and POSIX, and adding cross-env for one variable is a
 * dependency this repo does not need (CLAUDE.md section 15.1).
 *
 * The variable matters: next.config.js reads it as `distDir`, so the E2E build
 * lands in .next-e2e instead of .next. `next build` and `next dev` share .next,
 * and building while a dev server is running corrupts it — the app then fails
 * at runtime in ways that look like a code bug. Keeping the two apart means
 * running E2E can never disturb the dev server you have open.
 *
 * Usage: node scripts/e2e-next.mjs build
 *        node scripts/e2e-next.mjs start [port]
 */

import { spawn } from "node:child_process";

const [, , cmd, portArg] = process.argv;

if (cmd !== "build" && cmd !== "start") {
  console.error("usage: node scripts/e2e-next.mjs <build|start> [port]");
  process.exit(1);
}

const port = portArg ?? process.env.E2E_PORT ?? "3100";
const args = cmd === "build" ? ["next", "build"] : ["next", "start", "-p", port];

const child = spawn("npx", args, {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, NEXT_DIST_DIR: ".next-e2e" },
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
