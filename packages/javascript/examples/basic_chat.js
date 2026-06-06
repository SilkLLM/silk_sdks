/**
 * basic_chat.js
 * Simple Node.js example using the SilkLLM JavaScript SDK.
 *
 * Usage:
 *   SILKLLM_API_KEY=silk_your_key SILKLLM_BASE_URL=http://localhost:8000 node basic_chat.js
 */

// File: silkllm-sdks/packages/javascript/examples/basic_chat.js

import { SilkLLM } from "silkllm";

const client = new SilkLLM({
  apiKey: process.env.SILKLLM_API_KEY,
  baseUrl: process.env.SILKLLM_BASE_URL,   // local backend: "http://localhost:8000"
});

const response = await client.generate({
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user",   content: "Explain what an API is in one paragraph." },
  ],
  model: "gpt-4o-mini",
  temperature: 0.5,
  max_tokens: 256,
});

console.log("Response:", response.content);
console.log(`\nModel: ${response.model} (${response.provider})`);
console.log(`Tokens: ${response.usage.prompt_tokens} in + ${response.usage.completion_tokens} out`);
console.log(`Cost: $${response.cost_usd.toFixed(6)}`);
console.log(`Balance: $${response.balance_after.toFixed(4)}`);

// EOF silkllm-sdks/packages/javascript/examples/basic_chat.js
