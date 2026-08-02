/**
 * types.ts + index.ts
 * TypeScript types and public exports for the SilkLLM JS SDK.
 */
/** A multimodal content part (vision or audio input). */
type ContentPart = {
    type: "text";
    text: string;
} | {
    type: "image_url";
    image_url: {
        url: string;
    };
} | {
    type: "input_audio";
    input_audio: {
        data: string;
        format: string;
    };
};
interface Message {
    role: "user" | "assistant" | "system";
    content: string | ContentPart[];
}
interface GenerateOptions {
    messages: Message[];
    model?: string;
    provider?: string;
    temperature?: number;
    max_tokens?: number;
}
interface UsageInfo {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}
interface GenerateResponse {
    content: string;
    model: string;
    provider: string;
    usage: UsageInfo;
    cost_usd: number;
    balance_after: number;
}
interface ModelInfo {
    id: string;
    display_name: string;
    provider: string;
    input_cost_per_1k_usd: number;
    output_cost_per_1k_usd: number;
    context_window: number;
    capabilities: string[];
    modality?: string;
    is_free?: boolean;
}
interface ImageResult {
    images: (string | null)[];
    count: number;
    model: string;
    provider: string;
    modality: string;
    cost_usd: number;
    balance_after: number;
}
interface AudioResult {
    audio_b64: string;
    format: string;
    model: string;
    provider: string;
    modality: string;
    cost_usd: number;
    balance_after: number;
    voice?: string;
}
/**
 * ElevenLabs voice controls. Ignored by providers that do not support them
 * (for example OpenAI TTS). Pass only what you want to override.
 */
interface VoiceSettings {
    stability?: number;
    similarity_boost?: number;
    style?: number;
    use_speaker_boost?: boolean;
    speed?: number;
}
interface Voice {
    voice_id: string;
    name?: string;
    category?: string;
    labels?: Record<string, unknown>;
    preview_url?: string | null;
}
interface VoicesResponse {
    provider: string;
    voices: Voice[];
}
type AudioInput = Blob | Uint8Array | ArrayBuffer;
interface SpeechToSpeechOptions {
    /** Source audio clip to convert. */
    audio: AudioInput;
    /** Target ElevenLabs voice_id (may be a cloned voice). */
    voice: string;
    model?: string;
    output_format?: string;
    /** Approximate source duration in seconds (used for pricing). */
    seconds?: number;
    voice_settings?: VoiceSettings;
    filename?: string;
    contentType?: string;
}
interface CloneVoiceOptions {
    name: string;
    /** One or more clean audio samples. */
    samples: AudioInput[];
    description?: string;
}
interface CloneVoiceResult {
    voice_id: string | null;
    name: string;
    requires_verification?: boolean;
}
interface VideoResult {
    video_url: string | null;
    model: string;
    provider: string;
    modality: string;
    cost_usd: number;
    balance_after: number;
}
interface ImageOptions {
    prompt: string;
    model?: string;
    provider?: string;
    n?: number;
    size?: string;
}
interface AudioOptions {
    prompt: string;
    model?: string;
    provider?: string;
    voice?: string;
    voice_settings?: VoiceSettings;
    output_format?: string;
}
interface VideoOptions {
    prompt: string;
    model?: string;
    provider?: string;
    seconds?: number;
}
interface TrialStatus {
    active: boolean;
    tier: string;
    daily_limit_usd: number;
    daily_used_usd: number;
    daily_remaining_usd: number;
    expires_at?: string | null;
    days_remaining: number;
    lifetime_used_usd: number;
}
interface ModelsResponse {
    models: ModelInfo[];
    total: number;
}
interface BalanceResponse {
    balance_usd: number;
    currency: string;
}
interface UsageEntry {
    id: string;
    entry_type: string;
    amount: number;
    balance_after: number;
    model?: string;
    provider?: string;
    prompt_tokens?: number;
    completion_tokens?: number;
    created_at: string;
}
interface UsageResponse {
    entries: UsageEntry[];
    total: number;
    page: number;
    page_size: number;
}
interface ProviderKey {
    id: string;
    provider_id: string;
    label: string;
    is_public: boolean;
    is_free_key: boolean;
    serve_owner_with_own_key: boolean;
    daily_limit_usd: number;
    declared_budget_usd: number;
    consumed_usd_total: number;
    status: string;
    success_count: number;
    failure_count: number;
    created_at: string;
    last_used?: string | null;
    earned_credits_total: number;
    requests_served: number;
    provider_cost_served: number;
}
interface DepositProviderKeyOptions {
    providerId: string;
    apiKey: string;
    label?: string;
    isPublic?: boolean;
    isFreeKey?: boolean;
    serveOwnerWithOwnKey?: boolean;
    dailyLimitUsd?: number;
    declaredBudgetUsd?: number;
}
interface UpdateProviderKeyOptions {
    label?: string;
    is_public?: boolean;
    is_free_key?: boolean;
    serve_owner_with_own_key?: boolean;
    daily_limit_usd?: number;
    declared_budget_usd?: number;
}
/**
 * One of your SilkLLM API keys.
 *
 * `spend_limit_usd` caps how much of the account balance this key may draw.
 * null means uncapped. It is not a separate wallet: three keys capped at $10 do
 * not reserve $30, they each simply stop at $10 of spend.
 */
interface ApiKey {
    id: string;
    name: string;
    created_at: string;
    is_active: boolean;
    last_used: string | null;
    spend_limit_usd: number | null;
    spent_usd: number;
    /** Budget left, or null when the key is uncapped. */
    remaining_usd: number | null;
    /** True once a capped key has used its budget up and is refusing requests. */
    is_exhausted: boolean;
    limit_reset_at: string | null;
    /** Only present on the response that creates the key. Never retrievable again. */
    key?: string;
}
/**
 * One request attributed to an API key.
 *
 * Refused attempts appear here too, with a `status` other than "ok". A run of
 * "limit_exceeded" rows is what a key hitting its cap looks like.
 */
interface KeyUsageEntry {
    id: string;
    created_at: string;
    endpoint: string;
    status: "ok" | "limit_exceeded" | "insufficient_balance" | "provider_error" | string;
    cost_usd: number;
    prompt_tokens: number;
    completion_tokens: number;
    requested_model: string | null;
    served_model: string | null;
    provider_id: string | null;
    detail: string | null;
    latency_ms: number | null;
}
/** A page of a key's history, plus totals over its whole lifetime. */
interface KeyUsage {
    key_id: string;
    key_name: string;
    total: number;
    page: number;
    page_size: number;
    total_cost_usd: number;
    total_requests: number;
    total_prompt_tokens: number;
    total_completion_tokens: number;
    entries: KeyUsageEntry[];
}
/**
 * Limits a key can be created with. All optional: a key with none of them set
 * behaves exactly as keys always have.
 */
interface KeyControls {
    /** Cap on how much of your balance this key may spend. Omit for uncapped. */
    spendLimitUsd?: number;
    /** Notify once the key passes this share of its cap, e.g. 80. Needs a cap. */
    alertAtPercent?: number;
    /** Restrict the key to these model ids. Anything else is refused with 403. */
    allowedModels?: string[];
    /** The same restriction, by provider id. */
    allowedProviders?: string[];
    /** Requests-per-minute ceiling for this key alone. Exceeding it gives 429. */
    rateLimitPerMin?: number;
    /** Draw on a shared budget as well as this key's own cap. */
    budgetPoolId?: string;
}
interface CreateKeyOptions extends KeyControls {
    name: string;
}
/**
 * Changes to an existing key.
 *
 * Removing a limit needs its own flag: an omitted field has to keep meaning
 * "leave this as it is", or a call that only renamed a key could never take a
 * limit off.
 */
interface UpdateKeyOptions extends KeyControls {
    name?: string;
    isActive?: boolean;
    clearSpendLimit?: boolean;
    clearAlert?: boolean;
    clearScope?: boolean;
    clearRateLimit?: boolean;
    clearBudgetPool?: boolean;
}
/** A budget several keys draw on together. */
interface BudgetPool {
    id: string;
    name: string;
    /** null means the budget groups keys without stopping them. */
    spend_limit_usd: number | null;
    spent_usd: number;
    key_count?: number;
    created_at: string;
    limit_reset_at?: string | null;
}
/** An https endpoint notified when a limit is reached. */
interface Webhook {
    id: string;
    url: string;
    events: string[];
    is_active: boolean;
    /** Present only in the response that creates it. Never retrievable again. */
    secret?: string;
    last_status: number | null;
    last_error: string | null;
    last_delivery_at: string | null;
    consecutive_failures: number;
}

/**
 * client.ts
 * SilkLLM JavaScript/TypeScript SDK.
 * Works in Node.js (>=18) and modern browsers.
 */

/** A text part for a multimodal message. */
declare function textPart(text: string): ContentPart;
/** An image part; `url` may be an http(s) URL or a data: URI (base64). */
declare function imagePart(url: string): ContentPart;
/** An audio input part; `data` is base64 audio, `format` e.g. "wav" or "mp3". */
declare function audioPart(data: string, format?: string): ContentPart;
/**
 * Base error for everything this client throws.
 *
 * `code` is the part worth branching on. Several distinct situations share one
 * HTTP status, and telling them apart is the difference between raising a key's
 * limit and topping the account up.
 */
declare class SilkLLMError extends Error {
    code: string;
    statusCode?: number;
    /** The numbers behind the message, so nobody has to parse the sentence. */
    details: Record<string, any>;
    constructor(code: string, message: string, statusCode?: number, 
    /** The numbers behind the message, so nobody has to parse the sentence. */
    details?: Record<string, any>);
}
declare class AuthenticationError extends SilkLLMError {
}
declare class InsufficientBalanceError extends SilkLLMError {
}
declare class ModelNotFoundError extends SilkLLMError {
}
declare class RateLimitError extends SilkLLMError {
}
declare class ProviderError extends SilkLLMError {
}
/** The key making the request has reached its own spend limit. */
declare class KeyLimitExceeded extends SilkLLMError {
}
/** The shared budget this key draws on has been used up. */
declare class PoolLimitExceeded extends SilkLLMError {
}
/** The key is not allowed to use the model or provider requested. */
declare class KeyScopeError extends SilkLLMError {
}
/** The key exceeded its own requests-per-minute ceiling. Clears on its own. */
declare class KeyRateLimited extends SilkLLMError {
}
declare class SilkLLM {
    private apiKey;
    private baseUrl;
    /**
     * You do not configure a server address. The SDK knows where SilkLLM is.
     *
     * @param options.apiKey   Your silk_ API key (or SILKLLM_API_KEY env var)
     * @param options.baseUrl  Advanced, and normally omitted. Point the SDK at a
     *                         self-hosted or local backend, e.g. "http://localhost:8000"
     *                         (no trailing slash, no /api).
     */
    constructor(options?: {
        apiKey?: string;
        baseUrl?: string;
    });
    generate(options: GenerateOptions): Promise<GenerateResponse>;
    stream(options: GenerateOptions): AsyncGenerator<string>;
    models(provider?: string): Promise<ModelsResponse>;
    balance(): Promise<BalanceResponse>;
    usage(page?: number, pageSize?: number): Promise<UsageResponse>;
    /** Get your free-trial status (daily allowance, remaining today, end date). */
    trialStatus(): Promise<TrialStatus>;
    /** Generate one or more images from a text prompt. */
    generateImage(options: ImageOptions): Promise<ImageResult>;
    /**
     * Generate speech audio (base64) from text.
     * For OpenAI TTS, `voice` is a name (alloy, echo, fable, onyx, nova, shimmer).
     * For ElevenLabs, `voice` is a voice_id from `listVoices()` and `voice_settings`
     * (stability, similarity_boost, style, use_speaker_boost) shape the delivery.
     */
    generateAudio(options: AudioOptions): Promise<AudioResult>;
    /** List the speakers available from a voice provider (ElevenLabs). */
    listVoices(provider?: string): Promise<VoicesResponse>;
    /**
     * Voice conversion (speech-to-speech): convert a source audio clip into the
     * same speech spoken by `voice` (an ElevenLabs voice_id, possibly cloned).
     */
    speechToSpeech(options: SpeechToSpeechOptions): Promise<AudioResult>;
    /** Create an instant voice clone from audio samples; returns the new voice_id. */
    cloneVoice(options: CloneVoiceOptions): Promise<CloneVoiceResult>;
    /** Generate a short video from a text prompt (where a provider supports it). */
    generateVideo(options: VideoOptions): Promise<VideoResult>;
    /**
     * Deposit one of your own provider API keys.
     * A public key lets SilkLLM's algorithm serve other users with it (you earn
     * platform credits); it is never shown to other users. A private key serves
     * only you. Set serveOwnerWithOwnKey=false to be served as if you deposited
     * nothing while a public key still serves the marketplace. The secret is
     * encrypted at rest and never returned.
     */
    /**
     * Create an API key, optionally capped.
     *
     * The plaintext key is on `.key` of the result and is never retrievable
     * again, so store it now.
     *
     *   const key = await client.createKey({ name: "CI", spendLimitUsd: 5 });
     *   console.log(key.key); // the only time you will see this
     */
    createKey(options: CreateKeyOptions): Promise<ApiKey>;
    /** List your API keys, each with its cap, spend and remaining budget. */
    listKeys(): Promise<ApiKey[]>;
    /**
     * Rename a key, change its cap, or disable it.
     *
     * Raising the cap on an exhausted key makes it work again immediately without
     * clearing what it has already spent. Pass `clearSpendLimit` to remove the cap
     * entirely; omitting `spendLimitUsd` means "leave it as it is", which is why
     * removal needs its own flag.
     */
    updateKey(keyId: string, changes: UpdateKeyOptions): Promise<ApiKey>;
    /** Revoke a key. It stops authenticating at once; its history is kept. */
    revokeKey(keyId: string): Promise<void>;
    /**
     * A key's request history, newest first, with lifetime totals.
     *
     * `status` filters the page only. The totals always cover the whole history,
     * so filtering never changes what the key appears to have spent.
     */
    keyUsage(keyId: string, options?: {
        page?: number;
        pageSize?: number;
        status?: string;
    }): Promise<KeyUsage>;
    /**
     * Zero a key's spend counter, restoring its full budget.
     *
     * Refunds nothing: the money already left the account balance. It clears only
     * the counter the cap is measured against, and leaves the history untouched.
     */
    resetKeyUsage(keyId: string): Promise<{
        id: string;
        name: string;
        spent_usd: number;
        message: string;
    }>;
    /**
     * Download a key's full request history for auditing.
     *
     * Returns the raw text rather than parsed rows, because the usual destination
     * is a file or a spreadsheet.
     */
    exportKeyUsage(keyId: string, format?: "csv" | "json"): Promise<string>;
    /**
     * Create a shared budget.
     *
     * Attach keys with `createKey({ name, budgetPoolId: budget.id })`. A budget
     * with no limit only groups keys and reports what they spent.
     */
    createBudget(name: string, spendLimitUsd?: number): Promise<BudgetPool>;
    /** List your shared budgets, each with its limit, spend and key count. */
    listBudgets(): Promise<BudgetPool[]>;
    /** Rename a shared budget or change its limit. Removal needs the flag. */
    updateBudget(budgetId: string, changes: {
        name?: string;
        spendLimitUsd?: number;
        clearSpendLimit?: boolean;
    }): Promise<BudgetPool>;
    /**
     * Zero a shared budget's counter, giving every key on it room again.
     *
     * Refunds nothing: that money already left the account balance.
     */
    resetBudget(budgetId: string): Promise<BudgetPool>;
    /**
     * Delete a shared budget.
     *
     * Keys attached to it keep working and fall back to their own caps.
     */
    deleteBudget(budgetId: string): Promise<void>;
    /**
     * Register an https endpoint for limit events.
     *
     * The signing secret is on `.secret` of the result and is shown exactly once.
     * Store it now; verifying deliveries is impossible without it.
     */
    createWebhook(url: string, events: string[]): Promise<Webhook>;
    /** List your webhooks, with the outcome of the last delivery to each. */
    listWebhooks(): Promise<Webhook[]>;
    /** The event names a webhook can subscribe to. */
    webhookEvents(): Promise<string[]>;
    /**
     * Send a signed test delivery and report what the endpoint answered.
     *
     * Waits for the delivery rather than queueing it, so the result tells you
     * whether your signature check works before a real limit is reached.
     */
    testWebhook(webhookId: string): Promise<{
        url: string;
        delivered: boolean;
        status_code: number | null;
        error: string | null;
    }>;
    /** Remove a webhook. Deliveries stop and the secret is discarded. */
    deleteWebhook(webhookId: string): Promise<void>;
    depositProviderKey(options: DepositProviderKeyOptions): Promise<ProviderKey>;
    /** List your deposited provider keys with earnings and requests served. */
    listProviderKeys(): Promise<ProviderKey[]>;
    /** Update a deposited key (visibility, limits, budget, serve preference, label). */
    updateProviderKey(keyId: string, changes: UpdateProviderKeyOptions): Promise<ProviderKey>;
    /** Revoke a deposited key so it stops being used immediately. */
    revokeProviderKey(keyId: string): Promise<void>;
    private _headers;
    private _request;
    /** Multipart request (file uploads). No Content-Type header: fetch sets the boundary. */
    private _requestForm;
    private _handleError;
}

/**
 * webhooks.ts
 * Verifying an inbound webhook delivery.
 *
 * Deliberately free of any dependency on the client: the code that receives a
 * webhook is a request handler in your app, and it has a secret and some bytes,
 * not a configured SDK instance.
 *
 *   import { verifyWebhook } from "@silkllm/sdk";
 *
 *   app.post("/hooks/silkllm", express.raw({ type: "*./*" }), async (req, res) => {
 *     const ok = await verifyWebhook(SECRET, req.body, req.header("X-Silk-Signature"));
 *     if (!ok) return res.sendStatus(401);
 *     const event = JSON.parse(req.body.toString());
 *   });
 *
 * Note the raw body. Re-serialising a parsed object changes key order and
 * spacing, and the signature is over the exact bytes that were sent.
 */
/** The header carrying the signature over the request body. */
declare const SIGNATURE_HEADER = "X-Silk-Signature";
/** The header carrying the unix timestamp the delivery was sent at. */
declare const TIMESTAMP_HEADER = "X-Silk-Timestamp";
/** Produce the signature for a body, in the same form the header carries. */
declare function sign(secret: string, body: string | Uint8Array | ArrayBuffer): Promise<string>;
/**
 * Check that a delivery really came from SilkLLM.
 *
 * The comparison runs in constant time, so a rejection does not leak how much
 * of a forged signature was correct through how long it took to reject it.
 *
 * @param secret The signing secret shown once when the webhook was created.
 * @param body The exact bytes of the request body, not a re-serialised object.
 * @param signature The value of the X-Silk-Signature header.
 */
declare function verifyWebhook(secret: string, body: string | Uint8Array | ArrayBuffer, signature: string | null | undefined): Promise<boolean>;

/**
 * endpoint.ts
 * Where the SilkLLM API lives.
 *
 * This is the single place the JavaScript SDK records the service address.
 * Callers are not expected to know or supply it: `new SilkLLM({ apiKey })`
 * resolves the endpoint on its own, and if the service ever moves, only this
 * file changes.
 *
 * Resolution order:
 *   1. an explicit baseUrl option    (self-hosted or a private deployment)
 *   2. the SILKLLM_BASE_URL env var  (staging, local backend, CI)
 *   3. the managed service           (what nearly everyone uses)
 */
/**
 * The managed SilkLLM service. Note there is no "/api" suffix; the SDK appends
 * the path segments it needs.
 */
declare const DEFAULT_BASE_URL = "https://silkllm-backend.169.58.53.167.nip.io";
/** Return the base URL to talk to, without a trailing slash. */
declare function resolveBaseUrl(explicit?: string): string;

export { type ApiKey, type AudioInput, type AudioOptions, type AudioResult, AuthenticationError, type BalanceResponse, type BudgetPool, type CloneVoiceOptions, type CloneVoiceResult, type ContentPart, type CreateKeyOptions, DEFAULT_BASE_URL, type DepositProviderKeyOptions, type GenerateOptions, type GenerateResponse, type ImageOptions, type ImageResult, InsufficientBalanceError, type KeyControls, KeyLimitExceeded, KeyRateLimited, KeyScopeError, type KeyUsage, type KeyUsageEntry, type Message, ModelNotFoundError, type ModelsResponse, PoolLimitExceeded, ProviderError, type ProviderKey, RateLimitError, SIGNATURE_HEADER, SilkLLM, SilkLLMError, type SpeechToSpeechOptions, TIMESTAMP_HEADER, type TrialStatus, type UpdateKeyOptions, type UpdateProviderKeyOptions, type UsageResponse, type VideoOptions, type VideoResult, type Voice, type VoiceSettings, type VoicesResponse, type Webhook, audioPart, SilkLLM as default, imagePart, resolveBaseUrl, sign, textPart, verifyWebhook };
