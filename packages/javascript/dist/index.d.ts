/**
 * types.ts + index.ts
 * TypeScript types and public exports for the SilkLLM JS SDK.
 */
interface Message {
    role: "user" | "assistant" | "system";
    content: string;
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

/**
 * client.ts
 * SilkLLM JavaScript/TypeScript SDK.
 * Works in Node.js (>=18) and modern browsers.
 */

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
    private _headers;
    private _request;
    private _handleError;
}

export { AuthenticationError, type BalanceResponse, type GenerateOptions, type GenerateResponse, InsufficientBalanceError, type Message, ModelNotFoundError, type ModelsResponse, ProviderError, RateLimitError, SilkLLM, SilkLLMError, type UsageResponse, SilkLLM as default };
