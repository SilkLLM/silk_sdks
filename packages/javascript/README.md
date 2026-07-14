# SilkLLM JavaScript SDK

The official JavaScript/TypeScript SDK for SilkLLM - one API key for OpenAI, Anthropic, Google, DeepSeek, and xAI.

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
    console.log("Slow down - rate limit hit");
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
  temperature: 0.7,       // Optional. 0.0-2.0
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

---

## BYOK Marketplace: bring your own key

Deposit your own provider key. A public key lets SilkLLM serve other users with
it and you earn platform credits when they do (spendable on any model at the
standard markup). A private key serves only you. A public key is never shown to
other users; only the routing algorithm and admins ever see it. The secret is
encrypted at rest and never returned.

```javascript
import SilkLLM from "silkllm";
const client = new SilkLLM({ apiKey: "silk_..." });

// Deposit a public key (you earn credits when others use it)
const key = await client.depositProviderKey({
  providerId: "openai",
  apiKey: "sk-your-openai-key",
  label: "my openai",
  isPublic: true,
  declaredBudgetUsd: 50,        // we never spend past this
});

// List your keys with earnings and requests served
for (const k of await client.listProviderKeys()) {
  console.log(k.label, k.is_public, "earned:", k.earned_credits_total, "served:", k.requests_served);
}

// Update: make it private, or opt out of using your own key for your own traffic
await client.updateProviderKey(key.id, { is_public: false, serve_owner_with_own_key: false });

// Revoke (stops being used immediately)
await client.revokeProviderKey(key.id);
```

Charging rules: using your own private key costs the owner markup (25%); using
your own public key or anyone else's key or a platform key costs the standard
10%. Free models cost nothing and earn nothing.

---

## Free trial and multimodal

```javascript
import SilkLLM from "silkllm";
const client = new SilkLLM({ apiKey: "silk_..." });

// Free-trial status
const t = await client.trialStatus();
console.log(t.active, t.daily_remaining_usd, "of", t.daily_limit_usd, "left today");

// Image generation
const img = await client.generateImage({ prompt: "a silk ribbon", model: "dall-e-3", n: 2 });
console.log(img.count, img.images);

// Audio (text to speech), base64
const audio = await client.generateAudio({ prompt: "Hello", model: "tts-1" });
console.log(audio.audio_b64.length, "bytes of", audio.format);

// List models with modality
for (const m of (await client.models()).models) {
  console.log(m.id, m.modality, m.is_free ? "free" : "paid");
}
```
