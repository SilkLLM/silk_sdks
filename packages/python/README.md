# SilkLLM Python SDK

The official Python SDK for [SilkLLM](https://getsilkllm.com) — one API key for OpenAI, Anthropic, Google, DeepSeek, and xAI.

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

# No preference — routes to cheapest healthy model automatically
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
    print("Out of credits — visit dashboard to add more.")

except silkllm.ModelNotFoundError as e:
    print(f"Model not available: {e}")

except silkllm.RateLimitError:
    print("Rate limited — slow down requests.")

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
    temperature=0.7,          # Optional. 0.0–2.0 (default 0.7).
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
