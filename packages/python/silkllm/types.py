"""
types.py
Pydantic-based response models for the SilkLLM Python SDK.
"""

# File: silkllm-sdks/packages/python/silkllm/types.py

from dataclasses import dataclass, fields, field
from typing import Any, Dict, List, Optional, Union


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


@dataclass
class ApiKey:
    """
    One of your SilkLLM API keys.

    `spend_limit_usd` is a cap on how much of the account balance this key may
    draw. None means uncapped. It is not a separate wallet: three keys capped at
    $10 do not reserve $30, they each simply stop at $10 of spend.
    """
    id: str
    name: str
    created_at: str = ""
    is_active: bool = True
    spent_usd: float = 0.0
    spend_limit_usd: Optional[float] = None
    #: Budget left, or None when the key is uncapped.
    remaining_usd: Optional[float] = None
    #: True once a capped key has used its budget up and is refusing requests.
    is_exhausted: bool = False
    last_used: Optional[str] = None
    limit_reset_at: Optional[str] = None
    #: Notify once the key passes this share of its cap. None for no alert.
    alert_at_percent: Optional[int] = None
    #: Model ids this key may use. None means every model.
    allowed_models: Optional[List[str]] = None
    #: Provider ids this key may use. None means every provider.
    allowed_providers: Optional[List[str]] = None
    #: Requests-per-minute ceiling for this key alone. None means no ceiling.
    rate_limit_per_min: Optional[int] = None
    #: The shared budget this key draws on, if any.
    budget_pool_id: Optional[str] = None
    #: Only present in the response that creates the key. Never retrievable again.
    key: Optional[str] = None

    @classmethod
    def from_api(cls, data: Dict[str, Any]) -> "ApiKey":
        """
        Build a key from any response shape the API produces.

        Two things go wrong without this. The create endpoint answers with a
        narrower object than the list endpoint, so required fields are simply
        absent and the constructor raises. And a newer backend sends fields this
        version has never heard of, which would raise just as loudly. Neither is
        a reason to fail a caller who only wanted the key.
        """
        known = {f.name for f in fields(cls)}
        return cls(**{k: v for k, v in data.items() if k in known})


@dataclass
class KeyUsageEntry:
    """
    One request attributed to an API key.

    Refused attempts appear here too, with `status` set to something other than
    "ok". A run of "limit_exceeded" rows is what a key hitting its cap looks
    like, which is usually what you are after when a deployment stops working.
    """
    id: str
    created_at: str
    endpoint: str
    status: str
    cost_usd: float = 0.0
    prompt_tokens: int = 0
    completion_tokens: int = 0
    requested_model: Optional[str] = None
    served_model: Optional[str] = None
    provider_id: Optional[str] = None
    detail: Optional[str] = None
    latency_ms: Optional[int] = None


@dataclass
class KeyUsage:
    """A page of an API key's history, plus totals over its whole lifetime."""
    key_id: str
    key_name: str
    total: int
    page: int
    page_size: int
    total_cost_usd: float
    total_requests: int
    total_prompt_tokens: int
    total_completion_tokens: int
    entries: List[KeyUsageEntry] = field(default_factory=list)

    def __post_init__(self):
        self.entries = [
            e if isinstance(e, KeyUsageEntry) else KeyUsageEntry(**e) for e in self.entries
        ]


# EOF silkllm-sdks/packages/python/silkllm/types.py
