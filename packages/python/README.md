# SilkLLM Python SDK

The official Python SDK for [SilkLLM](https://getsilkllm.com) - one API key for OpenAI, Anthropic, Google, DeepSeek, and xAI.

## Installation

```bash
pip install silkllm
```

Requires Python 3.9+. No other dependencies except `httpx`.

---

## Authentication

Get your API key from the [SilkLLM Dashboard](https://getsilkllm.com/dashboard/keys).

```python
import silkllm

# Pass the key directly
client = silkllm.Client(api_key="silk_your_key_here")

# Or set the environment variable (recommended for production)
# export SILKLLM_API_KEY=silk_your_key_here
client = silkllm.Client()
```

---

## Basic Usage

```python
import silkllm

client = silkllm.Client(api_key="silk_your_key_here")

response = client.generate(
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user",   "content": "What is the capital of France?"},
    ]
)

print(response.content)       # "The capital of France is Paris."
print(response.model)         # "gpt-4o" (or whichever model was used)
print(response.provider)      # "openai"
print(f"${response.cost_usd:.6f}")   # "$0.000150"
print(f"${response.balance_after:.4f}")  # remaining balance
```

---

## Choosing a Model or Provider

```python
# Request a specific model
response = client.generate(
    messages=[{"role": "user", "content": "Explain recursion."}],
    model="claude-3-5-sonnet-20241022",
)

# Request from a specific provider (uses their best available model)
response = client.generate(
    messages=[{"role": "user", "content": "Write a haiku."}],
    provider="anthropic",
)

# No preference - routes to cheapest healthy model automatically
response = client.generate(
    messages=[{"role": "user", "content": "Hi!"}],
)
```

---

## Streaming

```python
import silkllm

client = silkllm.Client(api_key="silk_your_key_here")

print("Assistant: ", end="")
for chunk in client.stream(
    messages=[{"role": "user", "content": "Write a short story about a robot."}],
    model="gpt-4o",
):
    print(chunk, end="", flush=True)
print()  # newline at end
```

---

## Multi-turn Conversations

```python
import silkllm

client = silkllm.Client(api_key="silk_your_key_here")

conversation = [{"role": "system", "content": "You are a helpful coding assistant."}]

while True:
    user_input = input("You: ")
    if user_input.lower() in ("exit", "quit"):
        break

    conversation.append({"role": "user", "content": user_input})

    response = client.generate(messages=conversation, model="gpt-4o")
    print(f"Assistant: {response.content}")

    # Add the assistant reply to history for next turn
    conversation.append({"role": "assistant", "content": response.content})
```

---

## Checking Balance

```python
balance = client.balance()
print(f"Balance: ${balance.balance_usd:.4f} USD")
```

---

## Listing Available Models

```python
# All models
models = client.models()
for m in models.models:
    print(f"{m.id:45} ${m.input_cost_per_1k_usd:.6f}/1K in  ${m.output_cost_per_1k_usd:.6f}/1K out")

# Filter by provider
openai_models = client.models(provider="openai")
```

---

## Usage History

```python
usage = client.usage(page=1, page_size=20)
print(f"Total requests: {usage.total}")
for entry in usage.entries:
    print(f"{entry.created_at}  {entry.entry_type:10}  ${abs(entry.amount):.6f}")
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

```python
# Create a capped key. The secret is on .key and is never shown again.
key = client.create_key("Side project", spend_limit_usd=5.00)
print(key.key)

# Where every key stands
for k in client.list_keys():
    print(k.name, k.spent_usd, "of", k.spend_limit_usd or "uncapped",
          "AT LIMIT" if k.is_exhausted else "")

# Raise a limit (the key resumes at once; its spend so far still counts)
client.update_key(key.id, spend_limit_usd=20.00)

# Remove the limit entirely. This needs its own flag, because passing
# spend_limit_usd=None means "leave it as it is".
client.update_key(key.id, clear_spend_limit=True)

# Start the budget again: clears the counter, refunds nothing, keeps history
client.reset_key_usage(key.id)

client.revoke_key(key.id)
```

### Handling the limit in your code

A spent key answers HTTP 402 with the code `key_limit_exceeded`. That is
distinct from an empty account balance, so you can tell "this key is done" from
"this account is out of money" and react differently.

```python
from silkllm import KeyLimitExceeded, InsufficientBalanceError

try:
    client.generate(messages=[{"role": "user", "content": "Hello"}])
except KeyLimitExceeded as e:
    # The figures are on the exception, so nothing has to parse the message.
    raise_the_limit(e.details["limit"], e.details["spent"])
except InsufficientBalanceError:
    top_up()   # the account itself, not this key
```

Every error carries `.code`, `.status_code` and `.details`.

Requests are refused before any provider is contacted, so a key at its limit
costs nothing when it is blocked. The pre-flight check uses an estimate, so the
request that crosses the line can finish very slightly over, exactly as the
account balance can.

---

---

### Reacting to every error

Each failure raises its own class, carrying the API's `code`, the HTTP
`status_code`, and the figures behind the message in `details`.

```python
from silkllm import (
    KeyLimitExceeded, PoolLimitExceeded, KeyScopeError, KeyRateLimited,
    AllocationExceedsBalance, PromotionError, PromotionRateLimited,
    InsufficientBalanceError, ValidationError,
)

try:
    client.generate(messages=[{"role": "user", "content": "Hello"}])
except KeyLimitExceeded as e:
    raise_limit(e.details["limit"], e.details["spent"])
except PoolLimitExceeded as e:
    notify_team(e.details["pool_name"])
except KeyScopeError as e:
    log(f"this key may not call {e.details['model']}")
except KeyRateLimited as e:
    sleep(e.details["retry_after"])
except InsufficientBalanceError:
    top_up()
```

| Class | Code | Status |
|---|---|---|
| `KeyLimitExceeded` | `key_limit_exceeded` | 402 |
| `PoolLimitExceeded` | `pool_limit_exceeded` | 402 |
| `InsufficientBalanceError` | `insufficient_balance` | 402 |
| `KeyScopeError` | `key_scope_denied` | 403 |
| `KeyRateLimited` | `key_rate_limited` | 429 |
| `AllocationExceedsBalance` | `allocation_exceeds_balance` | 400 |
| `PromotionError` | `promotion_invalid`, `promotion_already_redeemed` | 400 |
| `PromotionRateLimited` | `promotion_rate_limited` | 429 |
| `ValidationError` | `validation_error` | 422 |

`AllocationExceedsBalance` carries `available` and `shortfall`, so a client can
offer the largest limit that would be accepted rather than guessing.
Promotion failures share one class on purpose: an unknown code and one reserved
for another account answer identically, so that distinction is not available to
branch on.

---

## Promotions and promo codes

A promotion discounts **SilkLLM's own fee**, the margin added on top of what a
request costs to serve. It never touches your credit balance and it never
touches the provider's cost, so a discounted request is cheaper but no credit
appears from nowhere. At 100% off you pay exactly what the request cost us.

```python
promo = client.redeem_promo("LAUNCH-ABC123")
print(promo["summary"])
# "All SilkLLM fees waived until 01 Sep 2026. Your credit balance and the
#  provider's cost are unchanged; only our margin is discounted."

client.active_promotion()   # the one currently applying, or None
client.promotions()         # everything ever claimed, live and expired
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
| `spend_limit_usd` | Caps total spend on this key | `402 key_limit_exceeded` |
| `alert_at_percent` | Notifies you at this share of the cap | nothing, it warns |
| `allowed_models` | Restricts the key to named models | `403 key_scope_denied` |
| `allowed_providers` | The same, by provider | `403 key_scope_denied` |
| `rate_limit_per_min` | Caps requests per minute for this key alone | `429 key_rate_limited` |
| `budget_pool_id` | Draws on a shared budget too | `402 pool_limit_exceeded` |

```python
key = client.create_key(
    "CI pipeline",
    spend_limit_usd=5.0,        # stops at $5 of spend
    alert_at_percent=80,        # warn me at $4
    allowed_models=["gpt-4o-mini"],
    rate_limit_per_min=30,      # a runaway loop is slowed, not funded
)

# Taking a control off needs its own flag, for the same reason clearing a spend
# limit does: an omitted field means "leave this as it is".
client.update_key(key.id, clear_rate_limit=True, clear_scope=True)
```

Checks run in this order before any provider is contacted: rate limit, scope,
shared budget, the key's own cap, then the account balance. A key that is out of
budget therefore costs nothing when it is refused, and the error names the first
thing that actually stopped it.

### Shared budgets

One ceiling for a team, an environment or a customer, however many keys are
handed out inside it. A key can still carry its own cap; whichever runs out
first stops that key, and the error says which one it was.

```python
team = client.create_budget("Mobile team", spend_limit_usd=200)

client.create_key("Alice", budget_pool_id=team["id"])
client.create_key("Bob", budget_pool_id=team["id"], spend_limit_usd=50)

for pool in client.list_budgets():
    print(pool["name"], pool["spent_usd"], "of", pool["spend_limit_usd"])

client.reset_budget(team["id"])    # new month, same keys
client.delete_budget(team["id"])   # keys keep working on their own caps
```

Resetting refunds nothing: that money already left the account balance. The
reset clears only the counter the limit is measured against.

### Webhooks

```python
hook = client.create_webhook(
    "https://your-app.example.com/hooks/silkllm",
    events=["key.threshold_reached", "key.limit_reached", "pool.limit_reached"],
)
print(hook["secret"])   # shown once, never again

# Waits for the delivery and reports what your endpoint answered, so you can
# check your signature verification before a real limit is reached.
print(client.test_webhook(hook["id"]))
```

Events: `key.threshold_reached`, `key.limit_reached`, `pool.threshold_reached`,
`pool.limit_reached`, `key.revoked`. Fetch the live list with
`client.webhook_events()`.

Deliveries never block a generation, so a slow endpoint of yours cannot slow
down your own API calls. A hook that fails ten times in a row is switched off
and shown as disabled, rather than costing every request a timeout.

### Verifying a delivery

Every request carries `X-Silk-Signature` as `sha256=<hex>`, an HMAC-SHA256 of
the exact bytes sent, keyed with the secret above.

```python
from silkllm import verify_webhook

@app.post("/hooks/silkllm")
async def receive(request):
    body = await request.body()          # the raw bytes, not a parsed dict
    if not verify_webhook(SECRET, body, request.headers.get("X-Silk-Signature")):
        return Response(status_code=401)
    event = json.loads(body)
    if event["event"] == "key.limit_reached":
        page_the_on_call(event["data"])
```

Sign the raw body. Parsing JSON and dumping it again changes key order and
spacing, and the signature is over the bytes that were actually sent.

### Reacting to each limit

```python
from silkllm import (
    KeyLimitExceeded, PoolLimitExceeded, KeyScopeError,
    KeyRateLimited, InsufficientBalanceError,
)

try:
    client.generate(messages=[{"role": "user", "content": "Hello"}])
except KeyLimitExceeded as e:
    raise_limit(e.details["limit"], e.details["spent"])
except PoolLimitExceeded as e:
    notify_team(e.details["pool_name"])
except KeyScopeError as e:
    log(f"this key may not call {e.details['model']}")
except KeyRateLimited as e:
    sleep(e.details["retry_after"])
except InsufficientBalanceError:
    top_up()          # the account, not the key
```

### Deleting a key for good

Revoking stops a key but keeps its history, because a key that stopped and left
no trace cannot be investigated. When the trace is no longer wanted, delete it:

```python
client.revoke_key(key.id)   # stops working, still listed, history kept
client.delete_key(key.id)   # gone, with its activity log
```

Only a revoked key can be deleted, so one misclick never destroys the audit
trail of a key that is still serving traffic. The account ledger is untouched
either way: that is the record of money that actually moved, and it belongs to
the account rather than the key.

### Exporting a key's history

```python
open("audit.csv", "wb").write(client.export_key_usage(key.id))
open("audit.json", "wb").write(client.export_key_usage(key.id, format="json"))
```

Refused attempts are included, which is the part that matters when a deployment
suddenly stops working.

---

## Per-Key Audit History

Every key keeps its own record: what it called, which model served it, tokens,
cost and latency. Refused attempts are recorded too, which is what makes this
useful when a deployment stops working.

```python
history = client.key_usage(key.id, page_size=25)
print(history.total_requests, "requests,", history.total_cost_usd, "spent")

for e in history.entries:
    print(e.created_at, e.status, e.served_model, e.cost_usd)

# Only the refusals: this is what a key hitting its limit looks like
blocked = client.key_usage(key.id, status="limit_exceeded")
print("blocked", blocked.total, "times")
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

```python
import silkllm

client = silkllm.Client(api_key="silk_your_key_here")

try:
    response = client.generate(
        messages=[{"role": "user", "content": "Hello!"}],
        model="gpt-4o",
    )
    print(response.content)

except silkllm.InsufficientBalanceError:
    print("Out of credits - visit dashboard to add more.")

except silkllm.ModelNotFoundError as e:
    print(f"Model not available: {e}")

except silkllm.RateLimitError:
    print("Rate limited - slow down requests.")

except silkllm.ProviderError as e:
    print(f"All providers failed: {e}")

except silkllm.AuthenticationError:
    print("Invalid API key.")

except silkllm.SilkLLMError as e:
    print(f"Unexpected error: {e}")
```

---

## Context Manager

```python
with silkllm.Client(api_key="silk_...") as client:
    response = client.generate(messages=[{"role": "user", "content": "Hello!"}])
    print(response.content)
# HTTP connection closed automatically
```

---

## All Parameters

```python
response = client.generate(
    messages=[...],           # Required. List of {role, content} dicts.
    model="gpt-4o",           # Optional. Specific model ID.
    provider="openai",        # Optional. Specific provider.
    temperature=0.7,          # Optional. 0.0-2.0 (default 0.7).
    max_tokens=2048,          # Optional. Max output tokens (default 2048).
)
```

---

## Environment Variable Reference

| Variable | Description |
|---|---|
| `SILKLLM_API_KEY` | Your silk_ API key |

---

## Response Fields

| Field | Type | Description |
|---|---|---|
| `content` | str | The generated text |
| `model` | str | Model that handled the request |
| `provider` | str | Provider that handled the request |
| `usage.prompt_tokens` | int | Input tokens used |
| `usage.completion_tokens` | int | Output tokens generated |
| `usage.total_tokens` | int | Total tokens |
| `cost_usd` | float | Cost in USD (provider cost + 10% markup) |
| `balance_after` | float | Your remaining balance after this request |

---

## BYOK Marketplace: bring your own key

Deposit your own provider key. A public key lets SilkLLM serve other users with
it and you earn platform credits when they do (spendable on any model at the
standard markup). A private key serves only you. A public key is never shown to
other users; only the routing algorithm and admins ever see it. The secret is
encrypted at rest and never returned.

```python
import silkllm
client = silkllm.Client(api_key="silk_...")

# Deposit a public key (you earn credits when others use it)
key = client.deposit_provider_key(
    provider_id="openai",
    api_key="sk-your-openai-key",
    label="my openai",
    is_public=True,
    declared_budget_usd=50,        # we never spend past this
)
print(key.id, key.status)

# List your keys with earnings and requests served
for k in client.list_provider_keys():
    print(k.label, k.is_public, "earned:", k.earned_credits_total, "served:", k.requests_served)

# Update: make it private, or opt out of using your own key for your own traffic
client.update_provider_key(key.id, is_public=False, serve_owner_with_own_key=False)

# Revoke (stops being used immediately)
client.revoke_provider_key(key.id)
```

Charging rules: using your own private key costs the owner markup (25%); using
your own public key or anyone else's key or a platform key costs the standard
10%. Free models cost nothing and earn nothing.

---

## Free trial and multimodal

```python
import silkllm
client = silkllm.Client(api_key="silk_...")

# Free-trial status (works even with a zero balance during the trial window)
t = client.trial_status()
print(t.active, t.daily_remaining_usd, "of", t.daily_limit_usd, "left today")

# Image generation
img = client.generate_image(prompt="a silk ribbon over gold light", model="dall-e-3", n=2)
print(img.count, "images", img.images)

# Audio (text to speech), returned as base64
audio = client.generate_audio(prompt="Hello from SilkLLM", model="tts-1", voice="nova")
print(len(audio.audio_b64), "bytes of", audio.format)

# Expressive speech with ElevenLabs: pick a speaker and voice settings
from silkllm import VoiceSettings
voices = client.list_voices()  # provider="elevenlabs"
audio = client.generate_audio(
    prompt="One key, every model.",
    model="eleven_multilingual_v2",
    voice=voices[0].voice_id,
    voice_settings=VoiceSettings(stability=0.5, similarity_boost=0.75, style=0.2, use_speaker_boost=True),
    output_format="mp3_44100_128",
)

# Video (where a provider supports it)
# video = client.generate_video(prompt="a flowing silk thread", seconds=5)
```

For ElevenLabs voices the platform uses your account's ElevenLabs API key (added by an
admin under Providers). `voice` is a voice_id from `list_voices()`; OpenAI TTS uses the
fixed names alloy, echo, fable, onyx, nova, and shimmer.

Clone a voice from your own samples, then use it for TTS or to convert a clip
(speech-to-speech):

```python
clone = client.clone_voice(name="My voice", samples=["sample1.mp3", "sample2.mp3"])

converted = client.speech_to_speech(
    audio="recording.mp3",       # file path or bytes
    voice=clone["voice_id"],
    seconds=12,                  # approx source duration, for pricing
)
print(converted.format, len(converted.audio_b64))
```

List models with their modality so you can pick the right one:

```python
for m in client.models().models:
    print(m.id, m.modality, "free" if m.is_free else "paid")
```
