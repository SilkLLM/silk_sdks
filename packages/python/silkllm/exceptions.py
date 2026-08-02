"""
exceptions.py
SilkLLM Python SDK exception hierarchy.

Every error carries the API's own `code` and the HTTP `status_code`. The code is
the part worth branching on: several distinct situations share a status, and
telling them apart is the difference between "raise this key's limit" and "top
up the account".

    try:
        client.generate(messages=[...])
    except KeyLimitExceeded as e:
        raise_the_limit(e.limit, e.spent)
    except InsufficientBalanceError:
        top_up()
"""

# File: silkllm-sdks/packages/python/silkllm/exceptions.py

from typing import Any, Dict, Optional


class SilkLLMError(Exception):
    """
    Base exception for all SilkLLM SDK errors.

    Args:
        message: Human-readable description, as sent by the API.
        code: The API's machine-readable error code, e.g. "key_limit_exceeded".
        status_code: The HTTP status the request answered with.
        details: Anything else the error body carried.
    """

    def __init__(
        self,
        message: str,
        code: str = "unknown",
        status_code: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or {}


class AuthenticationError(SilkLLMError):
    """Raised when the API key is invalid or missing."""


class InsufficientBalanceError(SilkLLMError):
    """Raised when the account's credit balance is too low to serve the request."""


class ModelNotFoundError(SilkLLMError):
    """Raised when the requested model does not exist or is disabled."""


class RateLimitError(SilkLLMError):
    """Raised when a rate limit is exceeded."""


class ProviderError(SilkLLMError):
    """Raised when the underlying provider fails, after fallback attempts."""


class KeyLimitExceeded(SilkLLMError):
    """
    Raised when the API key making the request has reached its own spend limit.

    Distinct from InsufficientBalanceError: the account still has credit, this
    particular key does not. Raise the limit or reset the key's counter.
    """

    def __init__(self, message: str, **kw):
        super().__init__(message, **kw)
        self.limit = self.details.get("limit")
        self.spent = self.details.get("spent")


class PoolLimitExceeded(SilkLLMError):
    """
    Raised when the shared budget the key belongs to has been used up.

    The key itself may have plenty of room left. Raise the shared budget or
    reset it; changing this one key will not help.
    """

    def __init__(self, message: str, **kw):
        super().__init__(message, **kw)
        self.pool_name = self.details.get("pool_name")


class KeyScopeError(SilkLLMError):
    """
    Raised when a key is not permitted to use the model or provider requested.

    The key carries an allowlist. Either call something on it, or widen the list.
    """


class PromotionError(SilkLLMError):
    """
    A promo code that could not be redeemed.

    One class rather than a family, mirroring the API. Codes are secrets worth
    money, so an unknown code and a code reserved for somebody else answer
    identically; branching on the difference is not possible by design, and a
    client that tried would be reading a distinction that is not there.

    `code` is "promotion_invalid" for anything unusable, and
    "promotion_already_redeemed" when this account has had it before, which is
    the one case worth telling a customer apart from the rest.
    """


class PromotionRateLimited(SilkLLMError):
    """
    Too many code attempts from this account.

    Clears on its own. `details["retry_after"]` is the wait in seconds.
    """

    def __init__(self, message: str, **kw):
        super().__init__(message, **kw)
        self.retry_after = self.details.get("retry_after")


class AllocationExceedsBalance(SilkLLMError):
    """
    Raised when a spend limit would promise more credit than the account holds.

    Spend limits are allocations that compete for one balance, so this is not
    "you are out of money": it is "you have already promised that money to
    another key or budget". `details` carries balance, allocated, available and
    the shortfall, so an application can offer the maximum that would be
    accepted instead of guessing.
    """

    def __init__(self, message: str, **kw):
        super().__init__(message, **kw)
        self.available = self.details.get("available")
        self.balance = self.details.get("balance")
        self.shortfall = self.details.get("shortfall")


class ValidationError(SilkLLMError):
    """The request body was rejected. `message` names the offending field."""


class KeyRateLimited(SilkLLMError):
    """
    Raised when a key exceeded its own requests-per-minute ceiling.

    Unlike the other limits this one clears by itself: wait for the next minute,
    or slow the caller down.
    """


#: Error codes the API sends, mapped to the exception they raise. Consulted
#: before the status code, because several codes share one status.
ERROR_CODES = {
    "key_limit_exceeded": KeyLimitExceeded,
    "promotion_invalid": PromotionError,
    "promotion_already_redeemed": PromotionError,
    "promotion_rate_limited": PromotionRateLimited,
    "allocation_exceeds_balance": AllocationExceedsBalance,
    "validation_error": ValidationError,
    "pool_limit_exceeded": PoolLimitExceeded,
    "key_scope_denied": KeyScopeError,
    "key_rate_limited": KeyRateLimited,
    "insufficient_balance": InsufficientBalanceError,
}

__all__ = [
    "SilkLLMError", "AuthenticationError", "InsufficientBalanceError",
    "ModelNotFoundError", "RateLimitError", "ProviderError",
    "KeyLimitExceeded", "PoolLimitExceeded", "KeyScopeError", "KeyRateLimited",
    "PromotionError", "PromotionRateLimited", "AllocationExceedsBalance",
    "ValidationError", "ERROR_CODES",
]

# EOF silkllm-sdks/packages/python/silkllm/exceptions.py
