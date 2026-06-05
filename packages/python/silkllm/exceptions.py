"""
exceptions.py
SilkLLM Python SDK exception hierarchy.
"""

# File: silkllm-sdks/packages/python/silkllm/exceptions.py

class SilkLLMError(Exception):
    """Base exception for all SilkLLM SDK errors."""
    pass

class AuthenticationError(SilkLLMError):
    """Raised when the API key is invalid or missing."""
    pass

class InsufficientBalanceError(SilkLLMError):
    """Raised when the user's credit balance is too low."""
    pass

class ModelNotFoundError(SilkLLMError):
    """Raised when the requested model doesn't exist or is disabled."""
    pass

class RateLimitError(SilkLLMError):
    """Raised when the rate limit is exceeded."""
    pass

class ProviderError(SilkLLMError):
    """Raised when the underlying LLM provider fails (after fallback attempts)."""
    pass

# EOF silkllm-sdks/packages/python/silkllm/exceptions.py
