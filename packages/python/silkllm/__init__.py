"""
SilkLLM Python SDK
One unified interface to OpenAI, Anthropic, Google, DeepSeek, and xAI.

Quick start:
    import silkllm
    client = silkllm.Client(api_key="silk_...")
    response = client.generate(messages=[{"role": "user", "content": "Hello!"}])
    print(response.content)
"""

# File: silkllm-sdks/packages/python/silkllm/__init__.py

from silkllm.client import Client
from silkllm.types import (
    GenerateResponse, ModelsResponse, BalanceResponse, UsageResponse, Message, ProviderKey, TrialStatus,
    ImageResult, AudioResult, VideoResult, VoiceSettings, Voice,
    ApiKey, KeyUsage, KeyUsageEntry,
    text_part, image_part, audio_part,
)
from silkllm.exceptions import (
    SilkLLMError, AuthenticationError, InsufficientBalanceError,
    ModelNotFoundError, RateLimitError, ProviderError,
)

__version__ = "1.1.0"
__all__ = [
    "Client",
    "GenerateResponse", "ModelsResponse", "BalanceResponse", "UsageResponse", "Message", "ProviderKey", "TrialStatus",
    "ImageResult", "AudioResult", "VideoResult", "VoiceSettings", "Voice",
    "ApiKey", "KeyUsage", "KeyUsageEntry",
    "text_part", "image_part", "audio_part",
    "SilkLLMError", "AuthenticationError", "InsufficientBalanceError",
    "ModelNotFoundError", "RateLimitError", "ProviderError",
]

# EOF silkllm-sdks/packages/python/silkllm/__init__.py
