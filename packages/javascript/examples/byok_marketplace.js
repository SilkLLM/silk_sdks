/**
 * byok_marketplace.js
 * Deposit and manage your own provider keys (BYOK marketplace).
 *
 * Run:
 *   export SILKLLM_API_KEY=silk_your_key
 *   node byok_marketplace.js
 */

// File: silkllm-sdks/packages/javascript/examples/byok_marketplace.js

import SilkLLM from "silkllm";

const client = new SilkLLM({
  apiKey: process.env.SILKLLM_API_KEY || "silk_your_key",
  baseUrl: process.env.SILKLLM_BASE_URL || "https://silkllm.onrender.com",
});

// Deposit a public key: SilkLLM may serve other users with it, and you earn
// platform credits (75% of provider cost) when they do. Never shown to others.
const key = await client.depositProviderKey({
  providerId: "openai",
  apiKey: "sk-replace-with-your-real-openai-key",
  label: "shared openai",
  isPublic: true,
  declaredBudgetUsd: 25.0, // we never spend past this
});
console.log(`Deposited: ${key.id}  status=${key.status}  public=${key.is_public}`);

// See your keys, earnings, and how many requests each has served.
for (const k of await client.listProviderKeys()) {
  console.log(`- ${k.label} [${k.provider_id}] public=${k.is_public} ` +
    `earned=$${k.earned_credits_total.toFixed(4)} served=${k.requests_served}`);
}

// Prefer to keep your own traffic off your own key while still sharing it.
await client.updateProviderKey(key.id, { serve_owner_with_own_key: false });

// Revoke when you are done. It stops being used immediately.
await client.revokeProviderKey(key.id);
console.log("Revoked.");

// EOF silkllm-sdks/packages/javascript/examples/byok_marketplace.js
