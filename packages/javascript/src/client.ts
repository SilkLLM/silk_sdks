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
  VoicesResponse,
} from "./types";

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
   * @param options.apiKey   Your silk_ API key (or SILKLLM_API_KEY env var)
   * @param options.baseUrl  For self-hosted, e.g. "http://localhost:8000" (no trailing slash, no /api)
   */
  constructor(options: { apiKey?: string; baseUrl?: string } = {}) {
    this.apiKey = options.apiKey
      || (typeof process !== "undefined" ? process.env.SILKLLM_API_KEY || "" : "");
    if (!this.apiKey) throw new AuthenticationError("auth_error", "No API key provided.");

    this.baseUrl = (options.baseUrl || process.env.SILKLLM_BASE_URL || "https://silkllm.onrender.com").replace(/\/$/, "");
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
