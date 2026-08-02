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

---

## API Key Spend Limits

Every key can carry a limit on how much of your balance it may spend. Once a key
reaches its limit it stops working; every other key on the account carries on.
This is how you hand a key to a side project, a contractor or a CI pipeline
without putting the whole balance at risk.

A limit allocates part of the one account balance to one key. The allocations
compete: their unspent parts cannot add up to more than the balance, so you can
never promise a key credit the account does not hold. Three keys limited to $10
need $30 of balance between them.

The money is not moved or escrowed. Each key simply stops at its own figure, and
the balance is enforced independently underneath, so nothing can overdraw the
account whatever the limits say. `client.allocation()` reports what is left to
allocate.

```js
// Create a capped key. The secret is on .key and is never shown again.
const key = await client.createKey({ name: "Side project", spendLimitUsd: 5.0 });
console.log(key.key);

// Where every key stands
for (const k of await client.listKeys()) {
  console.log(k.name, k.spent_usd, "of", k.spend_limit_usd ?? "uncapped",
              k.is_exhausted ? "AT LIMIT" : "");
}

// Raise a limit (the key resumes at once; its spend so far still counts)
await client.updateKey(key.id, { spendLimitUsd: 20.0 });

// Remove the limit entirely. This needs its own flag, because omitting
// spendLimitUsd means "leave it as it is".
await client.updateKey(key.id, { clearSpendLimit: true });

// Start the budget again: clears the counter, refunds nothing, keeps history
await client.resetKeyUsage(key.id);

await client.revokeKey(key.id);
```

### Handling the limit in your code

A spent key answers HTTP 402 with the code `key_limit_exceeded`. That is
distinct from an empty account balance, so you can tell "this key is done" from
"this account is out of money" and react differently.

```js
import { KeyLimitExceeded, InsufficientBalanceError } from "silkllm";

try {
  await client.generate({ messages: [{ role: "user", content: "Hello" }] });
} catch (err) {
  // The figures are on the error, so nothing has to parse the message.
  if (err instanceof KeyLimitExceeded) raiseLimit(err.details.limit, err.details.spent);
  else if (err instanceof InsufficientBalanceError) await topUp();  // the account, not the key
  else throw err;
}
```

Every error carries `.code`, `.statusCode` and `.details`.

Requests are refused before any provider is contacted, so a key at its limit
costs nothing when it is blocked. The pre-flight check uses an estimate, so the
request that crosses the line can finish very slightly over, exactly as the
account balance can.

---

## Promotions and promo codes

A promotion discounts **SilkLLM's own fee**, the margin added on top of what a
request costs to serve. It never touches your credit balance and it never
touches the provider's cost, so a discounted request is cheaper but no credit
appears from nowhere. At 100% off you pay exactly what the request cost us.

```js
const promo = await client.redeemPromo("LAUNCH-ABC123");
console.log(promo.summary);
// "All SilkLLM fees waived until 01 Sep 2026. Your credit balance and the
//  provider's cost are unchanged; only our margin is discounted."

await client.activePromotion();  // the one currently applying, or null
await client.promotions();       // everything ever claimed, live and expired
```

A code can be redeemed once per account. Discounts do not stack: if you hold
more than one, the most generous applies. Some codes are reserved for named
accounts, some run out after a set number of redemptions, and some expire on a
date or a set number of days after you claim them, whichever comes first. The
`summary` on the response spells out which of those you got.

---

## Key controls

A spend limit answers "how much". These answer the rest: what a key may call,
how fast, whose budget it shares, and how you hear about it before a customer
does. Every control is optional, and a key created without them behaves exactly
as keys always have.

| Control | What it does | Refused with |
|---|---|---|
| `spendLimitUsd` | Caps total spend on this key | `402 key_limit_exceeded` |
| `alertAtPercent` | Notifies you at this share of the cap | nothing, it warns |
| `allowedModels` | Restricts the key to named models | `403 key_scope_denied` |
| `allowedProviders` | The same, by provider | `403 key_scope_denied` |
| `rateLimitPerMin` | Caps requests per minute for this key alone | `429 key_rate_limited` |
| `budgetPoolId` | Draws on a shared budget too | `402 pool_limit_exceeded` |

```js
const key = await client.createKey({
  name: "CI pipeline",
  spendLimitUsd: 5.0,        // stops at $5 of spend
  alertAtPercent: 80,        // warn me at $4
  allowedModels: ["gpt-4o-mini"],
  rateLimitPerMin: 30,       // a runaway loop is slowed, not funded
});

// Taking a control off needs its own flag, for the same reason clearing a spend
// limit does: an omitted field means "leave this as it is".
await client.updateKey(key.id, { clearRateLimit: true, clearScope: true });
```

Checks run in this order before any provider is contacted: rate limit, scope,
shared budget, the key's own cap, then the account balance. A key that is out of
budget therefore costs nothing when it is refused, and the error names the first
thing that actually stopped it.

### Shared budgets

One ceiling for a team, an environment or a customer, however many keys are
handed out inside it. A key can still carry its own cap; whichever runs out
first stops that key, and the error says which one it was.

```js
const team = await client.createBudget("Mobile team", 200);

await client.createKey({ name: "Alice", budgetPoolId: team.id });
await client.createKey({ name: "Bob", budgetPoolId: team.id, spendLimitUsd: 50 });

for (const pool of await client.listBudgets()) {
  console.log(pool.name, pool.spent_usd, "of", pool.spend_limit_usd);
}

await client.resetBudget(team.id);    // new month, same keys
await client.deleteBudget(team.id);   // keys keep working on their own caps
```

Resetting refunds nothing: that money already left the account balance. The
reset clears only the counter the limit is measured against.

### Webhooks

```js
const hook = await client.createWebhook(
  "https://your-app.example.com/hooks/silkllm",
  ["key.threshold_reached", "key.limit_reached", "pool.limit_reached"],
);
console.log(hook.secret);   // shown once, never again

// Waits for the delivery and reports what your endpoint answered, so you can
// check your signature verification before a real limit is reached.
console.log(await client.testWebhook(hook.id));
```

Events: `key.threshold_reached`, `key.limit_reached`, `pool.threshold_reached`,
`pool.limit_reached`, `key.revoked`. Fetch the live list with
`client.webhookEvents()`.

Deliveries never block a generation, so a slow endpoint of yours cannot slow
down your own API calls. A hook that fails ten times in a row is switched off
and shown as disabled, rather than costing every request a timeout.

### Verifying a delivery

Every request carries `X-Silk-Signature` as `sha256=<hex>`, an HMAC-SHA256 of
the exact bytes sent, keyed with the secret above.

```js
import { verifyWebhook } from "silkllm";

app.post("/hooks/silkllm", express.raw({ type: "*/*" }), async (req, res) => {
  // The raw body. Re-serialising a parsed object changes key order and spacing,
  // and the signature is over the exact bytes that were sent.
  const ok = await verifyWebhook(SECRET, req.body, req.header("X-Silk-Signature"));
  if (!ok) return res.sendStatus(401);

  const event = JSON.parse(req.body.toString());
  if (event.event === "key.limit_reached") pageTheOnCall(event.data);
  res.sendStatus(200);
});
```

The comparison runs in constant time, so a rejection does not leak how much of a
forged signature was correct.

### Reacting to each limit

```js
import {
  KeyLimitExceeded, PoolLimitExceeded, KeyScopeError,
  KeyRateLimited, InsufficientBalanceError,
} from "silkllm";

try {
  await client.generate({ messages: [{ role: "user", content: "Hello" }] });
} catch (e) {
  if (e instanceof KeyLimitExceeded) raiseLimit(e.details.limit, e.details.spent);
  else if (e instanceof PoolLimitExceeded) notifyTeam(e.details.pool_name);
  else if (e instanceof KeyScopeError) log(`this key may not call ${e.details.model}`);
  else if (e instanceof KeyRateLimited) await sleep(e.details.retry_after * 1000);
  else if (e instanceof InsufficientBalanceError) await topUp();  // the account, not the key
  else throw e;
}
```

### Deleting a key for good

Revoking stops a key but keeps its history, because a key that stopped and left
no trace cannot be investigated. When the trace is no longer wanted, delete it:

```js
await client.revokeKey(key.id);   // stops working, still listed, history kept
await client.deleteKey(key.id);   // gone, with its activity log
```

Only a revoked key can be deleted, so one misclick never destroys the audit
trail of a key that is still serving traffic. The account ledger is untouched
either way: that is the record of money that actually moved, and it belongs to
the account rather than the key.

### Exporting a key's history

```js
await fs.writeFile("audit.csv", await client.exportKeyUsage(key.id));
await fs.writeFile("audit.json", await client.exportKeyUsage(key.id, "json"));
```

Refused attempts are included, which is the part that matters when a deployment
suddenly stops working.

---

## Per-Key Audit History

Every key keeps its own record: what it called, which model served it, tokens,
cost and latency. Refused attempts are recorded too, which is what makes this
useful when a deployment stops working.

```js
const history = await client.keyUsage(key.id, { pageSize: 25 });
console.log(history.total_requests, "requests,", history.total_cost_usd, "spent");

for (const e of history.entries) {
  console.log(e.created_at, e.status, e.served_model, e.cost_usd);
}

// Only the refusals: this is what a key hitting its limit looks like
const blocked = await client.keyUsage(key.id, { status: "limit_exceeded" });
console.log("blocked", blocked.total, "times");
```

| `status` | Meaning |
|---|---|
| `ok` | Served and charged |
| `limit_exceeded` | Refused: the key reached its spend limit |
| `insufficient_balance` | Refused: the account has no credit |
| `provider_error` | The provider failed after the key was accepted |

Totals cover the key's whole history and survive a counter reset; the `status`
filter narrows the page only, so filtering never changes what the key appears to
have spent.

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
const audio = await client.generateAudio({ prompt: "Hello", model: "tts-1", voice: "nova" });
console.log(audio.audio_b64.length, "bytes of", audio.format);

// Expressive speech with ElevenLabs: pick a speaker and voice settings
const { voices } = await client.listVoices(); // "elevenlabs"
const speech = await client.generateAudio({
  prompt: "One key, every model.",
  model: "eleven_multilingual_v2",
  voice: voices[0].voice_id,
  voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.2, use_speaker_boost: true },
  output_format: "mp3_44100_128",
});

// Clone a voice, then convert a clip into it (speech-to-speech)
import { readFileSync } from "node:fs";
const clone = await client.cloneVoice({ name: "My voice", samples: [readFileSync("sample1.mp3")] });
const converted = await client.speechToSpeech({
  audio: readFileSync("recording.mp3"),
  voice: clone.voice_id,
  seconds: 12,
});

// List models with modality
for (const m of (await client.models()).models) {
  console.log(m.id, m.modality, m.is_free ? "free" : "paid");
}
```
