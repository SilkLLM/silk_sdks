"""
basic_chat.py
Simple example: send a message and print the response.

Usage:
    export SILKLLM_API_KEY=silk_your_key_here
    python basic_chat.py
"""

# File: silkllm-sdks/packages/python/examples/basic_chat.py

import silkllm

# Remove '/api' from base_url – the SDK adds it automatically
client = silkllm.Client(
    api_key="silk_19aa907700678236ce88d1e0fed3b4d04aabeb597658b0df02cafe4c3012ac54",
    base_url="https://silkllm.onrender.com"   # not /api
)

response = client.generate(
    messages=[
        {"role": "system", "content": "You are a helpful assistant. Be concise."},
        {"role": "user", "content": "What are the three laws of thermodynamics?"},
    ],
    model="gpt-4o",
    temperature=0.3,
    max_tokens=512,
)

print("Response:", response.content)
print(f"\nModel:    {response.model} ({response.provider})")
print(f"Tokens:   {response.usage.prompt_tokens} in + {response.usage.completion_tokens} out")
print(f"Cost:     ${response.cost_usd:.6f}")
print(f"Balance:  ${response.balance_after:.4f}")

# EOF silkllm-sdks/packages/python/examples/basic_chat.py
