"""
trial_and_multimodal.py
Free-trial status plus image and audio generation.

Run:
    export SILKLLM_API_KEY=silk_your_key
    python trial_and_multimodal.py
"""

# File: silkllm-sdks/packages/python/examples/trial_and_multimodal.py

import os
import silkllm

client = silkllm.Client(
    api_key=os.environ.get("SILKLLM_API_KEY", "silk_your_key"),
    base_url=os.environ.get("SILKLLM_BASE_URL", "https://silkllm.onrender.com"),
)

# Free-trial status.
t = client.trial_status()
print(f"Trial active: {t.active} | today: ${t.daily_remaining_usd:.4f} of ${t.daily_limit_usd:.2f} | {t.days_remaining} days left")

# Pick the right model per modality.
for m in client.models().models:
    print(f"- {m.id} [{m.modality}] {'free' if m.is_free else 'paid'}")

# Image generation.
img = client.generate_image(prompt="a silk ribbon weaving through gold light", model="dall-e-3", n=1)
print(f"Image cost ${img.cost_usd:.4f}: {img.images}")

# Audio (text to speech).
audio = client.generate_audio(prompt="Hello from SilkLLM", model="tts-1")
print(f"Audio ({audio.format}) cost ${audio.cost_usd:.6f}, {len(audio.audio_b64)} base64 bytes")

# EOF silkllm-sdks/packages/python/examples/trial_and_multimodal.py
