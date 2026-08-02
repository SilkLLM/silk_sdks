"""
webhooks.py
Verifying an inbound webhook delivery.

Deliberately free of any dependency on the client: the code that receives a
webhook is a request handler in your web app, and it has a secret and some
bytes, not a configured SDK instance.

    from silkllm import verify_webhook

    @app.post("/hooks/silkllm")
    async def hook(request):
        body = await request.body()
        if not verify_webhook(SECRET, body, request.headers.get("X-Silk-Signature", "")):
            return Response(status_code=401)
        event = json.loads(body)
        ...
"""

# File: silkllm-sdks/packages/python/silkllm/webhooks.py

import hashlib
import hmac
import json
from typing import Any, Dict, Optional

#: The header carrying the signature over the request body.
SIGNATURE_HEADER = "X-Silk-Signature"
#: The header carrying the unix timestamp the delivery was sent at.
TIMESTAMP_HEADER = "X-Silk-Timestamp"


def sign(secret: str, body: bytes) -> str:
    """Produce the signature for a body, in the same form the header carries."""
    return "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def verify_webhook(secret: str, body: bytes, signature: str) -> bool:
    """
    Check that a delivery really came from SilkLLM.

    Compared with `hmac.compare_digest` rather than `==`, so the check does not
    leak how much of a forged signature was correct through how long it took to
    reject it.

    Args:
        secret: The signing secret shown once when the webhook was created.
        body: The exact bytes of the request body. Not a re-serialised dict:
            any difference in key order or spacing changes the signature.
        signature: The value of the X-Silk-Signature header.

    Returns:
        True if the signature matches.
    """
    if not secret or not signature:
        return False
    if isinstance(body, str):
        body = body.encode()
    return hmac.compare_digest(sign(secret, body), signature)


def parse_event(body: bytes) -> Dict[str, Any]:
    """
    Decode a verified delivery into its event name, timestamp and payload.

    Verify first. Parsing an unverified body means acting on whatever an
    attacker chose to send.
    """
    return json.loads(body)


__all__ = ["verify_webhook", "sign", "parse_event", "SIGNATURE_HEADER", "TIMESTAMP_HEADER"]

# EOF silkllm-sdks/packages/python/silkllm/webhooks.py
