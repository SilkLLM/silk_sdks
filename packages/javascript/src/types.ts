/**
 * types.ts + index.ts
 * TypeScript types and public exports for the SilkLLM JS SDK.
 */

// File: silkllm-sdks/packages/javascript/src/types.ts

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
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

// EOF silkllm-sdks/packages/javascript/src/types.ts
