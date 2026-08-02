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
from silkllm import VoiceSettings

client = silkllm.Client(
    api_key=os.environ.get("SILKLLM_API_KEY", "silk_your_key"),
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

# Audio (text to speech) with OpenAI.
audio = client.generate_audio(prompt="Hello from SilkLLM", model="tts-1", voice="nova")
print(f"Audio ({audio.format}) cost ${audio.cost_usd:.6f}, {len(audio.audio_b64)} base64 bytes")

# Expressive speech with ElevenLabs: choose a speaker and voice settings.
try:
    voices = client.list_voices()  # provider="elevenlabs"
    if voices:
        print(f"ElevenLabs speakers: {[v.name for v in voices[:5]]}")
        el = client.generate_audio(
            prompt="One key, every model. Welcome to SilkLLM.",
            model="eleven_multilingual_v2",
            voice=voices[0].voice_id,
            voice_settings=VoiceSettings(stability=0.5, similarity_boost=0.75, style=0.2, use_speaker_boost=True),
            output_format="mp3_44100_128",
        )
        print(f"ElevenLabs voice={el.voice} ({el.format}) cost ${el.cost_usd:.6f}")
except silkllm.SilkLLMError as e:
    print(f"ElevenLabs not configured yet: {e}")

# EOF silkllm-sdks/packages/python/examples/trial_and_multimodal.py
