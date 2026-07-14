/**
 * trial_and_multimodal.js
 * Free-trial status plus image and audio generation.
 *
 * Run:
 *   export SILKLLM_API_KEY=silk_your_key
 *   node trial_and_multimodal.js
 */

// File: silkllm-sdks/packages/javascript/examples/trial_and_multimodal.js

import SilkLLM from "silkllm";

const client = new SilkLLM({
  apiKey: process.env.SILKLLM_API_KEY || "silk_your_key",
  baseUrl: process.env.SILKLLM_BASE_URL || "https://silkllm.onrender.com",
});

// Free-trial status.
const t = await client.trialStatus();
console.log(`Trial active: ${t.active} | today: $${t.daily_remaining_usd.toFixed(4)} of $${t.daily_limit_usd.toFixed(2)} | ${t.days_remaining} days left`);

// Models by modality.
for (const m of (await client.models()).models) {
  console.log(`- ${m.id} [${m.modality}] ${m.is_free ? "free" : "paid"}`);
}

// Image generation.
const img = await client.generateImage({ prompt: "a silk ribbon weaving through gold light", model: "dall-e-3", n: 1 });
console.log(`Image cost $${img.cost_usd.toFixed(4)}:`, img.images);

// Audio (text to speech).
const audio = await client.generateAudio({ prompt: "Hello from SilkLLM", model: "tts-1" });
console.log(`Audio (${audio.format}) cost $${audio.cost_usd.toFixed(6)}, ${audio.audio_b64.length} base64 bytes`);

// EOF silkllm-sdks/packages/javascript/examples/trial_and_multimodal.js
