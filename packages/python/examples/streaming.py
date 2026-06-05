"""
streaming.py
Streaming example — prints tokens as they arrive from the provider.

Usage:
    export SILKLLM_API_KEY=silk_your_key_here
    python streaming.py
"""

# File: silkllm-sdks/packages/python/examples/streaming.py

import silkllm

client = silkllm.Client()

print("Assistant: ", end="", flush=True)

for chunk in client.stream(
    messages=[{"role": "user", "content": "Write a short poem about the ocean."}],
    model="claude-3-5-sonnet-20241022",
    temperature=0.9,
):
    print(chunk, end="", flush=True)

print("\n\nDone streaming.")

# EOF silkllm-sdks/packages/python/examples/streaming.py
