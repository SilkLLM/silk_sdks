/**
 * types.ts + index.ts
 * TypeScript types and public exports for the SilkLLM JS SDK.
 */

// File: silkllm-sdks/packages/javascript/src/types.ts

/** A multimodal content part (vision or audio input). */
export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "input_audio"; input_audio: { data: string; format: string } };

export interface Message {
  role: "user" | "assistant" | "system";
  // Plain text, or a list of multimodal parts (see textPart/imagePart/audioPart).
  content: string | ContentPart[];
}

export interface GenerateOptions {
  messages: Message[];
  model?: string;
  provider?: string;
  temperature?: number;
  max_tokens?: number;
}

export interface UsageInfo {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface GenerateResponse {
  content: string;
  model: string;
  provider: string;
  usage: UsageInfo;
  cost_usd: number;
  balance_after: number;
}

export interface StreamChunk {
  content: string;
}

export interface ModelInfo {
  id: string;
  display_name: string;
  provider: string;
  input_cost_per_1k_usd: number;
  output_cost_per_1k_usd: number;
  context_window: number;
  capabilities: string[];
  modality?: string;   // text | image | audio | video
  is_free?: boolean;
}

export interface ImageResult {
  images: (string | null)[];
  count: number;
  model: string;
  provider: string;
  modality: string;
  cost_usd: number;
  balance_after: number;
}

export interface AudioResult {
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
export interface VoiceSettings {
  stability?: number;
  similarity_boost?: number;
  style?: number;
  use_speaker_boost?: boolean;
  speed?: number;
}

export interface Voice {
  voice_id: string;
  name?: string;
  category?: string;
  labels?: Record<string, unknown>;
  preview_url?: string | null;
}

export interface VoicesResponse {
  provider: string;
  voices: Voice[];
}

export type AudioInput = Blob | Uint8Array | ArrayBuffer;

export interface SpeechToSpeechOptions {
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

export interface CloneVoiceOptions {
  name: string;
  /** One or more clean audio samples. */
  samples: AudioInput[];
  description?: string;
}

export interface CloneVoiceResult {
  voice_id: string | null;
  name: string;
  requires_verification?: boolean;
}

export interface VideoResult {
  video_url: string | null;
  model: string;
  provider: string;
  modality: string;
  cost_usd: number;
  balance_after: number;
}

export interface ImageOptions { prompt: string; model?: string; provider?: string; n?: number; size?: string; }
export interface AudioOptions {
  prompt: string; model?: string; provider?: string; voice?: string;
  voice_settings?: VoiceSettings; output_format?: string;
}
export interface VideoOptions { prompt: string; model?: string; provider?: string; seconds?: number; }

export interface TrialStatus {
  active: boolean;
  tier: string;
  daily_limit_usd: number;
  daily_used_usd: number;
  daily_remaining_usd: number;
  expires_at?: string | null;
  days_remaining: number;
  lifetime_used_usd: number;
}

export interface ModelsResponse {
  models: ModelInfo[];
  total: number;
}

export interface BalanceResponse {
  balance_usd: number;
  currency: string;
}

export interface UsageEntry {
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

export interface UsageResponse {
  entries: UsageEntry[];
  total: number;
  page: number;
  page_size: number;
}

// ── BYOK marketplace ─────────────────────────────────────────────────────────

export interface ProviderKey {
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

export interface DepositProviderKeyOptions {
  providerId: string;
  apiKey: string;
  label?: string;
  isPublic?: boolean;
  isFreeKey?: boolean;
  serveOwnerWithOwnKey?: boolean;
  dailyLimitUsd?: number;
  declaredBudgetUsd?: number;
}

export interface UpdateProviderKeyOptions {
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
export interface ApiKey {
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
export interface KeyUsageEntry {
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
export interface KeyUsage {
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
export interface KeyControls {
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

export interface CreateKeyOptions extends KeyControls {
  name: string;
}

/**
 * Changes to an existing key.
 *
 * Removing a limit needs its own flag: an omitted field has to keep meaning
 * "leave this as it is", or a call that only renamed a key could never take a
 * limit off.
 */
export interface UpdateKeyOptions extends KeyControls {
  name?: string;
  isActive?: boolean;
  clearSpendLimit?: boolean;
  clearAlert?: boolean;
  clearScope?: boolean;
  clearRateLimit?: boolean;
  clearBudgetPool?: boolean;
}

/** A budget several keys draw on together. */
export interface BudgetPool {
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
export interface Webhook {
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

// EOF silkllm-sdks/packages/javascript/src/types.ts
