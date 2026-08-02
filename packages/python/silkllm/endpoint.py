"""
endpoint.py
Where the SilkLLM API lives.

This is the single place the Python SDK records the service address. Callers are
not expected to know or supply it: `silkllm.Client(api_key=...)` resolves the
endpoint on its own, and if the service ever moves, only this file changes.

Resolution order:
  1. an explicit base_url= argument   (self-hosted or a private deployment)
  2. the SILKLLM_BASE_URL env var     (staging, local backend, CI)
  3. the managed service              (what nearly everyone uses)
"""

# File: silkllm-sdks/packages/python/silkllm/endpoint.py

import os

#: The managed SilkLLM service. Note there is no "/api" suffix; the SDK appends
#: the path segments it needs.
DEFAULT_BASE_URL = "https://silkllm-backend.169.58.53.167.nip.io"


def resolve_base_url(explicit: str = "") -> str:
    """Return the base URL to talk to, without a trailing slash."""
    chosen = explicit or os.environ.get("SILKLLM_BASE_URL") or DEFAULT_BASE_URL
    return chosen.rstrip("/")


# EOF silkllm-sdks/packages/python/silkllm/endpoint.py
