const axios = require('axios');
const config = require('./config');

/**
 * Base Model Client with retry logic and fallback support
 */
class BaseModelClient {
  constructor(provider, baseUrl, apiKey) {
    this.provider = provider;
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      timeout: config.system.timeout,
    });
  }

  /**
   * Resolve the HTTP client for this call. When agentConfig provides a
   * per-agent apiKey or baseUrl that differs from the shared defaults,
   * create a one-off client so each agent can talk to a different NVIDIA
   * endpoint/key. Otherwise reuse the pre-configured this.client.
   */
  resolveClient(agentConfig) {
    if (!agentConfig) return this.client;

    const hasOverride =
      (agentConfig.apiKey && agentConfig.apiKey !== this.apiKey) ||
      (agentConfig.baseUrl && agentConfig.baseUrl !== this.baseUrl);

    if (!hasOverride) return this.client;

    return axios.create({
      baseURL: agentConfig.baseUrl || this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${agentConfig.apiKey || this.apiKey}`,
        ...(this.extraHeaders || {}),
      },
      timeout: config.system.timeout,
    });
  }

  /**
   * Generate text completion with retry logic
   */
  async generate(model, messages, options = {}, agentConfig = null) {
    const maxRetries = options.maxRetries || config.system.maxRetries;
    const retryDelay = options.retryDelay || config.system.retryDelay;

    let lastError = null;
    let jsonModeAttempted = false;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const body = {
          model,
          messages,
          temperature: options.temperature || config.system.temperature,
          max_tokens: options.maxTokens || config.system.maxTokens,
        };
        // Force JSON output mode when the caller requests it (supported by Groq, OpenRouter, NVIDIA)
        if (options.json) {
          body.response_format = { type: 'json_object' };
          jsonModeAttempted = true;
        }
        const httpClient = this.resolveClient(agentConfig);
        const response = await httpClient.post('/chat/completions', body);

        return {
          success: true,
          content: response.data.choices[0].message.content,
          usage: response.data.usage,
          model: response.data.model,
          provider: this.provider,
        };
      } catch (error) {
        lastError = error;

        // Check if it's a rate limit error (429)
        if (error.response?.status === 429) {
          console.log(`${this.provider} rate limited, attempt ${attempt + 1}/${maxRetries}`);

          // Exponential backoff
          const delay = retryDelay * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        // If response_format (JSON mode) caused a 400/422 error, retry without it.
        // Some models/providers don't support response_format — the fallback parser
        // in each agent can handle non-JSON output.
        if (
          jsonModeAttempted &&
          (error.response?.status === 400 || error.response?.status === 422)
        ) {
          const errData = JSON.stringify(error.response?.data || {}).toLowerCase();
          if (
            errData.includes('response_format') ||
            errData.includes('json') ||
            errData.includes('unsupported')
          ) {
            console.warn(`${this.provider} rejected response_format — retrying without JSON mode`);
            jsonModeAttempted = false;
            options.json = false;
            continue; // retry without json mode on next loop iteration
          }
        }

        // For other errors, don't retry
        break;
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Unknown error',
      provider: this.provider,
    };
  }

  /**
   * Generate embeddings (for memory agent)
   */
  async generateEmbedding(model, text, agentConfig = null) {
    try {
      const httpClient = this.resolveClient(agentConfig);
      const response = await httpClient.post('/embeddings', {
        model,
        input: text,
        encoding_format: 'float',
      });

      return {
        success: true,
        embedding: response.data.data[0].embedding,
        usage: response.data.usage,
        provider: this.provider,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        provider: this.provider,
      };
    }
  }
}

/**
 * Groq Model Client
 */
class GroqClient extends BaseModelClient {
  constructor() {
    super('groq', config.groq.baseUrl, config.groq.apiKey);
  }

  async generate(model, messages, options = {}, agentConfig = null) {
    // Override for Groq-specific options if needed
    return super.generate(model, messages, options, agentConfig);
  }
}

/**
 * NVIDIA NIM Model Client
 */
class NvidiaClient extends BaseModelClient {
  constructor() {
    super('nvidia', config.nvidia.baseUrl, config.nvidia.apiKey);
  }

  async generate(model, messages, options = {}, agentConfig = null) {
    // NVIDIA NIM might have different parameters
    return super.generate(model, messages, options, agentConfig);
  }
}

/**
 * OpenRouter Fallback Client
 */
class OpenRouterClient extends BaseModelClient {
  constructor() {
    super('openrouter', config.openrouter.baseUrl, config.openrouter.apiKey);

    // OpenRouter requires additional headers — store them so resolveClient()
    // can apply them to per-agent override clients too
    this.extraHeaders = {
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'Multi-Agent System',
    };
    Object.assign(this.client.defaults.headers, this.extraHeaders);
  }

  async generate(model, messages, options = {}, agentConfig = null) {
    return super.generate(model, messages, options, agentConfig);
  }
}

module.exports = {
  BaseModelClient,
  GroqClient,
  NvidiaClient,
  OpenRouterClient,
};
