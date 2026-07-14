"""
types.py
Pydantic-based response models for the SilkLLM Python SDK.
"""

# File: silkllm-sdks/packages/python/silkllm/types.py

from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any


@dataclass
class UsageInfo:
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


@dataclass
class GenerateResponse:
    """Response from client.generate()"""
    content: str
    model: str
    provider: str
    usage: UsageInfo
    cost_usd: float
    balance_after: float

    def __post_init__(self):
        if isinstance(self.usage, dict):
            self.usage = UsageInfo(**self.usage)


@dataclass
class ModelInfo:
    id: str
    display_name: str
    provider: str
    input_cost_per_1k_usd: float
    output_cost_per_1k_usd: float
    context_window: int
    capabilities: List[str]
    fallback_models: List[str]
    modality: str = "text"          # text | image | audio | video
    is_free: bool = False           # free to call (served at $0)


@dataclass
class ModelsResponse:
    """Response from client.models()"""
    models: List[ModelInfo]
    total: int

    def __post_init__(self):
        self.models = [ModelInfo(**m) if isinstance(m, dict) else m for m in self.models]


@dataclass
class BalanceResponse:
    """Response from client.balance()"""
    balance_usd: float
    currency: str = "USD"


@dataclass
class UsageEntry:
    id: str
    entry_type: str
    amount: float
    balance_after: float
    created_at: str
    model: Optional[str] = None
    provider: Optional[str] = None
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None


@dataclass
class UsageResponse:
    """Response from client.usage()"""
    entries: List[UsageEntry]
    total: int
    page: int
    page_size: int

    def __post_init__(self):
        self.entries = [UsageEntry(**e) if isinstance(e, dict) else e for e in self.entries]


@dataclass
class Message:
    role: str   # "user" | "assistant" | "system"
    # Plain text, or a list of multimodal parts (see text_part/image_part/audio_part).
    content: Union[str, List[Dict[str, Any]]]

    def to_dict(self) -> Dict[str, Any]:
        return {"role": self.role, "content": self.content}


# ── Multimodal input helpers ─────────────────────────────────────────────────
# Build the typed content parts that models accept for vision and audio input.

def text_part(text: str) -> Dict[str, Any]:
    """A text part for a multimodal message."""
    return {"type": "text", "text": text}


def image_part(url: str) -> Dict[str, Any]:
    """An image part. `url` may be an http(s) URL or a data: URI (base64)."""
    return {"type": "image_url", "image_url": {"url": url}}


def audio_part(data: str, fmt: str = "wav") -> Dict[str, Any]:
    """An audio input part. `data` is base64 audio; `fmt` is e.g. 'wav' or 'mp3'."""
    return {"type": "input_audio", "input_audio": {"data": data, "format": fmt}}


@dataclass
class ImageResult:
    """Response from client.generate_image()."""
    images: List[Optional[str]]
    count: int
    model: str
    provider: str
    cost_usd: float
    balance_after: float
    modality: str = "image"


@dataclass
class VoiceSettings:
    """
    ElevenLabs voice controls. Ignored by providers that do not support them
    (for example OpenAI TTS). All fields are optional; pass only what you want
    to override.
    """
    stability: Optional[float] = None
    similarity_boost: Optional[float] = None
    style: Optional[float] = None
    use_speaker_boost: Optional[bool] = None
    speed: Optional[float] = None

    def to_dict(self) -> Dict[str, object]:
        return {k: v for k, v in self.__dict__.items() if v is not None}


@dataclass
class Voice:
    """A speaker available from a voice provider (client.list_voices())."""
    voice_id: str
    name: Optional[str] = None
    category: Optional[str] = None
    labels: Optional[Dict[str, object]] = None
    preview_url: Optional[str] = None


@dataclass
class AudioResult:
    """Response from client.generate_audio() (base64 audio)."""
    audio_b64: str
    format: str
    model: str
    provider: str
    cost_usd: float
    balance_after: float
    modality: str = "audio"
    voice: Optional[str] = None


@dataclass
class VideoResult:
    """Response from client.generate_video()."""
    video_url: Optional[str]
    model: str
    provider: str
    cost_usd: float
    balance_after: float
    modality: str = "video"


@dataclass
class TrialStatus:
    """Response from client.trial_status()."""
    active: bool
    tier: str
    daily_limit_usd: float
    daily_used_usd: float
    daily_remaining_usd: float
    days_remaining: int
    lifetime_used_usd: float
    expires_at: Optional[str] = None


@dataclass
class ProviderKey:
    """A deposited provider key (BYOK marketplace). The secret is never returned."""
    id: str
    provider_id: str
    label: str
    is_public: bool
    is_free_key: bool
    serve_owner_with_own_key: bool
    daily_limit_usd: float
    declared_budget_usd: float
    consumed_usd_total: float
    status: str
    success_count: int
    failure_count: int
    created_at: str
    last_used: Optional[str] = None
    earned_credits_total: float = 0.0
    requests_served: int = 0
    provider_cost_served: float = 0.0

# EOF silkllm-sdks/packages/python/silkllm/types.py
