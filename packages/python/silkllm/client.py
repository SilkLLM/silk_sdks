"""
client.py
SilkLLM Python SDK - main client class.
Provides a clean interface to the SilkLLM API: generate, stream, list models, check balance.
"""

# File: silkllm-sdks/packages/python/silkllm/client.py

import os
from typing import Optional, List, Dict, Any, Generator
import httpx

from silkllm.types import (
    GenerateResponse, ModelsResponse,
    BalanceResponse, UsageResponse, Message, ProviderKey, TrialStatus,
    ImageResult, AudioResult, VideoResult, VoiceSettings, Voice,
    ApiKey, KeyUsage,
)
from silkllm.exceptions import (
    ERROR_CODES, SilkLLMError, AuthenticationError, InsufficientBalanceError,
    ModelNotFoundError, RateLimitError, ProviderError,
)
from silkllm.endpoint import resolve_base_url


def _read_bytes(source: Any) -> bytes:
    """Read audio input given as a file path, raw bytes, or a file-like object."""
    if isinstance(source, (bytes, bytearray)):
        return bytes(source)
    if isinstance(source, str):
        with open(source, "rb") as f:
            return f.read()
    if hasattr(source, "read"):
        return source.read()
    raise SilkLLMError("Audio must be a file path, bytes, or a file-like object.")


class Client:
    """
    SilkLLM Python SDK client.

    Usage:
        import silkllm
        client = silkllm.Client(api_key="silk_...")
        response = client.generate(
            messages=[{"role": "user", "content": "Hello!"}]
        )
        print(response.content)

    You do not configure a server address. The SDK knows where SilkLLM is.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = "",
        timeout: float = 60.0,
    ):
        """
        Initialize the SilkLLM client.

        Args:
            api_key: Your SilkLLM API key (starts with silk_).
                     Reads from SILKLLM_API_KEY env var if not provided.
            base_url: Advanced, and normally omitted. Point the SDK at a
                      self-hosted or local backend, e.g. "http://localhost:8000".
                      Do not include '/api'. When empty the SDK uses
                      SILKLLM_BASE_URL if set, otherwise the managed service.
            timeout:  Request timeout in seconds.
        """
        self.api_key = api_key or os.environ.get("SILKLLM_API_KEY")
        if not self.api_key:
            raise AuthenticationError(
                "No API key provided. Pass api_key= or set the SILKLLM_API_KEY env var."
            )
        self.base_url = resolve_base_url(base_url)
        self._client = httpx.Client(
            base_url=self.base_url,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "User-Agent": "silkllm-python/1.0.0",
            },
            timeout=timeout,
        )

    def generate(
        self,
        messages: List[Dict[str, Any]],
        model: Optional[str] = None,
        provider: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> GenerateResponse:
        """
        Generate a completion (non-streaming).

        Args:
            messages:    List of message dicts: [{"role": "user", "content": "..."}]
                         Roles: "user", "assistant", "system"
            model:       Optional. Specific model ID e.g. "gpt-4o", "claude-3-5-sonnet-20241022"
            provider:    Optional. Specific provider e.g. "openai", "anthropic"
            temperature: Sampling temperature 0.0-2.0 (default 0.7)
            max_tokens:  Maximum tokens to generate (default 2048)

        Returns:
            GenerateResponse with .content, .model, .usage, .cost_usd, .balance_after

        Raises:
            InsufficientBalanceError: Not enough credits.
            ModelNotFoundError:       Requested model not available.
            ProviderError:            All providers failed.
            AuthenticationError:      Invalid API key.
            RateLimitError:           Too many requests.
        """
        payload = {
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": False,
        }
        if model:    payload["model"] = model
        if provider: payload["provider"] = provider

        response = self._request("POST", "/api/generate", json=payload)
        return GenerateResponse(**response)

    def stream(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        provider: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> Generator[str, None, None]:
        """
        Generate a completion with streaming (yields text chunks).

        Args:
            Same as generate(), except returns a generator of string chunks.

        Usage:
            for chunk in client.stream(messages=[...]):
                print(chunk, end="", flush=True)
        """
        payload = {
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
        }
        if model:    payload["model"] = model
        if provider: payload["provider"] = provider

        import json
        with self._client.stream("POST", "/api/generate", json=payload) as response:
            self._check_response(response)
            for line in response.iter_lines():
                if line.startswith("data: "):
                    data_str = line[6:]
                    if data_str == "[DONE]":
                        break
                    try:
                        data = json.loads(data_str)
                        if "content" in data:
                            yield data["content"]
                        elif "error" in data:
                            raise ProviderError(data["error"])
                    except json.JSONDecodeError:
                        continue

    def models(self, provider: Optional[str] = None) -> ModelsResponse:
        """
        List all available models.

        Args:
            provider: Optional. Filter by provider e.g. "openai".

        Returns:
            ModelsResponse with .models list and .total count.
        """
        params = {}
        if provider: params["provider"] = provider
        response = self._request("GET", "/api/models", params=params)
        return ModelsResponse(**response)

    def balance(self) -> BalanceResponse:
        """
        Get your current credit balance.

        Returns:
            BalanceResponse with .balance_usd
        """
        response = self._request("GET", "/api/balance")
        return BalanceResponse(**response)

    def usage(self, page: int = 1, page_size: int = 20) -> UsageResponse:
        """
        Get your usage and transaction history (paginated).

        Args:
            page:      Page number (default 1)
            page_size: Items per page (default 20, max 100)

        Returns:
            UsageResponse with .entries list, .total, .page, .page_size
        """
        response = self._request("GET", "/api/usage", params={"page": page, "page_size": page_size})
        return UsageResponse(**response)

    # ── Multimodal generation ─────────────────────────────────────────────────

    def generate_image(
        self, prompt: str, model: Optional[str] = None, provider: Optional[str] = None,
        n: int = 1, size: str = "1024x1024",
    ) -> ImageResult:
        """Generate one or more images from a text prompt."""
        payload = {"prompt": prompt, "n": n, "size": size}
        if model:    payload["model"] = model
        if provider: payload["provider"] = provider
        return ImageResult(**self._request("POST", "/api/generate/image", json=payload))

    def generate_audio(
        self, prompt: str, model: Optional[str] = None, provider: Optional[str] = None,
        voice: str = "alloy", voice_settings: Optional[VoiceSettings] = None,
        output_format: Optional[str] = None,
    ) -> AudioResult:
        """
        Generate speech audio (base64) from text.

        For OpenAI TTS, ``voice`` is a voice name (alloy, echo, fable, onyx, nova,
        shimmer). For ElevenLabs, ``voice`` is a voice_id from ``list_voices()``
        and ``voice_settings`` (stability, similarity_boost, style, use_speaker_boost)
        shape the delivery. ``output_format`` (e.g. "mp3_44100_128") applies to
        ElevenLabs.
        """
        payload: Dict[str, Any] = {"prompt": prompt, "voice": voice}
        if model:    payload["model"] = model
        if provider: payload["provider"] = provider
        if voice_settings is not None:
            payload["voice_settings"] = (
                voice_settings.to_dict() if isinstance(voice_settings, VoiceSettings) else voice_settings
            )
        if output_format: payload["output_format"] = output_format
        return AudioResult(**self._request("POST", "/api/generate/audio", json=payload))

    def list_voices(self, provider: str = "elevenlabs") -> List[Voice]:
        """List the speakers available from a voice provider (ElevenLabs)."""
        resp = self._request("GET", "/api/generate/audio/voices", params={"provider": provider})
        return [Voice(**v) for v in resp.get("voices", [])]

    def speech_to_speech(
        self, audio, voice: str, model: Optional[str] = None, output_format: Optional[str] = None,
        seconds: int = 10, voice_settings: Optional[VoiceSettings] = None,
        filename: str = "input.mp3", content_type: str = "audio/mpeg",
    ) -> AudioResult:
        """
        Voice conversion (speech-to-speech): convert a source audio clip into the
        same speech spoken by `voice` (an ElevenLabs voice_id, possibly a cloned
        one). `audio` is a file path or raw bytes.
        """
        data = _read_bytes(audio)
        form: Dict[str, Any] = {"voice": voice, "seconds": str(seconds)}
        if model:         form["model"] = model
        if output_format: form["output_format"] = output_format
        if voice_settings is not None:
            vs = voice_settings.to_dict() if isinstance(voice_settings, VoiceSettings) else dict(voice_settings)
            for k in ("stability", "similarity_boost", "style"):
                if vs.get(k) is not None: form[k] = str(vs[k])
            if vs.get("use_speaker_boost") is not None:
                form["use_speaker_boost"] = str(bool(vs["use_speaker_boost"])).lower()
        files = {"audio": (filename, data, content_type)}
        return AudioResult(**self._request_multipart("POST", "/api/generate/audio/speech-to-speech", form, files))

    def clone_voice(self, name: str, samples: List[Any], description: str = "") -> Dict[str, Any]:
        """
        Create an instant voice clone from one or more audio samples (file paths
        or raw bytes). Returns {"voice_id", "name", ...}; use the voice_id as a
        speaker for generate_audio or speech_to_speech.
        """
        form: Dict[str, Any] = {"name": name}
        if description: form["description"] = description
        files = [("files", (f"sample_{i}.mp3", _read_bytes(s), "audio/mpeg")) for i, s in enumerate(samples)]
        if not files:
            raise SilkLLMError("At least one audio sample is required to clone a voice.")
        return self._request_multipart("POST", "/api/generate/audio/clone-voice", form, files)

    def generate_video(
        self, prompt: str, model: Optional[str] = None, provider: Optional[str] = None,
        seconds: int = 5,
    ) -> VideoResult:
        """Generate a short video from a text prompt (where a provider supports it)."""
        payload = {"prompt": prompt, "seconds": seconds}
        if model:    payload["model"] = model
        if provider: payload["provider"] = provider
        return VideoResult(**self._request("POST", "/api/generate/video", json=payload))

    def trial_status(self) -> TrialStatus:
        """
        Get your free-trial status: daily allowance, how much is left today, and
        when the trial ends. Trials cover usage for users without balance during
        the onboarding window, and work through the API too.
        """
        response = self._request("GET", "/api/trial")
        return TrialStatus(**response)

    # ── BYOK marketplace: deposit and manage your own provider keys ───────────

    # ── API key management ───────────────────────────────────────────────
    # A key can be given a spend cap. Once the cost charged to it reaches the
    # cap, that key refuses requests with HTTP 402 and the code
    # `key_limit_exceeded`, while the rest of the account carries on.

    def create_key(
        self,
        name: str,
        spend_limit_usd: Optional[float] = None,
        alert_at_percent: Optional[int] = None,
        allowed_models: Optional[List[str]] = None,
        allowed_providers: Optional[List[str]] = None,
        rate_limit_per_min: Optional[int] = None,
        budget_pool_id: Optional[str] = None,
    ) -> ApiKey:
        """
        Create an API key, optionally with limits on what it may do.

        The plaintext key is on the returned object as `.key` and is never
        retrievable again, so store it now.

            key = client.create_key(
                "CI pipeline",
                spend_limit_usd=5.0,
                alert_at_percent=80,
                allowed_models=["gpt-4o-mini"],
                rate_limit_per_min=30,
            )
            print(key.key)   # the only time you will see this

        Every limit is optional, and a key created without any behaves exactly
        as keys always have.

        Args:
            name: Label for the key, so you know which one to revoke later.
            spend_limit_usd: Cap on how much of your balance this key may spend.
                Reaching it raises KeyLimitExceeded (HTTP 402).
            alert_at_percent: Notify once the key passes this share of its cap,
                e.g. 80. Needs a cap to mean anything.
            allowed_models: Restrict the key to these model ids. Anything else
                raises KeyScopeError (HTTP 403).
            allowed_providers: The same restriction, by provider.
            rate_limit_per_min: Requests-per-minute ceiling for this key alone.
                Exceeding it raises KeyRateLimited (HTTP 429).
            budget_pool_id: Draw on a shared budget as well as this key's own
                cap. Exhausting it raises PoolLimitExceeded (HTTP 402).
        """
        payload: Dict[str, Any] = {"name": name}
        for field, value in (
            ("spend_limit_usd", spend_limit_usd),
            ("alert_at_percent", alert_at_percent),
            ("allowed_models", allowed_models),
            ("allowed_providers", allowed_providers),
            ("rate_limit_per_min", rate_limit_per_min),
            ("budget_pool_id", budget_pool_id),
        ):
            # Only send what was asked for. The API rejects unknown fields, and
            # sending explicit nulls would be indistinguishable from "no limit"
            # on an endpoint where that distinction matters.
            if value is not None:
                payload[field] = value
        return ApiKey.from_api(self._request("POST", "/api/keys", json=payload))

    def list_keys(self) -> List[ApiKey]:
        """List your API keys, each with its cap, spend and remaining budget."""
        return [ApiKey.from_api(k) for k in self._request("GET", "/api/keys")]

    def update_key(
        self,
        key_id: str,
        name: Optional[str] = None,
        spend_limit_usd: Optional[float] = None,
        alert_at_percent: Optional[int] = None,
        allowed_models: Optional[List[str]] = None,
        allowed_providers: Optional[List[str]] = None,
        rate_limit_per_min: Optional[int] = None,
        budget_pool_id: Optional[str] = None,
        is_active: Optional[bool] = None,
        clear_spend_limit: bool = False,
        clear_alert: bool = False,
        clear_scope: bool = False,
        clear_rate_limit: bool = False,
        clear_budget_pool: bool = False,
    ) -> ApiKey:
        """
        Rename a key, change any of its limits, or disable it.

        Raising the cap on an exhausted key makes it work again immediately
        without clearing what it has already spent.

        Removing a limit needs its own flag. A None argument means "leave this
        as it is", so without the flags a call that only renamed a key would be
        unable to ever take a limit off:

            client.update_key(key.id, clear_rate_limit=True)
        """
        payload: Dict[str, Any] = {}
        for field, value in (
            ("name", name),
            ("spend_limit_usd", spend_limit_usd),
            ("alert_at_percent", alert_at_percent),
            ("allowed_models", allowed_models),
            ("allowed_providers", allowed_providers),
            ("rate_limit_per_min", rate_limit_per_min),
            ("budget_pool_id", budget_pool_id),
            ("is_active", is_active),
        ):
            if value is not None:
                payload[field] = value
        for flag, on in (
            ("clear_spend_limit", clear_spend_limit),
            ("clear_alert", clear_alert),
            ("clear_scope", clear_scope),
            ("clear_rate_limit", clear_rate_limit),
            ("clear_budget_pool", clear_budget_pool),
        ):
            if on:
                payload[flag] = True
        return ApiKey.from_api(self._request("PATCH", f"/api/keys/{key_id}", json=payload))

    def revoke_key(self, key_id: str) -> None:
        """
        Revoke a key. It stops authenticating immediately.

        Soft delete: the usage history is kept for audit.
        """
        self._request("DELETE", f"/api/keys/{key_id}")

    def key_usage(
        self,
        key_id: str,
        page: int = 1,
        page_size: int = 50,
        status: Optional[str] = None,
    ) -> KeyUsage:
        """
        Fetch a key's request history, newest first, with lifetime totals.

        Args:
            status: Filter the page, e.g. "ok" or "limit_exceeded". The totals
                    always cover the whole history, so filtering does not change
                    what the key appears to have spent.
        """
        params = {"page": page, "page_size": page_size}
        if status:
            params["status"] = status
        return KeyUsage(**self._request("GET", f"/api/keys/{key_id}/usage", params=params))

    def reset_key_usage(self, key_id: str) -> ApiKey:
        """
        Zero a key's spend counter, restoring its full budget.

        This refunds nothing: the money already left the account balance. It
        clears only the counter the cap is measured against, and leaves the
        usage history untouched.
        """
        response = self._request("POST", f"/api/keys/{key_id}/reset")
        # The reset endpoint answers with a summary rather than the full key.
        return ApiKey.from_api(response)


    def delete_key(self, key_id: str) -> None:
        """
        Delete a revoked key and its activity log for good.

        Two steps on purpose. `revoke_key()` stops the key but keeps its history,
        because a key that stopped and left no trace cannot be investigated. This
        is the second step, for when the trace is no longer wanted, and it only
        works on a key that is already revoked.

        The account ledger is untouched: that is the record of money that moved,
        it belongs to the account rather than the key, and deleting a key must
        not put a hole in the books.
        """
        self._request("DELETE", f"/api/keys/{key_id}/permanent")

    def allocation(self) -> Dict[str, float]:
        """
        Balance, how much of it limits already promise, and what is left.

        A spend limit sets aside part of the one account balance for one key, so
        limits compete: the sum of the unspent parts cannot exceed the balance.
        Check this before setting one to know what will be accepted.

            free = client.allocation()["available"]
            client.create_key("CI", spend_limit_usd=min(5.0, free))
        """
        return self._request("GET", "/api/keys/allocation")

    def export_key_usage(self, key_id: str, format: str = "csv") -> bytes:
        """
        Download a key's full request history for auditing.

        Returns the raw file bytes rather than parsed rows, because the usual
        destination is a file or a spreadsheet:

            open("audit.csv", "wb").write(client.export_key_usage(key.id))

        Args:
            format: "csv" or "json".
        """
        # Straight through the configured client, which already carries auth.
        # Not via _request(): the body is a file, not JSON.
        response = self._client.get(
            f"/api/keys/{key_id}/usage/export", params={"format": format},
        )
        self._check_response(response)
        return response.content

    # ── Shared budgets ─────────────────────────────────────────────────────
    # A budget several keys draw on together, so a team or an environment has
    # one ceiling regardless of how many keys are handed out inside it.

    def create_budget(self, name: str, spend_limit_usd: Optional[float] = None) -> Dict[str, Any]:
        """
        Create a shared budget.

        Attach keys to it with `create_key(..., budget_pool_id=budget["id"])`.
        A budget with no limit only groups keys and reports what they spent.
        """
        payload: Dict[str, Any] = {"name": name}
        if spend_limit_usd is not None:
            payload["spend_limit_usd"] = spend_limit_usd
        return self._request("POST", "/api/budgets", json=payload)

    def list_budgets(self) -> List[Dict[str, Any]]:
        """List your shared budgets, each with its limit, spend and key count."""
        return self._request("GET", "/api/budgets")

    def update_budget(
        self,
        budget_id: str,
        name: Optional[str] = None,
        spend_limit_usd: Optional[float] = None,
        clear_spend_limit: bool = False,
    ) -> Dict[str, Any]:
        """Rename a shared budget or change its limit. Removal needs the flag."""
        payload: Dict[str, Any] = {}
        if name is not None:
            payload["name"] = name
        if spend_limit_usd is not None:
            payload["spend_limit_usd"] = spend_limit_usd
        if clear_spend_limit:
            payload["clear_spend_limit"] = True
        return self._request("PATCH", f"/api/budgets/{budget_id}", json=payload)

    def reset_budget(self, budget_id: str) -> Dict[str, Any]:
        """
        Zero a shared budget's counter, giving every key on it room again.

        Refunds nothing: that money already left the account balance.
        """
        return self._request("POST", f"/api/budgets/{budget_id}/reset")

    def delete_budget(self, budget_id: str) -> None:
        """
        Delete a shared budget.

        Keys attached to it keep working and fall back to their own caps.
        """
        self._request("DELETE", f"/api/budgets/{budget_id}")

    # ── Webhooks ───────────────────────────────────────────────────────────
    # Outbound notifications for limit events, so you hear about a key running
    # out before a customer does.

    def create_webhook(self, url: str, events: List[str]) -> Dict[str, Any]:
        """
        Register an https endpoint for limit events.

        The signing secret is on the returned object as `["secret"]` and is
        shown exactly once. Store it now; verifying deliveries is impossible
        without it.

        Args:
            url: An https endpoint. Plain http is refused.
            events: Which events to send. See `webhook_events()`.
        """
        return self._request("POST", "/api/webhooks", json={"url": url, "events": events})

    def list_webhooks(self) -> List[Dict[str, Any]]:
        """List your webhooks, with the outcome of the last delivery to each."""
        return self._request("GET", "/api/webhooks")

    def webhook_events(self) -> List[str]:
        """The event names a webhook can subscribe to."""
        return self._request("GET", "/api/webhooks/events")

    def test_webhook(self, webhook_id: str) -> Dict[str, Any]:
        """
        Send a signed test delivery, and report what the endpoint answered.

        Useful for checking a signature check before a real limit is reached.
        """
        return self._request("POST", f"/api/webhooks/{webhook_id}/test")

    def delete_webhook(self, webhook_id: str) -> None:
        """Remove a webhook. Deliveries stop and the secret is discarded."""
        self._request("DELETE", f"/api/webhooks/{webhook_id}")

    def deposit_provider_key(
        self,
        provider_id: str,
        api_key: str,
        label: str = "My key",
        is_public: bool = False,
        is_free_key: bool = False,
        serve_owner_with_own_key: bool = True,
        daily_limit_usd: Optional[float] = None,
        declared_budget_usd: float = 0.0,
    ) -> ProviderKey:
        """
        Deposit one of your own provider API keys.

        - is_public=True lets SilkLLM's algorithm serve other users with it, and
          you earn platform credits when they do. A public key is never shown to
          other users; only the algorithm and admins ever see it.
        - is_public=False (private) means only you are ever routed through it.
        - serve_owner_with_own_key=False routes your own requests as if you had
          not deposited a key, while a public key still serves the marketplace.

        The secret is encrypted at rest and never returned.
        """
        payload = {
            "provider_id": provider_id,
            "api_key": api_key,
            "label": label,
            "is_public": is_public,
            "is_free_key": is_free_key,
            "serve_owner_with_own_key": serve_owner_with_own_key,
            "declared_budget_usd": declared_budget_usd,
        }
        if daily_limit_usd is not None:
            payload["daily_limit_usd"] = daily_limit_usd
        response = self._request("POST", "/api/provider-keys", json=payload)
        return ProviderKey(**response)

    def list_provider_keys(self) -> List[ProviderKey]:
        """List your deposited provider keys with earnings and requests served."""
        response = self._request("GET", "/api/provider-keys")
        return [ProviderKey(**k) for k in response]

    def update_provider_key(self, key_id: str, **fields) -> ProviderKey:
        """
        Update a deposited key. Accepts any of: label, is_public, is_free_key,
        serve_owner_with_own_key, daily_limit_usd, declared_budget_usd.
        """
        response = self._request("PATCH", f"/api/provider-keys/{key_id}", json=fields)
        return ProviderKey(**response)

    def revoke_provider_key(self, key_id: str) -> None:
        """Revoke a deposited key so it stops being used immediately."""
        resp = self._client.request("DELETE", f"/api/provider-keys/{key_id}")
        self._check_response(resp)

    def _request(self, method: str, path: str, **kwargs) -> dict:
        """Make an HTTP request and handle errors uniformly."""
        try:
            response = self._client.request(method, path, **kwargs)
            self._check_response(response)
            # DELETE answers 204 with no body at all, and json() on an empty
            # string raises. Every delete in this client went through here, so
            # all of them failed on success.
            if response.status_code == 204 or not response.content:
                return {}
            return response.json()
        except httpx.TimeoutException:
            raise SilkLLMError("Request timed out. Try again or increase the timeout.")
        except httpx.NetworkError as e:
            raise SilkLLMError(f"Network error: {e}")

    def _request_multipart(self, method: str, path: str, data: dict, files) -> dict:
        """
        Send a multipart/form-data request (file uploads). Uses a fresh request so
        the client's default JSON Content-Type does not clobber the multipart
        boundary; auth is still applied.
        """
        headers = {"Authorization": f"Bearer {self.api_key}", "User-Agent": "silkllm-python/1.0.0"}
        try:
            response = httpx.request(
                method, f"{self.base_url}{path}", data=data, files=files, headers=headers, timeout=180.0
            )
            self._check_response(response)
            return response.json()
        except httpx.TimeoutException:
            raise SilkLLMError("Request timed out. Try again or increase the timeout.")
        except httpx.NetworkError as e:
            raise SilkLLMError(f"Network error: {e}")

    def _check_response(self, response: httpx.Response):
        """Raise the appropriate exception for non-2xx responses."""
        if response.status_code < 300:
            return
        try:
            body = response.json()
        except Exception:
            body = {}

        error = body.get("error") if isinstance(body, dict) else None
        if isinstance(error, dict):
            code = error.get("code", "unknown")
            message = error.get("message") or "Unknown error"
            details = error.get("details") or {}
        else:
            # Not every failure comes through the gateway's own handler. A plain
            # FastAPI HTTPException answers with {"detail": ...}, and throwing
            # that away leaves the caller holding "Unknown error" when the real
            # reason was sitting right there in the body.
            code, details = "unknown", {}
            detail = body.get("detail") if isinstance(body, dict) else None
            if isinstance(detail, list):          # a validation error
                code = "validation_error"
                detail = "; ".join(
                    f"{'.'.join(str(p) for p in d.get('loc', [])[1:])}: {d.get('msg', '')}"
                    for d in detail if isinstance(d, dict)
                )
            message = detail or (response.text or "Unknown error")[:500]

        kw = {"code": code, "status_code": response.status_code, "details": details}

        # The code is checked before the status, because several distinct
        # situations share one. A spent key and an empty account are both 402,
        # and they need completely different responses from the caller.
        specific = ERROR_CODES.get(code)
        if specific is not None:
            raise specific(message, **kw)

        by_status = {
            401: AuthenticationError, 402: InsufficientBalanceError,
            403: SilkLLMError, 404: ModelNotFoundError,
            429: RateLimitError, 502: ProviderError,
        }
        raise by_status.get(response.status_code, SilkLLMError)(message, **kw)

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self._client.close()

    def close(self):
        """Close the underlying HTTP client."""
        self._client.close()


__all__ = ["Client"]

# EOF silkllm-sdks/packages/python/silkllm/client.py
