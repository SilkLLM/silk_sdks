/**
 * client.ts
 * SilkLLM JavaScript/TypeScript SDK.
 * Works in Node.js (>=18) and modern browsers.
 */

// File: silkllm-sdks/packages/javascript/src/client.ts

import type {
  GenerateOptions, GenerateResponse, ModelsResponse,
  BalanceResponse, UsageResponse, ProviderKey, DepositProviderKeyOptions,
  UpdateProviderKeyOptions, TrialStatus,
  ImageResult, AudioResult, VideoResult, ImageOptions, AudioOptions, VideoOptions,
  VoicesResponse, ContentPart, SpeechToSpeechOptions, CloneVoiceOptions, CloneVoiceResult, AudioInput,
  ApiKey, KeyUsage, CreateKeyOptions, UpdateKeyOptions,
} from "./types";
import { resolveBaseUrl } from "./endpoint";

// ── Multimodal input helpers ─────────────────────────────────────────────────
/** A text part for a multimodal message. */
export function textPart(text: string): ContentPart { return { type: "text", text }; }
/** An image part; `url` may be an http(s) URL or a data: URI (base64). */
export function imagePart(url: string): ContentPart { return { type: "image_url", image_url: { url } }; }
/** An audio input part; `data` is base64 audio, `format` e.g. "wav" or "mp3". */
export function audioPart(data: string, format = "wav"): ContentPart {
  return { type: "input_audio", input_audio: { data, format } };
}

/** Normalise a Blob / Uint8Array / ArrayBuffer into a Blob for upload. */
function toBlob(input: AudioInput, contentType = "audio/mpeg"): Blob {
  if (input instanceof Blob) return input;
  return new Blob([input as BlobPart], { type: contentType });
}

export class SilkLLMError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "SilkLLMError";
  }
}
export class AuthenticationError extends SilkLLMError {}
export class InsufficientBalanceError extends SilkLLMError {}
export class ModelNotFoundError extends SilkLLMError {}
export class RateLimitError extends SilkLLMError {}
export class ProviderError extends SilkLLMError {}

export class SilkLLM {
  private apiKey: string;
  private baseUrl: string;

  /**
   * You do not configure a server address. The SDK knows where SilkLLM is.
   *
   * @param options.apiKey   Your silk_ API key (or SILKLLM_API_KEY env var)
   * @param options.baseUrl  Advanced, and normally omitted. Point the SDK at a
   *                         self-hosted or local backend, e.g. "http://localhost:8000"
   *                         (no trailing slash, no /api).
   */
  constructor(options: { apiKey?: string; baseUrl?: string } = {}) {
    this.apiKey = options.apiKey
      || (typeof process !== "undefined" ? process.env.SILKLLM_API_KEY || "" : "");
    if (!this.apiKey) throw new AuthenticationError("auth_error", "No API key provided.");

    this.baseUrl = resolveBaseUrl(options.baseUrl);
  }

  async generate(options: GenerateOptions): Promise<GenerateResponse> {
    const body = { ...options, stream: false };
    return this._request("POST", "/api/generate", body) as Promise<GenerateResponse>;
  }

  async *stream(options: GenerateOptions): AsyncGenerator<string> {
    const body = { ...options, stream: true };
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: this._headers(),
      body: JSON.stringify(body),
    });
    if (!response.ok) await this._handleError(response);
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") return;
          try {
            const parsed = JSON.parse(data);
            if (parsed.content) yield parsed.content;
          } catch {}
        }
      }
    }
  }

  async models(provider?: string): Promise<ModelsResponse> {
    const params = provider ? `?provider=${provider}` : "";
    return this._request("GET", `/api/models${params}`) as Promise<ModelsResponse>;
  }

  async balance(): Promise<BalanceResponse> {
    return this._request("GET", "/api/balance") as Promise<BalanceResponse>;
  }

  async usage(page = 1, pageSize = 20): Promise<UsageResponse> {
    return this._request("GET", `/api/usage?page=${page}&page_size=${pageSize}`) as Promise<UsageResponse>;
  }

  /** Get your free-trial status (daily allowance, remaining today, end date). */
  async trialStatus(): Promise<TrialStatus> {
    return this._request("GET", "/api/trial") as Promise<TrialStatus>;
  }

  // ── Multimodal generation ──────────────────────────────────────────────────

  /** Generate one or more images from a text prompt. */
  async generateImage(options: ImageOptions): Promise<ImageResult> {
    return this._request("POST", "/api/generate/image", options) as Promise<ImageResult>;
  }

  /**
   * Generate speech audio (base64) from text.
   * For OpenAI TTS, `voice` is a name (alloy, echo, fable, onyx, nova, shimmer).
   * For ElevenLabs, `voice` is a voice_id from `listVoices()` and `voice_settings`
   * (stability, similarity_boost, style, use_speaker_boost) shape the delivery.
   */
  async generateAudio(options: AudioOptions): Promise<AudioResult> {
    return this._request("POST", "/api/generate/audio", options) as Promise<AudioResult>;
  }

  /** List the speakers available from a voice provider (ElevenLabs). */
  async listVoices(provider = "elevenlabs"): Promise<VoicesResponse> {
    return this._request("GET", `/api/generate/audio/voices?provider=${encodeURIComponent(provider)}`) as Promise<VoicesResponse>;
  }

  /**
   * Voice conversion (speech-to-speech): convert a source audio clip into the
   * same speech spoken by `voice` (an ElevenLabs voice_id, possibly cloned).
   */
  async speechToSpeech(options: SpeechToSpeechOptions): Promise<AudioResult> {
    const form = new FormData();
    form.append("audio", toBlob(options.audio, options.contentType), options.filename || "input.mp3");
    form.append("voice", options.voice);
    if (options.model) form.append("model", options.model);
    if (options.output_format) form.append("output_format", options.output_format);
    form.append("seconds", String(options.seconds ?? 10));
    const vs = options.voice_settings;
    if (vs) {
      for (const k of ["stability", "similarity_boost", "style"] as const) {
        if (vs[k] != null) form.append(k, String(vs[k]));
      }
      if (vs.use_speaker_boost != null) form.append("use_speaker_boost", String(vs.use_speaker_boost));
    }
    return this._requestForm("POST", "/api/generate/audio/speech-to-speech", form) as Promise<AudioResult>;
  }

  /** Create an instant voice clone from audio samples; returns the new voice_id. */
  async cloneVoice(options: CloneVoiceOptions): Promise<CloneVoiceResult> {
    const form = new FormData();
    form.append("name", options.name);
    if (options.description) form.append("description", options.description);
    options.samples.forEach((s, i) => form.append("files", toBlob(s), `sample_${i}.mp3`));
    return this._requestForm("POST", "/api/generate/audio/clone-voice", form) as Promise<CloneVoiceResult>;
  }

  /** Generate a short video from a text prompt (where a provider supports it). */
  async generateVideo(options: VideoOptions): Promise<VideoResult> {
    return this._request("POST", "/api/generate/video", options) as Promise<VideoResult>;
  }

  // ── BYOK marketplace: deposit and manage your own provider keys ────────────

  /**
   * Deposit one of your own provider API keys.
   * A public key lets SilkLLM's algorithm serve other users with it (you earn
   * platform credits); it is never shown to other users. A private key serves
   * only you. Set serveOwnerWithOwnKey=false to be served as if you deposited
   * nothing while a public key still serves the marketplace. The secret is
   * encrypted at rest and never returned.
   */
  // ── API key management ──────────────────────────────────────────────────
  // A key can be given a spend cap. Once the cost charged to it reaches the
  // cap, that key refuses requests with HTTP 402 and the code
  // `key_limit_exceeded`, while the rest of the account carries on.

  /**
   * Create an API key, optionally capped.
   *
   * The plaintext key is on `.key` of the result and is never retrievable
   * again, so store it now.
   *
   *   const key = await client.createKey({ name: "CI", spendLimitUsd: 5 });
   *   console.log(key.key); // the only time you will see this
   */
  async createKey(options: CreateKeyOptions): Promise<ApiKey> {
    return this._request("POST", "/api/keys", {
      name: options.name,
      spend_limit_usd: options.spendLimitUsd ?? null,
    }) as Promise<ApiKey>;
  }

  /** List your API keys, each with its cap, spend and remaining budget. */
  async listKeys(): Promise<ApiKey[]> {
    return this._request("GET", "/api/keys") as Promise<ApiKey[]>;
  }

  /**
   * Rename a key, change its cap, or disable it.
   *
   * Raising the cap on an exhausted key makes it work again immediately without
   * clearing what it has already spent. Pass `clearSpendLimit` to remove the cap
   * entirely; omitting `spendLimitUsd` means "leave it as it is", which is why
   * removal needs its own flag.
   */
  async updateKey(keyId: string, changes: UpdateKeyOptions): Promise<ApiKey> {
    const body: Record<string, unknown> = { clear_spend_limit: changes.clearSpendLimit ?? false };
    if (changes.name !== undefined) body.name = changes.name;
    if (changes.spendLimitUsd !== undefined) body.spend_limit_usd = changes.spendLimitUsd;
    if (changes.isActive !== undefined) body.is_active = changes.isActive;
    return this._request("PATCH", `/api/keys/${keyId}`, body) as Promise<ApiKey>;
  }

  /** Revoke a key. It stops authenticating at once; its history is kept. */
  async revokeKey(keyId: string): Promise<void> {
    await this._request("DELETE", `/api/keys/${keyId}`);
  }

  /**
   * A key's request history, newest first, with lifetime totals.
   *
   * `status` filters the page only. The totals always cover the whole history,
   * so filtering never changes what the key appears to have spent.
   */
  async keyUsage(
    keyId: string,
    options: { page?: number; pageSize?: number; status?: string } = {},
  ): Promise<KeyUsage> {
    const q = new URLSearchParams({
      page: String(options.page ?? 1),
      page_size: String(options.pageSize ?? 50),
    });
    if (options.status) q.set("status", options.status);
    return this._request("GET", `/api/keys/${keyId}/usage?${q}`) as Promise<KeyUsage>;
  }

  /**
   * Zero a key's spend counter, restoring its full budget.
   *
   * Refunds nothing: the money already left the account balance. It clears only
   * the counter the cap is measured against, and leaves the history untouched.
   */
  async resetKeyUsage(keyId: string): Promise<{ id: string; name: string; spent_usd: number; message: string }> {
    return this._request("POST", `/api/keys/${keyId}/reset`) as Promise<any>;
  }

  async depositProviderKey(options: DepositProviderKeyOptions): Promise<ProviderKey> {
    const body = {
      provider_id: options.providerId,
      api_key: options.apiKey,
      label: options.label ?? "My key",
      is_public: options.isPublic ?? false,
      is_free_key: options.isFreeKey ?? false,
      serve_owner_with_own_key: options.serveOwnerWithOwnKey ?? true,
      declared_budget_usd: options.declaredBudgetUsd ?? 0,
      ...(options.dailyLimitUsd !== undefined ? { daily_limit_usd: options.dailyLimitUsd } : {}),
    };
    return this._request("POST", "/api/provider-keys", body) as Promise<ProviderKey>;
  }

  /** List your deposited provider keys with earnings and requests served. */
  async listProviderKeys(): Promise<ProviderKey[]> {
    return this._request("GET", "/api/provider-keys") as Promise<ProviderKey[]>;
  }

  /** Update a deposited key (visibility, limits, budget, serve preference, label). */
  async updateProviderKey(keyId: string, changes: UpdateProviderKeyOptions): Promise<ProviderKey> {
    return this._request("PATCH", `/api/provider-keys/${keyId}`, changes) as Promise<ProviderKey>;
  }

  /** Revoke a deposited key so it stops being used immediately. */
  async revokeProviderKey(keyId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/provider-keys/${keyId}`, {
      method: "DELETE",
      headers: this._headers(),
    });
    if (!response.ok) await this._handleError(response);
  }

  private _headers(): Record<string, string> {
    return {
      "Authorization": `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "silkllm-js/1.0.0",
    };
  }

  private async _request(method: string, path: string, body?: unknown): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: this._headers(),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) await this._handleError(response);
    return response.json();
  }

  /** Multipart request (file uploads). No Content-Type header: fetch sets the boundary. */
  private async _requestForm(method: string, path: string, form: FormData): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { "Authorization": `Bearer ${this.apiKey}`, "User-Agent": "silkllm-js/1.0.0" },
      body: form,
    });
    if (!response.ok) await this._handleError(response);
    return response.json();
  }

  private async _handleError(response: Response): Promise<never> {
    let detail = "Unknown error";
    try {
      const data = await response.json();
      detail = data.detail || data.message || JSON.stringify(data);
    } catch {}
    const status = response.status;
    if (status === 401) throw new AuthenticationError("auth_error", detail);
    if (status === 402) throw new InsufficientBalanceError("insufficient_balance", detail);
    if (status === 404) throw new ModelNotFoundError("model_not_found", detail);
    if (status === 429) throw new RateLimitError("rate_limit", detail);
    if (status === 502) throw new ProviderError("provider_error", detail);
    throw new SilkLLMError("unknown", detail);
  }
}

export default SilkLLM;

// EOF silkllm-sdks/packages/javascript/src/client.ts
