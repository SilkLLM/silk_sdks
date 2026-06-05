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
    content: str

    def to_dict(self) -> Dict[str, str]:
        return {"role": self.role, "content": self.content}

# EOF silkllm-sdks/packages/python/silkllm/types.py
