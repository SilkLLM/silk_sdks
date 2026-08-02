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

A limit is a ceiling on the shared balance, not a separate wallet. Three keys
limited to $10 do not reserve $30 between them, they each simply stop at $10.
A key with no limit can use the whole balance.

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
from silkllm import InsufficientBalanceError

try:
    client.generate(messages=[{"role": "user", "content": "Hello"}])
except InsufficientBalanceError as e:
    if getattr(e, "code", "") == "key_limit_exceeded":
        ...   # raise the key's limit, or use a different key
    else:
        ...   # the account itself needs topping up
```

Requests are refused before any provider is contacted, so a key at its limit
costs nothing when it is blocked. The pre-flight check uses an estimate, so the
request that crosses the line can finish very slightly over, exactly as the
account balance can.

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
