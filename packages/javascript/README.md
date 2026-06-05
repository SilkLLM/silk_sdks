# SilkLLM JavaScript SDK

The official JavaScript/TypeScript SDK for SilkLLM — one API key for OpenAI, Anthropic, Google, DeepSeek, and xAI.

## Installation

```bash
npm install silkllm
# or
yarn add silkllm
# or
pnpm add silkllm
```

Works in Node.js 18+ and modern browsers.

---

## Quick Start

```javascript
import SilkLLM from "silkllm";

const client = new SilkLLM({ apiKey: "silk_your_key_here" });

const response = await client.generate({
  messages: [{ role: "user", content: "What is 2 + 2?" }],
});

console.log(response.content);      // "4"
console.log(response.model);        // "gpt-4o"
console.log(response.cost_usd);     // 0.000082
console.log(response.balance_after);// 49.9999
```

---

## TypeScript Support

Full TypeScript types are included:

```typescript
import SilkLLM, { GenerateResponse, Message } from "silkllm";

const client = new SilkLLM({ apiKey: process.env.SILKLLM_API_KEY });

const messages: Message[] = [
  { role: "system", content: "You are a helpful assistant." },
  { role: "user",   content: "Tell me a joke." },
];

const response: GenerateResponse = await client.generate({ messages });
console.log(response.content);
```

---

## Streaming

```javascript
import SilkLLM from "silkllm";

const client = new SilkLLM({ apiKey: "silk_your_key_here" });

process.stdout.write("Assistant: ");
for await (const chunk of client.stream({
  messages: [{ role: "user", content: "Write a poem about the ocean." }],
  model: "claude-3-5-sonnet-20241022",
})) {
  process.stdout.write(chunk);
}
console.log();
```

---

## Choosing Model / Provider

```javascript
// Specific model
await client.generate({
  messages: [...],
  model: "gemini-1.5-pro",
});

// Specific provider
await client.generate({
  messages: [...],
  provider: "anthropic",
});

// Auto-route to cheapest
await client.generate({ messages: [...] });
```

---

## Error Handling

```javascript
import SilkLLM, {
  InsufficientBalanceError,
  ModelNotFoundError,
  RateLimitError,
  ProviderError,
  AuthenticationError,
  SilkLLMError,
} from "silkllm";

try {
  const response = await client.generate({ messages: [...] });
  console.log(response.content);
} catch (err) {
  if (err instanceof InsufficientBalanceError) {
    console.log("Add credits at silkllm.com/dashboard/billing");
  } else if (err instanceof RateLimitError) {
    console.log("Slow down — rate limit hit");
  } else if (err instanceof ProviderError) {
    console.log("All providers failed:", err.message);
  } else if (err instanceof SilkLLMError) {
    console.log("API error:", err.message, err.code);
  }
}
```

---

## All Options

```javascript
const response = await client.generate({
  messages: [...],        // Required. Array of {role, content}
  model: "gpt-4o",        // Optional. Model ID
  provider: "openai",     // Optional. Provider name
  temperature: 0.7,       // Optional. 0.0–2.0
  max_tokens: 2048,       // Optional. Max output tokens
});
```

---

## Other Methods

```javascript
// Check balance
const { balance_usd } = await client.balance();

// List models
const { models } = await client.models();
models.forEach(m => console.log(m.id, m.input_cost_per_1k_usd));

// Usage history
const { entries, total } = await client.usage(1, 20);
```
