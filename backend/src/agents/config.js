/**
 * Build a per-agent NVIDIA profile. Each agent can have its own API key,
 * base URL, and model via env vars — falling back to shared NIM defaults.
 *
 * Env var pattern (where <AGENT> is the agent name uppercased):
 *   NVIDIA_<AGENT>_API_KEY   — per-agent key  (falls back to NVIDIA_NIM_API_KEY)
 *   NVIDIA_<AGENT>_BASE_URL  — per-agent URL  (falls back to NVIDIA_NIM_BASE_URL)
 *   NVIDIA_<AGENT>_MODEL     — per-agent model (falls back to defaultModel)
 *
 * This avoids key/model collisions when different agents use different
 * NVIDIA services. Adding a new agent is one line:
 *   general: nvidiaProfile('general', 'meta/llama-3.1-8b-instruct'),
 */
function nvidiaProfile(agentName, defaultModel) {
  const prefix = `NVIDIA_${agentName.toUpperCase()}_`;
  return {
    apiKey:  process.env[`${prefix}API_KEY`]  || process.env.NVIDIA_NIM_API_KEY,
    baseUrl: process.env[`${prefix}BASE_URL`] || process.env.NVIDIA_NIM_BASE_URL || 'https://integrate.api.nvidia.com/v1',
    model:   process.env[`${prefix}MODEL`]    || defaultModel,
  };
}

module.exports = {
  groq: {
    apiKey: process.env.GROQ_API_KEY,
    baseUrl: 'https://api.groq.com/openai/v1',
    models: {
      orchestrator: 'llama-3.3-70b-versatile',
      task: 'llama-3.1-8b-instant',
      event: 'llama-3.1-8b-instant',
      place: 'mixtral-8x7b-32768',
      whisper: 'whisper-large-v3-turbo',
      general: 'llama-3.1-8b-instant',
      desktop: 'llama-3.1-8b-instant',
      image: 'llama-3.1-8b-instant',
      email: 'llama-3.1-8b-instant',
    }
  },

  // NIM chat/embed API — separate from NVIDIA_IMAGE_API_KEY (FLUX image gen).
  // Shared defaults (apiKey/baseUrl) are used by the NvidiaClient constructor;
  // per-agent profiles below can override apiKey/baseUrl/model for agents that
  // need a distinct NVIDIA service. Adding a new agent is one line — see
  // nvidiaProfile() above.
  nvidia: {
    apiKey: process.env.NVIDIA_NIM_API_KEY,
    baseUrl: process.env.NVIDIA_NIM_BASE_URL || 'https://integrate.api.nvidia.com/v1',

    orchestrator: nvidiaProfile('orchestrator', 'meta/llama-3.3-70b-instruct'),
    task:        nvidiaProfile('task',        'meta/llama-3.1-8b-instruct'),
    event:       nvidiaProfile('event',       'meta/llama-3.1-8b-instruct'),
    place:       nvidiaProfile('place',       'meta/llama-3.1-8b-instruct'),
    file:        nvidiaProfile('file',        'meta/llama-3.1-70b-instruct'),
    memory:      nvidiaProfile('memory',      'baai/bge-large-en-v1.5'),
    general:     nvidiaProfile('general',     'meta/llama-3.1-8b-instruct'),
    desktop:     nvidiaProfile('desktop',     'meta/llama-3.1-8b-instruct'),
    email:       nvidiaProfile('email',       'meta/llama-3.1-8b-instruct'),
  },

  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: 'https://openrouter.ai/api/v1',
    models: {
      fallback: 'meta-llama/llama-3.1-8b-instruct:free',
      orchestrator: 'meta-llama/llama-3.3-70b-instruct:free',
      gemma: 'google/gemma-4-31b-it',
      desktop: 'meta-llama/llama-3.1-8b-instruct:free',
      image: 'meta-llama/llama-3.1-8b-instruct:free',
      email: 'meta-llama/llama-3.1-8b-instruct:free',
    }
  },

  system: {
    maxRetries: 3,
    retryDelay: 1000,
    timeout: 30000,
    temperature: 0.7,
    maxTokens: 2048
  }
};
