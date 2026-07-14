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
audio = client.generate_audio(prompt="Hello from SilkLLM", model="tts-1")
print(len(audio.audio_b64), "bytes of", audio.format)

# Video (where a provider supports it)
# video = client.generate_video(prompt="a flowing silk thread", seconds=5)
```

List models with their modality so you can pick the right one:

```python
for m in client.models().models:
    print(m.id, m.modality, "free" if m.is_free else "paid")
```
