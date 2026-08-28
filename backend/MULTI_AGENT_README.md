# Multi-Agent AI System

A sophisticated multi-agent AI system built on Express.js that uses cloud-based AI models with automatic fallback capabilities. The system routes user requests through an orchestrator to specialized domain agents for optimal performance.

## Architecture

### Agent System

```
User Request → Orchestrator → Specialized Agent → Response
                    ↓
              Agent Coordinator
                    ↓
         Fallback Manager (Retry + Provider Switch)
                    ↓
         Model Clients (Groq, NVIDIA, OpenRouter)
```

### Components

1. **Orchestrator Agent** (`llama-3.3-70b-versatile`)
   - Analyzes user requests
   - Routes to appropriate specialized agents
   - Formats responses for users

2. **Task Agent** (`llama-3.1-8b-instant`)
   - Task creation and management
   - Priority and deadline handling
   - Task breakdown and recommendations

3. **Event Agent** (`llama-3.1-8b-instant`)
   - Calendar event management
   - Scheduling and conflict detection
   - Time zone handling

4. **Place Agent** (`mixtral-8x7b-32768`)
   - Address processing and validation
   - Location categorization
   - Geographic context

5. **File Agent** (`meta/llama-3.1-70b-instruct`)
   - Document analysis
   - Content extraction
   - File organization

6. **Memory Agent** (`baai/bge-large-en-v1.5`)
   - Semantic search
   - Information storage and retrieval
   - Contextual responses

## Features

### 🔄 Automatic Fallback

- **Rate Limit Handling**: Automatic retry with exponential backoff (max 3 retries)
- **Provider Switching**: Seamless fallback from Groq → NVIDIA → OpenRouter
- **Error Recovery**: Graceful degradation when services are unavailable

### 🧠 Intelligent Routing

- **Semantic Analysis**: Orchestrator understands request context
- **Keyword Fallback**: Backup routing based on pattern matching
- **Direct Access**: Bypass orchestrator for specific agent calls

### 💾 Memory System

- **Embedding Generation**: Semantic understanding of stored information
- **Vector Search**: Cosine similarity for relevant retrieval
- **Context Management**: Automatic cleanup of old memories

## API Endpoints

### Main Chat Endpoint

**POST** `/api/agents/chat`

Process user message through the multi-agent system.

```json
{
  "message": "Create a task to review project documentation",
  "context": {
    "userId": "123",
    "project": "mobile-app"
  }
}
```

**Response:**

```json
{
  "success": true,
  "agent": "task",
  "action": "process",
  "response": "I'll help you create a task...",
  "metadata": {
    "provider": "groq",
    "model": "llama-3.1-8b-instant",
    "usage": {
      "prompt_tokens": 50,
      "completion_tokens": 100,
      "total_tokens": 150
    }
  }
}
```

### Direct Agent Access

#### Task Agent

**POST** `/api/agents/task`

```json
{
  "message": "What are the best practices for task prioritization?",
  "parameters": {
    "action": "recommend"
  }
}
```

#### Event Agent

**POST** `/api/agents/event`

```json
{
  "message": "Schedule a team meeting for next Tuesday",
  "parameters": {
    "action": "create"
  }
}
```

#### Place Agent

**POST** `/api/agents/place`

```json
{
  "message": "Validate this address: 123 Main St, New York, NY",
  "parameters": {
    "action": "process_address"
  }
}
```

#### File Agent

**POST** `/api/agents/file`

```json
{
  "message": "Analyze this document content",
  "parameters": {
    "action": "analyze_content",
    "fileType": "pdf"
  }
}
```

### Memory Operations

#### Store Information

**POST** `/api/agents/memory/store`

```json
{
  "text": "The project deadline is June 30th, 2026",
  "metadata": {
    "category": "project",
    "importance": "high"
  }
}
```

#### Semantic Search

**POST** `/api/agents/memory/search`

```json
{
  "query": "project deadline",
  "topK": 5
}
```

**Response:**

```json
{
  "success": true,
  "results": [
    {
      "id": "1234567890",
      "text": "The project deadline is June 30th, 2026",
      "similarity": 0.95,
      "metadata": {
        "category": "project",
        "importance": "high"
      },
      "timestamp": "2026-06-24T10:30:00.000Z"
    }
  ],
  "query": "project deadline"
}
```

#### Clear Old Memories

**POST** `/api/agents/memory/clear`

```json
{
  "maxAge": 604800000 // 7 days in milliseconds
}
```

### System Status

**GET** `/api/agents/status`

Get current system status and memory statistics.

```json
{
  "success": true,
  "status": {
    "agents": ["task", "event", "place", "file", "memory", "general"],
    "orchestrator": "active",
    "memory": {
      "totalMemories": 42,
      "oldest": "2026-06-17T10:00:00.000Z",
      "newest": "2026-06-24T15:30:00.000Z"
    }
  }
}
```

## Usage Examples

### JavaScript/Node.js

```javascript
// Basic chat
const response = await fetch('http://localhost:3000/api/agents/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'Create a task to review the mobile app documentation',
  }),
});

const data = await response.json();
console.log(data.response);
```

### Python

```python
import requests

response = requests.post('http://localhost:3000/api/agents/chat', json={
    'message': 'Schedule a team meeting for Friday',
    'context': {'team': 'mobile-dev'}
})

data = response.json()
print(data['response'])
```

### cURL

```bash
curl -X POST http://localhost:3000/api/agents/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What are the priority levels for tasks?"
  }'
```

## Configuration

### Model Assignment

Edit `src/agents/config.js` to customize models:

```javascript
groq: {
  models: {
    orchestrator: 'llama-3.3-70b-versatile',
    task: 'llama-3.1-8b-instant',
    event: 'llama-3.1-8b-instant',
    place: 'mixtral-8x7b-32768'
  }
},
nvidia: {
  models: {
    file: 'meta/llama-3.1-70b-instruct',
    memory: 'baai/bge-large-en-v1.5'
  }
}
```

### System Parameters

```javascript
system: {
  maxRetries: 3,           // Maximum retry attempts
  retryDelay: 1000,        // Initial retry delay (ms)
  timeout: 30000,          // Request timeout (ms)
  temperature: 0.7,        // Default temperature
  maxTokens: 2048          // Default max tokens
}
```

## Error Handling

The system provides detailed error responses:

```json
{
  "success": false,
  "error": "All providers failed for task",
  "agent": "task",
  "fallbackUsed": true,
  "reasoning": "Keyword-based fallback routing"
}
```

### Common Errors

- **429 Rate Limit**: Automatic retry with fallback
- **401 Unauthorized**: Check API keys
- **500 Server Error**: Temporary service issue
- **400 Bad Request**: Invalid input parameters

## Performance Considerations

### Latency

- **Groq**: ~500-1000ms (fastest)
- **NVIDIA**: ~1000-2000ms
- **OpenRouter**: ~1500-3000ms (fallback)

### Rate Limits

- **Groq**: 30 requests/minute (free tier)
- **NVIDIA**: Varies by model
- **OpenRouter**: 200 requests/day (free tier)

### Optimization Tips

1. Use context efficiently to reduce token usage
2. Cache frequent queries
3. Batch similar requests
4. Monitor usage statistics

## Security Considerations

1. **API Keys**: Never commit to version control
2. **Rate Limiting**: Implement for production
3. **Input Validation**: Sanitize user inputs
4. **Authentication**: Add auth middleware to endpoints
5. **Logging**: Monitor for abuse patterns

## Monitoring

Enable logging by setting environment variable:

```env
LOG_LEVEL=debug
```

Monitor:

- Request/response times
- Provider usage distribution
- Error rates and fallback frequency
- Memory storage growth

## Production Deployment

1. **Environment Variables**: Use secure secret management
2. **Load Balancing**: Multiple instances for high availability
3. **Database**: Replace in-memory storage with vector database
4. **Caching**: Implement Redis for frequent queries
5. **Monitoring**: Set up alerts and dashboards
6. **Rate Limiting**: Protect against abuse

## Future Enhancements

- [ ] Streaming responses
- [ ] Voice input/output
- [ ] Multi-modal capabilities
- [ ] Advanced memory with vector database
- [ ] Agent collaboration
- [ ] Custom agent creation
- [ ] Webhook integrations
- [ ] Real-time notifications

## Support

For issues or questions:

1. Check the SETUP_GUIDE.md for configuration
2. Review API endpoint documentation
3. Check console logs for error details
4. Verify API key permissions

## License

Part of the backend system. See main project license.
