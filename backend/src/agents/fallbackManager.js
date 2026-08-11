const { GroqClient, NvidiaClient, OpenRouterClient } = require('./modelClient');
const config = require('./config');

/**
 * Fallback Manager for handling provider switching
 */
class FallbackManager {
  constructor() {
    this.groqClient = new GroqClient();
    this.nvidiaClient = new NvidiaClient();
    this.openRouterClient = new OpenRouterClient();
    
    // Provider priority for each agent type
    this.providerPriority = {
      orchestrator: ['nvidia', 'groq', 'openrouter'],
      task: ['nvidia', 'groq', 'openrouter'],
      event: ['nvidia', 'groq', 'openrouter'],
      place: ['nvidia', 'groq', 'openrouter'],
      file: ['nvidia', 'openrouter'],
      memory: ['nvidia', 'openrouter'],
      general: ['nvidia', 'groq', 'openrouter'],
      desktop: ['nvidia', 'groq', 'openrouter'],
      image: ['groq', 'openrouter'],
      email: ['nvidia', 'groq', 'openrouter'],
      gemma: ['openrouter', 'groq']
    };
  }

  /**
   * Execute request with automatic fallback
   */
  async execute(agentType, operation, ...args) {
    const providers = this.providerPriority[agentType] || ['groq', 'openrouter'];
    let lastError = null;
    
    for (const provider of providers) {
      try {
        const client = this.getClient(provider);
        console.log(`Attempting ${agentType} with ${provider}...`);
        
        const result = await client[operation](...args);
        
        if (result.success) {
          console.log(`✓ ${agentType} succeeded with ${provider}`);
          return result;
        } else {
          console.log(`✗ ${agentType} failed with ${provider}: ${result.error}`);
          lastError = result.error;
          
          // If it's not a rate limit error, try next provider immediately
          if (!result.error.includes('rate limit')) {
            continue;
          }
        }
      } catch (error) {
        console.log(`✗ ${agentType} failed with ${provider}: ${error.message}`);
        lastError = error.message;
      }
    }
    
    // All providers failed
    return {
      success: false,
      error: `All providers failed for ${agentType}. Last error: ${lastError}`,
      agentType
    };
  }

  /**
   * Get client instance for provider
   */
  getClient(provider) {
    switch (provider) {
      case 'groq':
        return this.groqClient;
      case 'nvidia':
        return this.nvidiaClient;
      case 'openrouter':
        return this.openRouterClient;
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  /**
   * Resolve the full agent config (apiKey, baseUrl, model) for a given
   * agent type + provider. For NVIDIA this returns the per-agent profile
   * so each agent can use a distinct key/endpoint/model.
   */
  getAgentConfig(agentType, provider) {
    switch (provider) {
      case 'groq':
        return {
          apiKey: config.groq.apiKey,
          baseUrl: config.groq.baseUrl,
          model: config.groq.models[agentType] || config.groq.models.general,
        };
      case 'nvidia': {
        const profile = config.nvidia[agentType];
        if (!profile) {
          throw new Error(`No NVIDIA config for agent type: ${agentType}`);
        }
        return profile;
      }
      case 'openrouter':
        return {
          apiKey: config.openrouter.apiKey,
          baseUrl: config.openrouter.baseUrl,
          model: config.openrouter.models[agentType] || config.openrouter.models.fallback,
        };
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  /**
   * Get model for agent type and provider (backward-compatible wrapper)
   */
  getModel(agentType, provider) {
    return this.getAgentConfig(agentType, provider).model;
  }

  /**
   * Generate text with automatic fallback
   */
  async generateText(agentType, messages, options = {}) {
    const providers = this.providerPriority[agentType] || ['groq', 'openrouter'];
    
    for (const provider of providers) {
      try {
        const agentConfig = this.getAgentConfig(agentType, provider);
        const client = this.getClient(provider);
        
        console.log(`Attempting ${agentType} with ${provider} using model ${agentConfig.model}...`);
        
        const result = await client.generate(agentConfig.model, messages, options, agentConfig);
        
        if (result.success) {
          console.log(`✓ ${agentType} succeeded with ${provider}`);
          return result;
        } else {
          console.log(`✗ ${agentType} failed with ${provider}: ${result.error}`);
          
          // If not rate limited, try next provider
          if (!result.error.includes('rate limit')) {
            continue;
          }
        }
      } catch (error) {
        console.log(`✗ ${agentType} failed with ${provider}: ${error.message}`);
      }
    }
    
    return {
      success: false,
      error: `All providers failed for ${agentType}`,
      agentType
    };
  }

  /**
   * Generate embeddings with automatic fallback
   */
  async generateEmbedding(text, options = {}) {
    const providers = this.providerPriority.memory || ['nvidia', 'openrouter'];
    
    for (const provider of providers) {
      try {
        const agentConfig = this.getAgentConfig('memory', provider);
        const client = this.getClient(provider);
        
        console.log(`Attempting memory embedding with ${provider} using model ${agentConfig.model}...`);
        
        const result = await client.generateEmbedding(agentConfig.model, text, agentConfig);
        
        if (result.success) {
          console.log(`✓ Memory embedding succeeded with ${provider}`);
          return result;
        } else {
          console.log(`✗ Memory embedding failed with ${provider}: ${result.error}`);
        }
      } catch (error) {
        console.log(`✗ Memory embedding failed with ${provider}: ${error.message}`);
      }
    }
    
    return {
      success: false,
      error: 'All providers failed for memory embedding'
    };
  }
}

// Singleton instance
const fallbackManager = new FallbackManager();

module.exports = fallbackManager;
