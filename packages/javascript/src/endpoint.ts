/**
 * endpoint.ts
 * Where the SilkLLM API lives.
 *
 * This is the single place the JavaScript SDK records the service address.
 * Callers are not expected to know or supply it: `new SilkLLM({ apiKey })`
 * resolves the endpoint on its own, and if the service ever moves, only this
 * file changes.
 *
 * Resolution order:
 *   1. an explicit baseUrl option    (self-hosted or a private deployment)
 *   2. the SILKLLM_BASE_URL env var  (staging, local backend, CI)
 *   3. the managed service           (what nearly everyone uses)
 */

// File: silkllm-sdks/packages/javascript/src/endpoint.ts

/**
 * The managed SilkLLM service. Note there is no "/api" suffix; the SDK appends
 * the path segments it needs.
 */
export const DEFAULT_BASE_URL = "https://silkllm-backend.169.58.53.167.nip.io";

/** Return the base URL to talk to, without a trailing slash. */
export function resolveBaseUrl(explicit?: string): string {
  const fromEnv = typeof process !== "undefined" ? process.env?.SILKLLM_BASE_URL : undefined;
  return (explicit || fromEnv || DEFAULT_BASE_URL).replace(/\/$/, "");
}

// EOF silkllm-sdks/packages/javascript/src/endpoint.ts
