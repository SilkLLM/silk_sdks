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
)
from silkllm.exceptions import (
    SilkLLMError, AuthenticationError, InsufficientBalanceError,
    ModelNotFoundError, RateLimitError, ProviderError
)


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
        client = silkllm.Client(api_key="silk_...", base_url="https://silkllm.onrender.com")
        response = client.generate(
            messages=[{"role": "user", "content": "Hello!"}]
        )
        print(response.content)
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = "https://silkllm.onrender.com",
        timeout: float = 60.0,
    ):
        """
        Initialize the SilkLLM client.

        Args:
            api_key: Your SilkLLM API key (starts with silk_).
                     Reads from SILKLLM_API_KEY env var if not provided.
            base_url: API base URL. DO NOT include '/api' (e.g., "http://localhost:8000").
                      Defaults to https://silkllm.onrender.com.
            timeout:  Request timeout in seconds.
        """
        self.api_key = api_key or os.environ.get("SILKLLM_API_KEY")
        if not self.api_key:
            raise AuthenticationError(
                "No API key provided. Pass api_key= or set the SILKLLM_API_KEY env var."
            )
        self.base_url = base_url.rstrip("/")
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
            error = response.json().get("error", {})
            code    = error.get("code", "unknown")
            message = error.get("message", "Unknown error")
        except Exception:
            code, message = "unknown", response.text

        if response.status_code == 401:
            raise AuthenticationError(message)
        elif response.status_code == 402:
            raise InsufficientBalanceError(message)
        elif response.status_code == 404:
            raise ModelNotFoundError(message)
        elif response.status_code == 429:
            raise RateLimitError(message)
        elif response.status_code == 502:
            raise ProviderError(message)
        else:
            raise SilkLLMError(f"[{code}] {message}")

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self._client.close()

    def close(self):
        """Close the underlying HTTP client."""
        self._client.close()


__all__ = ["Client"]

# EOF silkllm-sdks/packages/python/silkllm/client.py
