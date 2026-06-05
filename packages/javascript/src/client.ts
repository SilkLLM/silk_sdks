/**
 * client.ts
 * SilkLLM JavaScript/TypeScript SDK.
 * Works in Node.js and modern browsers.
 */

// File: silkllm-sdks/packages/javascript/src/client.ts

import type {
  GenerateOptions, GenerateResponse, StreamChunk,
  ModelsResponse, BalanceResponse, UsageResponse,
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
   * Create a SilkLLM client.
   * @param options.apiKey  Your silk_ API key (or set SILKLLM_API_KEY env var in Node)
   * @param options.baseUrl Override for self-hosted deployments (default: https://api.silkllm.com)
   */
  constructor(options: { apiKey?: string; baseUrl?: string } = {}) {
    this.apiKey = options.apiKey
      || (typeof process !== "undefined" ? process.env.SILKLLM_API_KEY || "" : "");
    if (!this.apiKey) throw new AuthenticationError("auth_error", "No API key provided.");
    this.baseUrl = (options.baseUrl || "https://api.silkllm.com").replace(/\/$/, "");
  }

  /**
   * Generate a completion (non-streaming).
   * @example
   * const res = await client.generate({ messages: [{ role: "user", content: "Hi!" }] });
   * console.log(res.content);
   */
  async generate(options: GenerateOptions): Promise<GenerateResponse> {
    const body = { ...options, stream: false };
    const data = await this._request("POST", "/api/generate", body);
    return data as GenerateResponse;
  }

  /**
   * Generate a streaming completion.
   * Returns an async iterable of string chunks.
   * @example
   * for await (const chunk of client.stream({ messages: [...] })) {
   *   process.stdout.write(chunk);
   * }
   */
  async *stream(options: GenerateOptions): AsyncGenerator<string> {
    const body = { ...options, stream: true };
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: this._headers(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      await this._handleError(response);
    }

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

  /** List all available models. */
  async models(provider?: string): Promise<ModelsResponse> {
    const params = provider ? `?provider=${provider}` : "";
    return this._request("GET", `/api/models${params}`) as Promise<ModelsResponse>;
  }

  /** Get your current credit balance. */
  async balance(): Promise<BalanceResponse> {
    return this._request("GET", "/api/balance") as Promise<BalanceResponse>;
  }

  /** Get usage history. */
  async usage(page = 1, pageSize = 20): Promise<UsageResponse> {
    return this._request("GET", `/api/usage?page=${page}&page_size=${pageSize}`) as Promise<UsageResponse>;
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
    let code = "unknown", message = "Unknown error";
    try {
      const data = await response.json();
      code = data.error?.code || "unknown";
      message = data.error?.message || message;
    } catch {}

    if (response.status === 401) throw new AuthenticationError(code, message);
    if (response.status === 402) throw new InsufficientBalanceError(code, message);
    if (response.status === 404) throw new ModelNotFoundError(code, message);
    if (response.status === 429) throw new RateLimitError(code, message);
    if (response.status === 502) throw new ProviderError(code, message);
    throw new SilkLLMError(code, message);
  }
}

export default SilkLLM;

// EOF silkllm-sdks/packages/javascript/src/client.ts
