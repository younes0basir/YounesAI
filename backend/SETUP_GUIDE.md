# Multi-Agent AI System Setup Guide

## Prerequisites

1. Node.js and npm installed
2. API keys for AI services (see below)
3. Existing Express backend setup

## API Keys Required

### 1. Groq API Key (Primary)
- Sign up at https://console.groq.com/
- Navigate to API Keys section
- Create a new API key
- Free tier available with rate limits

### 2. NVIDIA NIM API Key
- Sign up at https://build.nvidia.com/
- Navigate to API Keys section
- Create a new API key
- Free tier available for eligible models

### 3. OpenRouter API Key (Fallback)
- Sign up at https://openrouter.ai/
- Navigate to API Keys section
- Create a new API key
- Free models available

## Environment Configuration

Add the following to your `.env` file:

```env
# AI Service API Keys
GROQ_API_KEY=gsk_your_groq_api_key_here
NVIDIA_API_KEY=nvapi-your_nvidia_api_key_here
OPENROUTER_API_KEY=sk-or-your_openrouter_api_key_here
```

## Installation

The system is already integrated into your existing backend. Just ensure:

1. Dependencies are installed:
```bash
cd backend
npm install
```

2. Environment variables are set in `.env`

3. Start the server:
```bash
npm run dev
```

## Verification

Test the system is working:

```bash
curl -X POST http://localhost:3000/api/agents/status
```

Expected response:
```json
{
  "success": true,
  "status": {
    "agents": ["task", "event", "place", "file", "memory", "general"],
    "orchestrator": "active",
    "memory": {
      "totalMemories": 0,
      "oldest": null,
      "newest": null
    }
  }
}
```

## Testing Chat Endpoint

```bash
curl -X POST http://localhost:3000/api/agents/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Create a task to review the project documentation"
  }'
```

## Model Configuration

The system uses these models by default:

### Groq (Primary)
- **Orchestrator**: llama-3.3-70b-versatile
- **Task Agent**: llama-3.1-8b-instant
- **Event Agent**: llama-3.1-8b-instant
- **Place Agent**: mixtral-8x7b-32768

### NVIDIA NIM
- **File Agent**: meta/llama-3.1-70b-instruct
- **Memory Agent**: baai/bge-large-en-v1.5 (embeddings)

### OpenRouter (Fallback)
- **General**: meta-llama/llama-3.1-8b-instruct:free
- **Orchestrator**: meta-llama/llama-3.3-70b-instruct:free

## Troubleshooting

### Rate Limiting
If you see 429 errors, the system will automatically:
1. Retry with exponential backoff (max 3 retries)
2. Fall back to alternative providers
3. Use OpenRouter free models as final fallback

### API Key Issues
Ensure your API keys are:
- Correctly copied (no extra spaces)
- Active and not expired
- Have necessary permissions

### Connection Issues
Check that:
- Your internet connection is stable
- API endpoints are accessible
- Firewall isn't blocking requests

## Configuration

Edit `src/agents/config.js` to customize:
- Model selection
- Retry parameters
- Timeout settings
- Temperature and token limits

## Next Steps

1. Test each agent individually using direct endpoints
2. Integrate with your existing authentication system
3. Add rate limiting for production use
4. Set up monitoring and logging
5. Consider using a vector database for memory production
