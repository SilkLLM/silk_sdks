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
declare class SilkLLMError extends Error {
    code: string;
    constructor(code: string, message: string);
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
declare class SilkLLM {
    private apiKey;
    private baseUrl;
    /**
     * @param options.apiKey   Your silk_ API key (or SILKLLM_API_KEY env var)
     * @param options.baseUrl  For self-hosted, e.g. "http://localhost:8000" (no trailing slash, no /api)
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
    depositProviderKey(options: DepositProviderKeyOptions): Promise<ProviderKey>;
    /** List your deposited provider keys with earnings and requests served. */
    listProviderKeys(): Promise<ProviderKey[]>;
    /** Update a deposited key (visibility, limits, budget, serve preference, label). */
    updateProviderKey(keyId: string, changes: UpdateProviderKeyOptions): Promise<ProviderKey>;
    /** Revoke a deposited key so it stops being used immediately. */
    revokeProviderKey(keyId: string): Promise<void>;
    private _headers;
    private _request;
    private _handleError;
}

export { type AudioOptions, type AudioResult, AuthenticationError, type BalanceResponse, type ContentPart, type DepositProviderKeyOptions, type GenerateOptions, type GenerateResponse, type ImageOptions, type ImageResult, InsufficientBalanceError, type Message, ModelNotFoundError, type ModelsResponse, ProviderError, type ProviderKey, RateLimitError, SilkLLM, SilkLLMError, type TrialStatus, type UpdateProviderKeyOptions, type UsageResponse, type VideoOptions, type VideoResult, type Voice, type VoiceSettings, type VoicesResponse, audioPart, SilkLLM as default, imagePart, textPart };
