// src/client.ts
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
export {
  AuthenticationError,
  InsufficientBalanceError,
  ModelNotFoundError,
  ProviderError,
  RateLimitError,
  SilkLLM,
  SilkLLMError,
  SilkLLM as default
};
