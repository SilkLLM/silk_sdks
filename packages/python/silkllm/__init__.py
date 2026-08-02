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
from silkllm.webhooks import parse_event, sign, verify_webhook
from silkllm.types import (
    GenerateResponse, ModelsResponse, BalanceResponse, UsageResponse, Message, ProviderKey, TrialStatus,
    ImageResult, AudioResult, VideoResult, VoiceSettings, Voice,
    ApiKey, KeyUsage, KeyUsageEntry,
    text_part, image_part, audio_part,
)
from silkllm.exceptions import (
    KeyLimitExceeded, PoolLimitExceeded, KeyScopeError, KeyRateLimited,
    PromotionError, PromotionRateLimited, AllocationExceedsBalance, ValidationError,
    SilkLLMError, AuthenticationError, InsufficientBalanceError,
    ModelNotFoundError, RateLimitError, ProviderError,
)

__version__ = "1.1.0"
__all__ = [
    "verify_webhook", "sign", "parse_event",
    "Client",
    "GenerateResponse", "ModelsResponse", "BalanceResponse", "UsageResponse", "Message", "ProviderKey", "TrialStatus",
    "ImageResult", "AudioResult", "VideoResult", "VoiceSettings", "Voice",
    "ApiKey", "KeyUsage", "KeyUsageEntry",
    "text_part", "image_part", "audio_part",
    "SilkLLMError", "AuthenticationError", "InsufficientBalanceError",
    "KeyLimitExceeded", "PoolLimitExceeded", "KeyScopeError", "KeyRateLimited",
    "PromotionError", "PromotionRateLimited", "AllocationExceedsBalance", "ValidationError",
    "ModelNotFoundError", "RateLimitError", "ProviderError",
]

# EOF silkllm-sdks/packages/python/silkllm/__init__.py
