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
  DEFAULT_BASE_URL: () => DEFAULT_BASE_URL,
  InsufficientBalanceError: () => InsufficientBalanceError,
  KeyLimitExceeded: () => KeyLimitExceeded,
  KeyRateLimited: () => KeyRateLimited,
  KeyScopeError: () => KeyScopeError,
  ModelNotFoundError: () => ModelNotFoundError,
  PoolLimitExceeded: () => PoolLimitExceeded,
  ProviderError: () => ProviderError,
  RateLimitError: () => RateLimitError,
  SIGNATURE_HEADER: () => SIGNATURE_HEADER,
  SilkLLM: () => SilkLLM,
  SilkLLMError: () => SilkLLMError,
  TIMESTAMP_HEADER: () => TIMESTAMP_HEADER,
  audioPart: () => audioPart,
  default: () => SilkLLM,
  imagePart: () => imagePart,
  resolveBaseUrl: () => resolveBaseUrl,
  sign: () => sign,
  textPart: () => textPart,
  verifyWebhook: () => verifyWebhook
});
module.exports = __toCommonJS(index_exports);

// src/endpoint.ts
var DEFAULT_BASE_URL = "https://silkllm-backend.169.58.53.167.nip.io";
function resolveBaseUrl(explicit) {
  var _a;
  const fromEnv = typeof process !== "undefined" ? (_a = process.env) == null ? void 0 : _a.SILKLLM_BASE_URL : void 0;
  return (explicit || fromEnv || DEFAULT_BASE_URL).replace(/\/$/, "");
}

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
function toBlob(input, contentType = "audio/mpeg") {
  if (input instanceof Blob) return input;
  return new Blob([input], { type: contentType });
}
var SilkLLMError = class extends Error {
  constructor(code, message, statusCode, details = {}) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.name = new.target.name;
  }
  code;
  statusCode;
  details;
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
var KeyLimitExceeded = class extends SilkLLMError {
};
var PoolLimitExceeded = class extends SilkLLMError {
};
var KeyScopeError = class extends SilkLLMError {
};
var KeyRateLimited = class extends SilkLLMError {
};
var ERROR_CODES = {
  key_limit_exceeded: KeyLimitExceeded,
  pool_limit_exceeded: PoolLimitExceeded,
  key_scope_denied: KeyScopeError,
  key_rate_limited: KeyRateLimited,
  insufficient_balance: InsufficientBalanceError
};
function controlsToBody(c) {
  const body = {};
  if (c.spendLimitUsd !== void 0) body.spend_limit_usd = c.spendLimitUsd;
  if (c.alertAtPercent !== void 0) body.alert_at_percent = c.alertAtPercent;
  if (c.allowedModels !== void 0) body.allowed_models = c.allowedModels;
  if (c.allowedProviders !== void 0) body.allowed_providers = c.allowedProviders;
  if (c.rateLimitPerMin !== void 0) body.rate_limit_per_min = c.rateLimitPerMin;
  if (c.budgetPoolId !== void 0) body.budget_pool_id = c.budgetPoolId;
  return body;
}
var SilkLLM = class {
  apiKey;
  baseUrl;
  /**
   * You do not configure a server address. The SDK knows where SilkLLM is.
   *
   * @param options.apiKey   Your silk_ API key (or SILKLLM_API_KEY env var)
   * @param options.baseUrl  Advanced, and normally omitted. Point the SDK at a
   *                         self-hosted or local backend, e.g. "http://localhost:8000"
   *                         (no trailing slash, no /api).
   */
  constructor(options = {}) {
    this.apiKey = options.apiKey || (typeof process !== "undefined" ? process.env.SILKLLM_API_KEY || "" : "");
    if (!this.apiKey) throw new AuthenticationError("auth_error", "No API key provided.");
    this.baseUrl = resolveBaseUrl(options.baseUrl);
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
  /**
   * Voice conversion (speech-to-speech): convert a source audio clip into the
   * same speech spoken by `voice` (an ElevenLabs voice_id, possibly cloned).
   */
  async speechToSpeech(options) {
    const form = new FormData();
    form.append("audio", toBlob(options.audio, options.contentType), options.filename || "input.mp3");
    form.append("voice", options.voice);
    if (options.model) form.append("model", options.model);
    if (options.output_format) form.append("output_format", options.output_format);
    form.append("seconds", String(options.seconds ?? 10));
    const vs = options.voice_settings;
    if (vs) {
      for (const k of ["stability", "similarity_boost", "style"]) {
        if (vs[k] != null) form.append(k, String(vs[k]));
      }
      if (vs.use_speaker_boost != null) form.append("use_speaker_boost", String(vs.use_speaker_boost));
    }
    return this._requestForm("POST", "/api/generate/audio/speech-to-speech", form);
  }
  /** Create an instant voice clone from audio samples; returns the new voice_id. */
  async cloneVoice(options) {
    const form = new FormData();
    form.append("name", options.name);
    if (options.description) form.append("description", options.description);
    options.samples.forEach((s, i) => form.append("files", toBlob(s), `sample_${i}.mp3`));
    return this._requestForm("POST", "/api/generate/audio/clone-voice", form);
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
  async createKey(options) {
    return this._request("POST", "/api/keys", {
      name: options.name,
      ...controlsToBody(options)
    });
  }
  /** List your API keys, each with its cap, spend and remaining budget. */
  async listKeys() {
    return this._request("GET", "/api/keys");
  }
  /**
   * Rename a key, change its cap, or disable it.
   *
   * Raising the cap on an exhausted key makes it work again immediately without
   * clearing what it has already spent. Pass `clearSpendLimit` to remove the cap
   * entirely; omitting `spendLimitUsd` means "leave it as it is", which is why
   * removal needs its own flag.
   */
  async updateKey(keyId, changes) {
    const body = controlsToBody(changes);
    if (changes.name !== void 0) body.name = changes.name;
    if (changes.isActive !== void 0) body.is_active = changes.isActive;
    if (changes.clearSpendLimit) body.clear_spend_limit = true;
    if (changes.clearAlert) body.clear_alert = true;
    if (changes.clearScope) body.clear_scope = true;
    if (changes.clearRateLimit) body.clear_rate_limit = true;
    if (changes.clearBudgetPool) body.clear_budget_pool = true;
    return this._request("PATCH", `/api/keys/${keyId}`, body);
  }
  /** Revoke a key. It stops authenticating at once; its history is kept. */
  async revokeKey(keyId) {
    await this._request("DELETE", `/api/keys/${keyId}`);
  }
  /**
   * A key's request history, newest first, with lifetime totals.
   *
   * `status` filters the page only. The totals always cover the whole history,
   * so filtering never changes what the key appears to have spent.
   */
  async keyUsage(keyId, options = {}) {
    const q = new URLSearchParams({
      page: String(options.page ?? 1),
      page_size: String(options.pageSize ?? 50)
    });
    if (options.status) q.set("status", options.status);
    return this._request("GET", `/api/keys/${keyId}/usage?${q}`);
  }
  /**
   * Zero a key's spend counter, restoring its full budget.
   *
   * Refunds nothing: the money already left the account balance. It clears only
   * the counter the cap is measured against, and leaves the history untouched.
   */
  async resetKeyUsage(keyId) {
    return this._request("POST", `/api/keys/${keyId}/reset`);
  }
  /**
   * Delete a revoked key and its activity log for good.
   *
   * Two steps on purpose. `revokeKey()` stops the key but keeps its history,
   * because a key that stopped and left no trace cannot be investigated. This is
   * the second step, and it only works on a key that is already revoked.
   *
   * The account ledger is untouched: that is the record of money that moved, and
   * deleting a key must not put a hole in the books.
   */
  async deleteKey(keyId) {
    await this._request("DELETE", `/api/keys/${keyId}/permanent`);
  }
  /**
   * Balance, how much of it limits already promise, and what is left.
   *
   * A spend limit sets aside part of the one account balance for one key, so
   * limits compete: the sum of the unspent parts cannot exceed the balance.
   */
  async allocation() {
    return this._request("GET", "/api/keys/allocation");
  }
  // ── Promotions ──────────────────────────────────────────────────────────
  // A promotion discounts SilkLLM's own fee, the margin added on top of what a
  // request costs to serve. It never touches your credit balance and never
  // touches the provider's cost.
  /**
   * Redeem a promo code on this account.
   *
   * One redemption per account. The result describes what was granted,
   * including a plain-English `summary` to show the customer.
   */
  async redeemPromo(code) {
    return this._request("POST", "/api/promotions/redeem", { code });
  }
  /** Every promotion on this account, live and expired, newest first. */
  async promotions() {
    return this._request("GET", "/api/promotions");
  }
  /**
   * The discount currently being applied, or null.
   *
   * Discounts do not stack: holding more than one means the most generous
   * applies, and this is the one that will come off the next request.
   */
  async activePromotion() {
    return this._request("GET", "/api/promotions/active");
  }
  /**
   * Download a key's full request history for auditing.
   *
   * Returns the raw text rather than parsed rows, because the usual destination
   * is a file or a spreadsheet.
   */
  async exportKeyUsage(keyId, format = "csv") {
    const response = await fetch(
      `${this.baseUrl}/api/keys/${keyId}/usage/export?format=${format}`,
      { headers: this._headers() }
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
  async createBudget(name, spendLimitUsd) {
    return this._request("POST", "/api/budgets", {
      name,
      ...spendLimitUsd !== void 0 ? { spend_limit_usd: spendLimitUsd } : {}
    });
  }
  /** List your shared budgets, each with its limit, spend and key count. */
  async listBudgets() {
    return this._request("GET", "/api/budgets");
  }
  /** Rename a shared budget or change its limit. Removal needs the flag. */
  async updateBudget(budgetId, changes) {
    const body = {};
    if (changes.name !== void 0) body.name = changes.name;
    if (changes.spendLimitUsd !== void 0) body.spend_limit_usd = changes.spendLimitUsd;
    if (changes.clearSpendLimit) body.clear_spend_limit = true;
    return this._request("PATCH", `/api/budgets/${budgetId}`, body);
  }
  /**
   * Zero a shared budget's counter, giving every key on it room again.
   *
   * Refunds nothing: that money already left the account balance.
   */
  async resetBudget(budgetId) {
    return this._request("POST", `/api/budgets/${budgetId}/reset`);
  }
  /**
   * Delete a shared budget.
   *
   * Keys attached to it keep working and fall back to their own caps.
   */
  async deleteBudget(budgetId) {
    await this._request("DELETE", `/api/budgets/${budgetId}`);
  }
  // ── Webhooks ────────────────────────────────────────────────────────────
  /**
   * Register an https endpoint for limit events.
   *
   * The signing secret is on `.secret` of the result and is shown exactly once.
   * Store it now; verifying deliveries is impossible without it.
   */
  async createWebhook(url, events) {
    return this._request("POST", "/api/webhooks", { url, events });
  }
  /** List your webhooks, with the outcome of the last delivery to each. */
  async listWebhooks() {
    return this._request("GET", "/api/webhooks");
  }
  /** The event names a webhook can subscribe to. */
  async webhookEvents() {
    return this._request("GET", "/api/webhooks/events");
  }
  /**
   * Send a signed test delivery and report what the endpoint answered.
   *
   * Waits for the delivery rather than queueing it, so the result tells you
   * whether your signature check works before a real limit is reached.
   */
  async testWebhook(webhookId) {
    return this._request("POST", `/api/webhooks/${webhookId}/test`);
  }
  /** Remove a webhook. Deliveries stop and the secret is discarded. */
  async deleteWebhook(webhookId) {
    await this._request("DELETE", `/api/webhooks/${webhookId}`);
  }
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
    if (response.status === 204) return {};
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  }
  /** Multipart request (file uploads). No Content-Type header: fetch sets the boundary. */
  async _requestForm(method, path, form) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { "Authorization": `Bearer ${this.apiKey}`, "User-Agent": "silkllm-js/1.0.0" },
      body: form
    });
    if (!response.ok) await this._handleError(response);
    return response.json();
  }
  async _handleError(response) {
    let data = {};
    try {
      data = await response.json();
    } catch {
    }
    const error = data && typeof data.error === "object" ? data.error : null;
    let code = "unknown";
    let message = "Unknown error";
    let details = {};
    if (error) {
      code = error.code ?? "unknown";
      message = error.message ?? message;
      details = error.details ?? {};
    } else if (Array.isArray(data == null ? void 0 : data.detail)) {
      code = "validation_error";
      message = data.detail.map((d) => `${(d.loc ?? []).slice(1).join(".")}: ${d.msg ?? ""}`).join("; ");
    } else if (typeof (data == null ? void 0 : data.detail) === "string") {
      message = data.detail;
    } else if (data && Object.keys(data).length) {
      message = JSON.stringify(data);
    }
    const status = response.status;
    const Specific = ERROR_CODES[code];
    if (Specific) throw new Specific(code, message, status, details);
    const byStatus = {
      401: AuthenticationError,
      402: InsufficientBalanceError,
      404: ModelNotFoundError,
      429: RateLimitError,
      502: ProviderError
    };
    const Cls = byStatus[status] ?? SilkLLMError;
    throw new Cls(code, message, status, details);
  }
};

// src/webhooks.ts
var SIGNATURE_HEADER = "X-Silk-Signature";
var TIMESTAMP_HEADER = "X-Silk-Timestamp";
function toBytes(body) {
  if (typeof body === "string") return new TextEncoder().encode(body);
  if (body instanceof Uint8Array) return body;
  return new Uint8Array(body);
}
async function sign(secret, body) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, toBytes(body));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `sha256=${hex}`;
}
async function verifyWebhook(secret, body, signature) {
  if (!secret || !signature) return false;
  const expected = await sign(secret, body);
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AuthenticationError,
  DEFAULT_BASE_URL,
  InsufficientBalanceError,
  KeyLimitExceeded,
  KeyRateLimited,
  KeyScopeError,
  ModelNotFoundError,
  PoolLimitExceeded,
  ProviderError,
  RateLimitError,
  SIGNATURE_HEADER,
  SilkLLM,
  SilkLLMError,
  TIMESTAMP_HEADER,
  audioPart,
  imagePart,
  resolveBaseUrl,
  sign,
  textPart,
  verifyWebhook
});
