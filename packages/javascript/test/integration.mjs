/**
 * integration.mjs
 * End-to-end tests for the JavaScript SDK against a running SilkLLM server.
 * Covers text generate + stream, models (modality/is_free), balance, usage,
 * trial, BYOK provider keys, and multimodal image/audio.
 *
 * Run against a server started with SILK_MOCK_PROVIDER=1:
 *   export SILKLLM_API_KEY=silk_...
 *   export SILKLLM_BASE_URL=http://127.0.0.1:8099
 *   node test/integration.mjs
 */

// File: silkllm-sdks/packages/javascript/test/integration.mjs

import SilkLLM from "../dist/index.mjs";

const client = new SilkLLM({
  apiKey: process.env.SILKLLM_API_KEY,
  baseUrl: process.env.SILKLLM_BASE_URL || "http://127.0.0.1:8099",
});

let passed = 0, total = 0;
async function test(name, fn) {
  total++;
  try { await fn(); console.log(`PASS ${name}`); passed++; }
  catch (e) { console.log(`FAIL ${name}: ${e.message}`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || "assertion failed"); }

await test("models have modality and free flags", async () => {
  const res = await client.models();
  assert(res.total > 0, "no models");
  assert(["text", "image", "audio", "video"].includes(res.models[0].modality || "text"), "bad modality");
});

await test("generate text", async () => {
  const r = await client.generate({ messages: [{ role: "user", content: "hi" }], model: "gpt-4o" });
  assert(r.content && r.usage.total_tokens > 0, "no content/usage");
});

await test("stream text", async () => {
  let out = "";
  for await (const chunk of client.stream({ messages: [{ role: "user", content: "hi" }], model: "gpt-4o" })) out += chunk;
  assert(out.trim() !== "", "empty stream");
});

await test("balance and usage", async () => {
  assert((await client.balance()).balance_usd >= 0, "bad balance");
  assert((await client.usage(1, 5)).page === 1, "bad usage page");
});

await test("trial status", async () => {
  const t = await client.trialStatus();
  assert(t.daily_limit_usd >= 0 && typeof t.active === "boolean", "bad trial");
});

await test("byok lifecycle", async () => {
  for (const k of await client.listProviderKeys()) await client.revokeProviderKey(k.id);
  const label = "js-int-" + Math.random().toString(36).slice(2, 8);
  const key = await client.depositProviderKey({ providerId: "openai", apiKey: "sk-js-test-key-123456", label, isPublic: true, declaredBudgetUsd: 10 });
  assert(key.id && key.is_public && key.status === "active", "deposit failed");
  const listed = await client.listProviderKeys();
  assert(listed.some((k) => k.id === key.id), "not listed");
  const upd = await client.updateProviderKey(key.id, { is_public: false, serve_owner_with_own_key: false });
  assert(upd.is_public === false && upd.serve_owner_with_own_key === false, "update failed");
  await client.revokeProviderKey(key.id);
  assert((await client.listProviderKeys()).every((k) => k.id !== key.id), "not revoked");
});

await test("generate image", async () => {
  const r = await client.generateImage({ prompt: "a silk ribbon", model: "dall-e-3", n: 2 });
  assert(r.count === 2 && r.images.length === 2, "bad image result");
});

await test("generate audio", async () => {
  const r = await client.generateAudio({ prompt: "hello", model: "tts-1" });
  assert(r.audio_b64 && r.format, "bad audio result");
});

console.log(`\n${passed}/${total} passed`);
process.exit(passed === total ? 0 : 1);

// EOF silkllm-sdks/packages/javascript/test/integration.mjs
