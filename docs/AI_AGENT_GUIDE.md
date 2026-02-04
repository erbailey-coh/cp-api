# Copilot Shim - AI Agent Integration Guide

This document explains how to integrate with the Copilot Shim API, an OpenAI-compatible endpoint that proxies requests to Microsoft 365 Copilot.

## Overview

Copilot Shim provides an OpenAI-compatible REST API running locally at `http://localhost:4891`. You can use standard OpenAI client libraries or direct HTTP requests to interact with it.

## Base URL

```
http://localhost:4891
```

All endpoints are available with or without the `/v1` prefix for convenience.

## Authentication

**No authentication required.** The server handles Microsoft authentication internally via browser automation. Simply make requests to the endpoints directly.

## Available Endpoints

### 1. Chat Completions

**`POST /v1/chat/completions`**

The primary endpoint for sending messages and receiving responses.

#### Request Format

```json
{
  "model": "copilot-auto",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hello, how are you?"}
  ],
  "session_id": "optional-session-id-for-multi-turn"
}
```

#### Request Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `model` | string | No | Model to use (see Models section). Defaults to `copilot-auto` |
| `messages` | array | Yes | Array of message objects with `role` and `content` |
| `session_id` | string | No | Session ID for multi-turn conversations |
| `stream` | boolean | No | **Not supported** - will return error if `true` |

#### Message Roles

- `system` - System instructions (only used on first message of a session)
- `user` - User messages
- `assistant` - Previous assistant responses (for context in stateless mode)

#### Response Format

```json
{
  "id": "chatcmpl-550e8400-e29b-41d4-a716-446655440000",
  "object": "chat.completion",
  "created": 1699000000,
  "model": "copilot-auto",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! I'm doing well, thank you for asking."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 0,
    "completion_tokens": 0,
    "total_tokens": 0
  },
  "session_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

> **Note:** Token usage is always 0 as this information is not available from Copilot.

### 2. List Models

**`GET /v1/models`**

Returns available models.

#### Response

```json
{
  "object": "list",
  "data": [
    {"id": "copilot-auto", "object": "model", "created": 1699000000, "owned_by": "microsoft-copilot"},
    {"id": "copilot-quick", "object": "model", "created": 1699000000, "owned_by": "microsoft-copilot"},
    {"id": "copilot-think", "object": "model", "created": 1699000000, "owned_by": "microsoft-copilot"},
    {"id": "gpt-5.2-quick", "object": "model", "created": 1699000000, "owned_by": "microsoft-copilot"},
    {"id": "gpt-5.2-think", "object": "model", "created": 1699000000, "owned_by": "microsoft-copilot"}
  ]
}
```

### 3. List Sessions

**`GET /v1/sessions`**

Returns information about active conversation sessions.

#### Response

```json
{
  "activeSessions": 2,
  "maxSessions": 10,
  "sessions": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "createdAt": 1699000000000,
      "lastActivityAt": 1699000500000,
      "messageCount": 5,
      "idleMinutes": 2
    }
  ]
}
```

### 4. Delete Session

**`DELETE /v1/sessions/:id`**

Close a specific session and free resources.

#### Response (Success)

```json
{
  "success": true,
  "message": "Session 550e8400-e29b-41d4-a716-446655440000 closed"
}
```

#### Response (Not Found)

```json
{
  "error": {
    "message": "Session 550e8400-e29b-41d4-a716-446655440000 not found",
    "type": "invalid_request_error",
    "code": "session_not_found"
  }
}
```

### 5. Health Check

**`GET /health`**

Check server status.

#### Response

```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "queue": {
    "pending": 0,
    "processing": false
  },
  "sessions": {
    "active": 1,
    "max": 10
  }
}
```

## Available Models

### Primary Model Names

These are the official model names to use:

| Model ID | Copilot UI Name | Description | Best For |
|----------|-----------------|-------------|----------|
| `copilot-auto` | Auto | Automatic model selection | General use (recommended) |
| `copilot-quick` | Quick response | Fast responses | Simple questions, quick tasks |
| `copilot-think` | Think deeper | Extended reasoning | Complex problems, analysis |
| `gpt-5.2-quick` | GPT-5.2 Quick response | Fast responses with GPT-5.2 | Quick tasks with newer model |
| `gpt-5.2-think` | GPT-5.2 Think deeper | Extended reasoning with GPT-5.2 | Complex reasoning with newer model |

### All Accepted Model Names

The following model names are all valid and will be mapped to the appropriate Copilot model:

**Auto (default):**
- `copilot-auto`
- `auto`

**Quick Response:**
- `copilot-quick`
- `gpt-4o`
- `gpt-4o-mini`
- `gpt-4`
- `gpt-3.5-turbo`

**Think Deeper:**
- `copilot-think`
- `o1`
- `o1-mini`
- `o1-preview`

**GPT-5.2 Quick Response:**
- `gpt-5.2-quick`
- `gpt-5.2`
- `gpt-5`

**GPT-5.2 Think Deeper:**
- `gpt-5.2-think`
- `o3`
- `o3-mini`

### Model Selection Recommendation

- Use `copilot-auto` for most tasks (lets Copilot decide)
- Use `copilot-quick` when you need fast responses
- Use `copilot-think` for complex reasoning or analysis tasks
- Use `gpt-5.2-quick` or `gpt-5.2-think` for the newer GPT-5.2 models

## Multi-Turn Conversations

The API supports multi-turn conversations via sessions. Each session maintains conversation history within the Copilot interface.

### How Sessions Work

1. **First Request**: Don't include `session_id` - a new session is created
2. **Response**: Contains `session_id` in the response
3. **Subsequent Requests**: Include the `session_id` to continue the conversation
4. **Context**: Copilot remembers previous messages in the session

### Session Behavior

- Sessions timeout after **30 minutes** of inactivity
- Maximum **10 concurrent sessions** (oldest closes when limit reached)
- Each session is an isolated browser tab with its own conversation

### Example: Multi-Turn Conversation

```python
from openai import OpenAI

client = OpenAI(base_url="http://localhost:4891/v1", api_key="unused")

# First message - creates new session
response1 = client.chat.completions.create(
    model="copilot-auto",
    messages=[{"role": "user", "content": "My name is Alice. Remember it."}]
)

# Extract session_id from response
session_id = response1.session_id  # or response1.model_extra.get("session_id")

# Continue conversation with same session
response2 = client.chat.completions.create(
    model="copilot-auto",
    messages=[{"role": "user", "content": "What is my name?"}],
    extra_body={"session_id": session_id}
)

# Copilot will remember "Alice" from the previous message
```

### Stateless Mode

If you don't use sessions (no `session_id`), each request creates a new session. For context in stateless mode, include conversation history in the `messages` array:

```json
{
  "model": "copilot-auto",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "My name is Bob."},
    {"role": "assistant", "content": "Nice to meet you, Bob!"},
    {"role": "user", "content": "What is my name?"}
  ]
}
```

> **Note:** In stateless mode, all messages are formatted into a single prompt. Sessions are more efficient for true multi-turn conversations.

## Error Handling

All errors follow OpenAI's error format:

```json
{
  "error": {
    "message": "Descriptive error message",
    "type": "error_type",
    "code": "error_code"
  }
}
```

### Common Errors

| HTTP Code | Error Code | Description |
|-----------|------------|-------------|
| 400 | `invalid_messages` | Messages array is missing or empty |
| 400 | `streaming_not_supported` | Streaming was requested but is not supported |
| 400 | `model_not_found` | Invalid model name specified |
| 400 | `no_user_message` | No user message in continuing session |
| 404 | `session_not_found` | Session ID doesn't exist |
| 500 | `internal_error` | Server-side error |

## Usage with OpenAI SDK

### Python

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:4891/v1",
    api_key="not-needed"  # Required by SDK but not used
)

response = client.chat.completions.create(
    model="copilot-auto",
    messages=[
        {"role": "system", "content": "You are a helpful coding assistant."},
        {"role": "user", "content": "Write a Python function to calculate fibonacci numbers."}
    ]
)

print(response.choices[0].message.content)
```

### JavaScript/TypeScript

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'http://localhost:4891/v1',
  apiKey: 'not-needed',
});

const response = await client.chat.completions.create({
  model: 'copilot-auto',
  messages: [
    { role: 'user', content: 'Explain async/await in JavaScript' }
  ],
});

console.log(response.choices[0].message.content);
```

### cURL

```bash
curl http://localhost:4891/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "copilot-auto",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

## Important Considerations

### Response Time

Responses typically take **10-60 seconds** depending on:
- Model selected (think models take longer)
- Complexity of the request
- Current Copilot load

Set appropriate timeouts in your client (recommend 180+ seconds).

### Rate Limiting

- Requests are processed **sequentially** (one at a time per session)
- Multiple concurrent requests will queue
- Check `/health` endpoint to see queue status

### Streaming Not Supported

This API does **not** support streaming responses. Always set `stream: false` or omit it entirely.

### Token Usage

Token counts are always returned as `0` since this information is not available from Copilot. Do not rely on token usage for billing or context management.

### Session Cleanup

- Clean up sessions when done using `DELETE /v1/sessions/:id`
- Sessions auto-expire after 30 minutes of inactivity
- Maximum 10 concurrent sessions

## Troubleshooting

### Server Not Responding

1. Check if server is running: `curl http://localhost:4891/health`
2. Check logs: `pm2 logs copilot-shim` (if using PM2)
3. Restart server if needed

### Login Required

If you see login-related errors, the Microsoft session may have expired. The server will automatically open a browser window for re-authentication when this happens.

### Slow Responses

- Use `copilot-quick` model for faster responses
- Check queue status via `/health` endpoint
- Avoid sending many concurrent requests

### Session Issues

- If session_id returns "not found", the session expired (30 min timeout)
- Create a new session by omitting session_id
- Check active sessions via `GET /v1/sessions`
