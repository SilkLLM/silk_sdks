var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  AuthenticationError: () => AuthenticationError,
  InsufficientBalanceError: () => InsufficientBalanceError,
  ModelNotFoundError: () => ModelNotFoundError,
  ProviderError: () => ProviderError,
  RateLimitError: () => RateLimitError,
  SilkLLM: () => SilkLLM,
  SilkLLMError: () => SilkLLMError,
  audioPart: () => audioPart,
  default: () => SilkLLM,
  imagePart: () => imagePart,
  textPart: () => textPart
});
module.exports = __toCommonJS(index_exports);

// src/client.ts
function textPart(text) {
  return { type: "text", text };
}
function imagePart(url) {
  return { type: "image_url", image_url: { url } };
}
function audioPart(data, format = "wav") {
  return { type: "input_audio", input_audio: { data, format } };
}
var SilkLLMError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "SilkLLMError";
  }
  code;
};
var AuthenticationError = class extends SilkLLMError {
};
var InsufficientBalanceError = class extends SilkLLMError {
};
var ModelNotFoundError = class extends SilkLLMError {
};
var RateLimitError = class extends SilkLLMError {
};
var ProviderError = class extends SilkLLMError {
};
var SilkLLM = class {
  apiKey;
  baseUrl;
  /**
   * @param options.apiKey   Your silk_ API key (or SILKLLM_API_KEY env var)
   * @param options.baseUrl  For self-hosted, e.g. "http://localhost:8000" (no trailing slash, no /api)
   */
  constructor(options = {}) {
    this.apiKey = options.apiKey || (typeof process !== "undefined" ? process.env.SILKLLM_API_KEY || "" : "");
    if (!this.apiKey) throw new AuthenticationError("auth_error", "No API key provided.");
    this.baseUrl = (options.baseUrl || process.env.SILKLLM_BASE_URL || "https://silkllm.onrender.com").replace(/\/$/, "");
  }
  async generate(options) {
    const body = { ...options, stream: false };
    return this._request("POST", "/api/generate", body);
  }
  async *stream(options) {
    const body = { ...options, stream: true };
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: this._headers(),
      body: JSON.stringify(body)
    });
    if (!response.ok) await this._handleError(response);
    const reader = response.body.getReader();
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
          } catch {
          }
        }
      }
    }
  }
  async models(provider) {
    const params = provider ? `?provider=${provider}` : "";
    return this._request("GET", `/api/models${params}`);
  }
  async balance() {
    return this._request("GET", "/api/balance");
  }
  async usage(page = 1, pageSize = 20) {
    return this._request("GET", `/api/usage?page=${page}&page_size=${pageSize}`);
  }
  /** Get your free-trial status (daily allowance, remaining today, end date). */
  async trialStatus() {
    return this._request("GET", "/api/trial");
  }
  // ── Multimodal generation ──────────────────────────────────────────────────
  /** Generate one or more images from a text prompt. */
  async generateImage(options) {
    return this._request("POST", "/api/generate/image", options);
  }
  /**
   * Generate speech audio (base64) from text.
   * For OpenAI TTS, `voice` is a name (alloy, echo, fable, onyx, nova, shimmer).
   * For ElevenLabs, `voice` is a voice_id from `listVoices()` and `voice_settings`
   * (stability, similarity_boost, style, use_speaker_boost) shape the delivery.
   */
  async generateAudio(options) {
    return this._request("POST", "/api/generate/audio", options);
  }
  /** List the speakers available from a voice provider (ElevenLabs). */
  async listVoices(provider = "elevenlabs") {
    return this._request("GET", `/api/generate/audio/voices?provider=${encodeURIComponent(provider)}`);
  }
  /** Generate a short video from a text prompt (where a provider supports it). */
  async generateVideo(options) {
    return this._request("POST", "/api/generate/video", options);
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
  async depositProviderKey(options) {
    const body = {
      provider_id: options.providerId,
      api_key: options.apiKey,
      label: options.label ?? "My key",
      is_public: options.isPublic ?? false,
      is_free_key: options.isFreeKey ?? false,
      serve_owner_with_own_key: options.serveOwnerWithOwnKey ?? true,
      declared_budget_usd: options.declaredBudgetUsd ?? 0,
      ...options.dailyLimitUsd !== void 0 ? { daily_limit_usd: options.dailyLimitUsd } : {}
    };
    return this._request("POST", "/api/provider-keys", body);
  }
  /** List your deposited provider keys with earnings and requests served. */
  async listProviderKeys() {
    return this._request("GET", "/api/provider-keys");
  }
  /** Update a deposited key (visibility, limits, budget, serve preference, label). */
  async updateProviderKey(keyId, changes) {
    return this._request("PATCH", `/api/provider-keys/${keyId}`, changes);
  }
  /** Revoke a deposited key so it stops being used immediately. */
  async revokeProviderKey(keyId) {
    const response = await fetch(`${this.baseUrl}/api/provider-keys/${keyId}`, {
      method: "DELETE",
      headers: this._headers()
    });
    if (!response.ok) await this._handleError(response);
  }
  _headers() {
    return {
      "Authorization": `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "silkllm-js/1.0.0"
    };
  }
  async _request(method, path, body) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: this._headers(),
      body: body ? JSON.stringify(body) : void 0
    });
    if (!response.ok) await this._handleError(response);
    return response.json();
  }
  async _handleError(response) {
    let detail = "Unknown error";
    try {
      const data = await response.json();
      detail = data.detail || data.message || JSON.stringify(data);
    } catch {
    }
    const status = response.status;
    if (status === 401) throw new AuthenticationError("auth_error", detail);
    if (status === 402) throw new InsufficientBalanceError("insufficient_balance", detail);
    if (status === 404) throw new ModelNotFoundError("model_not_found", detail);
    if (status === 429) throw new RateLimitError("rate_limit", detail);
    if (status === 502) throw new ProviderError("provider_error", detail);
    throw new SilkLLMError("unknown", detail);
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AuthenticationError,
  InsufficientBalanceError,
  ModelNotFoundError,
  ProviderError,
  RateLimitError,
  SilkLLM,
  SilkLLMError,
  audioPart,
  imagePart,
  textPart
});
