/**
 * Shared exemplar constants (chunk 6.1).
 *
 * Lives outside the "use server" boundary so both server actions
 * (lib/actions/exemplars.ts) and client form (exemplar-form.tsx) can
 * import the same authoritative cap.
 */

export const EXEMPLAR_TEXT_MAX = 20_000;
