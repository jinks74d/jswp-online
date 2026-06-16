/**
 * Source-text rich-content helpers (Chunk 1 of the structured-source work;
 * see docs/SOURCE_TEXT_ARCHITECTURE.md).
 *
 * SERVER ONLY — the implementation pulls in jsdom for DOMPurify's DOM provider
 * and for the substrate projection. This module is the server-only boundary:
 * app code imports from here so jsdom never lands in a client bundle. The pure
 * implementation lives in source-content-core.ts (also imported by the backfill
 * script, which runs in plain node where the server-only guard would throw).
 */

import "server-only";

export { sanitizeSourceHtml, sourceHtmlToSubstrate } from "./source-content-core";
