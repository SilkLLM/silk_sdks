/**
 * streaming.js
 * Node.js streaming example — prints each chunk as it arrives.
 *
 * Usage:
 *   SILKLLM_API_KEY=silk_your_key node streaming.js
 */

// File: silkllm-sdks/packages/javascript/examples/streaming.js

import SilkLLM from "silkllm";

const client = new SilkLLM({ apiKey: process.env.SILKLLM_API_KEY });

process.stdout.write("Assistant: ");

for await (const chunk of client.stream({
  messages: [{ role: "user", content: "Count from 1 to 10, one number per line." }],
  model: "gemini-1.5-flash",
})) {
  process.stdout.write(chunk);
}

console.log("\n\nStream complete.");

// EOF silkllm-sdks/packages/javascript/examples/streaming.js
