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

// EOF silkllm-sdks/packages/javascript/src/types.ts
