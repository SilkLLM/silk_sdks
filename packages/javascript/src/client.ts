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
  ApiKey, KeyUsage, CreateKeyOptions, UpdateKeyOptions, KeyControls,
  BudgetPool, Webhook,
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

/**
 * Base error for everything this client throws.
 *
 * `code` is the part worth branching on. Several distinct situations share one
 * HTTP status, and telling them apart is the difference between raising a key's
 * limit and topping the account up.
 */
export class SilkLLMError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode?: number,
    /** The numbers behind the message, so nobody has to parse the sentence. */
    public details: Record<string, any> = {},
  ) {
    super(message);
    this.name = new.target.name;
  }
}
export class AuthenticationError extends SilkLLMError {}
export class InsufficientBalanceError extends SilkLLMError {}
export class ModelNotFoundError extends SilkLLMError {}
export class RateLimitError extends SilkLLMError {}
export class ProviderError extends SilkLLMError {}

/** The key making the request has reached its own spend limit. */
export class KeyLimitExceeded extends SilkLLMError {}
/** The shared budget this key draws on has been used up. */
export class PoolLimitExceeded extends SilkLLMError {}
/** The key is not allowed to use the model or provider requested. */
export class KeyScopeError extends SilkLLMError {}
/** The key exceeded its own requests-per-minute ceiling. Clears on its own. */
export class KeyRateLimited extends SilkLLMError {}

/** Error codes the API sends, mapped to the class thrown for them. */
const ERROR_CODES: Record<string, typeof SilkLLMError> = {
  key_limit_exceeded: KeyLimitExceeded,
  pool_limit_exceeded: PoolLimitExceeded,
  key_scope_denied: KeyScopeError,
  key_rate_limited: KeyRateLimited,
  insufficient_balance: InsufficientBalanceError,
};

/**
 * Translate the camelCase control options into the API's snake_case body.
 *
 * Only what was set is sent. The API rejects unknown fields, and an explicit
 * null would be indistinguishable from "no limit" on endpoints where that
 * distinction decides whether spending stops.
 */
function controlsToBody(c: KeyControls): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (c.spendLimitUsd !== undefined) body.spend_limit_usd = c.spendLimitUsd;
  if (c.alertAtPercent !== undefined) body.alert_at_percent = c.alertAtPercent;
  if (c.allowedModels !== undefined) body.allowed_models = c.allowedModels;
  if (c.allowedProviders !== undefined) body.allowed_providers = c.allowedProviders;
  if (c.rateLimitPerMin !== undefined) body.rate_limit_per_min = c.rateLimitPerMin;
  if (c.budgetPoolId !== undefined) body.budget_pool_id = c.budgetPoolId;
  return body;
}

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
      ...controlsToBody(options),
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
    const body: Record<string, unknown> = controlsToBody(changes);
    if (changes.name !== undefined) body.name = changes.name;
    if (changes.isActive !== undefined) body.is_active = changes.isActive;
    // Only send the flags that were actually asked for. Sending them all as
    // false is harmless today but makes the request lie about its intent.
    if (changes.clearSpendLimit) body.clear_spend_limit = true;
    if (changes.clearAlert) body.clear_alert = true;
    if (changes.clearScope) body.clear_scope = true;
    if (changes.clearRateLimit) body.clear_rate_limit = true;
    if (changes.clearBudgetPool) body.clear_budget_pool = true;
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


  /**
   * Download a key's full request history for auditing.
   *
   * Returns the raw text rather than parsed rows, because the usual destination
   * is a file or a spreadsheet.
   */
  async exportKeyUsage(keyId: string, format: "csv" | "json" = "csv"): Promise<string> {
    const response = await fetch(
      `${this.baseUrl}/api/keys/${keyId}/usage/export?format=${format}`,
      { headers: this._headers() },
    );
    if (!response.ok) await this._handleError(response);
    return response.text();
  }

  // ── Shared budgets ──────────────────────────────────────────────────────
  // A budget several keys draw on together, so a team or an environment has one
  // ceiling regardless of how many keys are handed out inside it.

  /**
   * Create a shared budget.
   *
   * Attach keys with `createKey({ name, budgetPoolId: budget.id })`. A budget
   * with no limit only groups keys and reports what they spent.
   */
  async createBudget(name: string, spendLimitUsd?: number): Promise<BudgetPool> {
    return this._request("POST", "/api/budgets", {
      name, ...(spendLimitUsd !== undefined ? { spend_limit_usd: spendLimitUsd } : {}),
    }) as Promise<BudgetPool>;
  }

  /** List your shared budgets, each with its limit, spend and key count. */
  async listBudgets(): Promise<BudgetPool[]> {
    return this._request("GET", "/api/budgets") as Promise<BudgetPool[]>;
  }

  /** Rename a shared budget or change its limit. Removal needs the flag. */
  async updateBudget(
    budgetId: string,
    changes: { name?: string; spendLimitUsd?: number; clearSpendLimit?: boolean },
  ): Promise<BudgetPool> {
    const body: Record<string, unknown> = {};
    if (changes.name !== undefined) body.name = changes.name;
    if (changes.spendLimitUsd !== undefined) body.spend_limit_usd = changes.spendLimitUsd;
    if (changes.clearSpendLimit) body.clear_spend_limit = true;
    return this._request("PATCH", `/api/budgets/${budgetId}`, body) as Promise<BudgetPool>;
  }

  /**
   * Zero a shared budget's counter, giving every key on it room again.
   *
   * Refunds nothing: that money already left the account balance.
   */
  async resetBudget(budgetId: string): Promise<BudgetPool> {
    return this._request("POST", `/api/budgets/${budgetId}/reset`) as Promise<BudgetPool>;
  }

  /**
   * Delete a shared budget.
   *
   * Keys attached to it keep working and fall back to their own caps.
   */
  async deleteBudget(budgetId: string): Promise<void> {
    await this._request("DELETE", `/api/budgets/${budgetId}`);
  }

  // ── Webhooks ────────────────────────────────────────────────────────────

  /**
   * Register an https endpoint for limit events.
   *
   * The signing secret is on `.secret` of the result and is shown exactly once.
   * Store it now; verifying deliveries is impossible without it.
   */
  async createWebhook(url: string, events: string[]): Promise<Webhook> {
    return this._request("POST", "/api/webhooks", { url, events }) as Promise<Webhook>;
  }

  /** List your webhooks, with the outcome of the last delivery to each. */
  async listWebhooks(): Promise<Webhook[]> {
    return this._request("GET", "/api/webhooks") as Promise<Webhook[]>;
  }

  /** The event names a webhook can subscribe to. */
  async webhookEvents(): Promise<string[]> {
    return this._request("GET", "/api/webhooks/events") as Promise<string[]>;
  }

  /**
   * Send a signed test delivery and report what the endpoint answered.
   *
   * Waits for the delivery rather than queueing it, so the result tells you
   * whether your signature check works before a real limit is reached.
   */
  async testWebhook(webhookId: string): Promise<{
    url: string; delivered: boolean; status_code: number | null; error: string | null;
  }> {
    return this._request("POST", `/api/webhooks/${webhookId}/test`) as Promise<any>;
  }

  /** Remove a webhook. Deliveries stop and the secret is discarded. */
  async deleteWebhook(webhookId: string): Promise<void> {
    await this._request("DELETE", `/api/webhooks/${webhookId}`);
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
    // DELETE answers 204 with no body, and json() on an empty one rejects.
    // Every delete in this client went through here, so all of them failed on
    // success.
    if (response.status === 204) return {};
    const text = await response.text();
    return text ? JSON.parse(text) : {};
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
    let data: any = {};
    try { data = await response.json(); } catch { /* empty or non-JSON body */ }

    // The gateway answers with {error: {code, message, details}}. Reading only
    // `detail` and `message` missed that shape entirely and handed the caller a
    // stringified blob with a code invented from the status.
    const error = data && typeof data.error === "object" ? data.error : null;
    let code = "unknown";
    let message = "Unknown error";
    let details: Record<string, any> = {};

    if (error) {
      code = error.code ?? "unknown";
      message = error.message ?? message;
      details = error.details ?? {};
    } else if (Array.isArray(data?.detail)) {
      // A validation error from FastAPI.
      code = "validation_error";
      message = data.detail
        .map((d: any) => `${(d.loc ?? []).slice(1).join(".")}: ${d.msg ?? ""}`)
        .join("; ");
    } else if (typeof data?.detail === "string") {
      message = data.detail;
    } else if (data && Object.keys(data).length) {
      message = JSON.stringify(data);
    }

    const status = response.status;
    // The code decides first: a spent key and an empty account are both 402.
    const Specific = ERROR_CODES[code];
    if (Specific) throw new Specific(code, message, status, details);

    const byStatus: Record<number, typeof SilkLLMError> = {
      401: AuthenticationError, 402: InsufficientBalanceError,
      404: ModelNotFoundError, 429: RateLimitError, 502: ProviderError,
    };
    const Cls = byStatus[status] ?? SilkLLMError;
    throw new Cls(code, message, status, details);
  }
}

export default SilkLLM;

// EOF silkllm-sdks/packages/javascript/src/client.ts
