"""
streaming.py
Streaming example - prints tokens as they arrive from the provider.

Usage:
    export SILKLLM_API_KEY=silk_your_key_here
    python streaming.py
"""

# File: silkllm-sdks/packages/python/examples/streaming.py

import silkllm

# For local development, point to your backend and provide your API key.
# In production, you can omit base_url (defaults to https://api.silkllm.com)
# and set SILKLLM_API_KEY environment variable.
client = silkllm.Client(
    api_key="silk_19aa907700678236ce88d1e0fed3b4d04aabeb597658b0df02cafe4c3012ac54",      # replace with your actual key
    base_url="https://silkllm.onrender.com"   # local backend
)

print("Assistant: ", end="", flush=True)

for chunk in client.stream(
    messages=[{"role": "user", "content": "Write a short poem about the ocean."}],
    model="claude-3-5-sonnet-20241022",
    temperature=0.9,
):
    print(chunk, end="", flush=True)

print("\n\nDone streaming.")

# EOF

# EOF silkllm-sdks/packages/python/examples/streaming.py
