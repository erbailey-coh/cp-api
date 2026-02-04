# Copilot Shim - OpenAI API Proxy for M365 Copilot

## Overview
Create a Node.js/TypeScript server that exposes an OpenAI-compatible API and proxies requests to Microsoft 365 Copilot (m365.cloud.microsoft/chat) via Playwright browser automation.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  OpenAI Client  │────▶│  Copilot Shim    │────▶│  M365 Copilot Chat  │
│  (curl, SDK)    │     │  (Express + API) │     │  (Playwright)       │
└─────────────────┘     └──────────────────┘     └─────────────────────┘
```

## Project Structure

```
copilot-shim/
├── src/
│   ├── index.ts              # Entry point, Express server setup
│   ├── api/
│   │   ├── routes.ts         # OpenAI API route definitions
│   │   └── handlers.ts       # Request handlers for each endpoint
│   ├── browser/
│   │   ├── manager.ts        # Browser lifecycle management
│   │   ├── copilot.ts        # M365 Copilot page interactions
│   │   ├── models.ts         # Model name mapping & selection logic
│   │   └── selectors.ts      # DOM selectors for Copilot UI
│   ├── types/
│   │   └── openai.ts         # OpenAI API type definitions
│   └── utils/
│       └── config.ts         # Configuration management
├── package.json
├── tsconfig.json
└── README.md
```

## Key Components

### 1. Express Server (src/index.ts)
- HTTP server on configurable port (default: 3000)
- CORS enabled for local development
- JSON body parsing

### 2. OpenAI-Compatible API Routes (src/api/routes.ts)
Implement core endpoints:
- `POST /v1/chat/completions` - Main chat endpoint
- `GET /v1/models` - List available models (returns mapped Copilot models)
- `GET /health` - Health check endpoint

### 2a. Model Selection & Mapping (src/browser/models.ts)
The Copilot UI has a model selector dropdown in the top-right corner with these options:
- **Auto** - "Decides how long to think"
- **Quick response** - "Answers right away"
- **Think deeper** - "Thinks longer for better answers"
- **GPT-5.2 Quick response** (under "More")
- **GPT-5.2 Think deeper** (under "More")

**Model name mapping (OpenAI → Copilot):**
| OpenAI API Model Name | Copilot Selection |
|-----------------------|-------------------|
| `copilot-auto` / `auto` | Auto |
| `copilot-quick` / `gpt-4o` / `gpt-4o-mini` | Quick response |
| `copilot-think` / `o1` / `o1-mini` | Think deeper |
| `gpt-5.2` / `gpt-5.2-quick` | GPT-5.2 Quick response |
| `gpt-5.2-think` / `o3` | GPT-5.2 Think deeper |

**Default model:** `copilot-auto` (if no model specified or unrecognized model)

**Error handling:** If a requested model cannot be mapped, return HTTP 400 with:
```json
{
  "error": {
    "message": "Model 'xxx' is not supported. Available models: copilot-auto, copilot-quick, copilot-think, gpt-5.2-quick, gpt-5.2-think",
    "type": "invalid_request_error",
    "code": "model_not_found"
  }
}
```

### 3. Browser Manager (src/browser/manager.ts)
- Initialize Playwright with persistent context (saves login state)
- User data directory for session persistence (~/.copilot-shim/)
- Headless mode toggle (headed for initial login, headless for operation)
- Browser launch with appropriate flags for M365 auth

### 4. Copilot Interaction Layer (src/browser/copilot.ts)
- Navigate to m365.cloud.microsoft/chat
- Detect login state, prompt user if login needed
- **Select model before sending message:**
  1. Click the model selector button (top-right, shows "Auto" by default)
  2. If selecting GPT-5.2 models, first click "More" to expand
  3. Click the target model option
  4. Verify selection changed
- Find chat input textarea (placeholder: "Message Copilot")
- Submit messages and wait for response completion
- Extract response text from the UI
- Handle "New Topic" to reset conversation when needed

**UI Elements identified from screenshot:**
- Model selector button: Top-right corner, currently shows "Auto ▼"
- Model dropdown options: Auto, Quick response, Think deeper
- "More" section (collapsed): Contains GPT-5.2 Quick response, GPT-5.2 Think deeper
- Chat input: Large textarea with placeholder "Message Copilot"
- Tools button: Below input (we'll ignore this)
- Sidebar: Contains chat history, agents, apps (we'll mostly ignore)

### 5. Request/Response Mapping
Transform between OpenAI format and Copilot:

**Input (OpenAI format):**
```json
{
  "model": "gpt-4",
  "messages": [
    {"role": "user", "content": "Hello"}
  ]
}
```

**Output (OpenAI format):**
```json
{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "copilot-m365",
  "choices": [{
    "index": 0,
    "message": {"role": "assistant", "content": "..."},
    "finish_reason": "stop"
  }],
  "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
}
```

## Implementation Steps

### Step 1: Project Setup
- Initialize npm project with TypeScript
- Install dependencies: express, playwright, uuid, cors
- Configure tsconfig.json for Node.js

### Step 2: Browser Manager
- Create browser manager with persistent context
- Implement session storage in ~/.copilot-shim/browser-data/
- Add login detection and user prompting

### Step 3: Copilot Page Interactions
- Implement page navigation to M365 Copilot
- Create message sending function (find input, type, submit)
- Create response extraction (wait for completion indicator, get text)
- Handle conversation context (multi-turn vs single-turn)

### Step 4: API Server
- Set up Express with routes
- Implement /v1/chat/completions handler
- Implement /v1/models endpoint
- Add error handling and logging

### Step 5: Integration & Testing
- Wire all components together
- Test with curl
- Test with OpenAI Python SDK

## Key Technical Decisions

1. **Persistent Browser Context**: Use Playwright's `launchPersistentContext` to maintain login state across restarts

2. **Single Browser Instance**: Maintain one browser instance for all requests (M365 Copilot doesn't handle multiple concurrent chats well)

3. **Request Queue**: Process requests sequentially to avoid conflicts in the Copilot UI

4. **Response Detection**: Watch for Copilot's "stop generating" button to disappear or response completion indicator

5. **No Streaming**: Return complete responses only (simpler implementation, reliable)

## Dependencies

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "playwright": "^1.40.0",
    "uuid": "^9.0.0",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.0",
    "@types/cors": "^2.8.17",
    "@types/uuid": "^9.0.7"
  }
}
```

## Verification Plan

1. **Start server**: `npm run dev`
2. **First run**: Browser opens, manually log in to M365
3. **Test with curl**:
   ```bash
   curl http://localhost:3000/v1/chat/completions \
     -H "Content-Type: application/json" \
     -d '{"model": "copilot", "messages": [{"role": "user", "content": "Hello"}]}'
   ```
4. **Test with OpenAI SDK**:
   ```python
   from openai import OpenAI
   client = OpenAI(base_url="http://localhost:3000/v1", api_key="unused")
   response = client.chat.completions.create(
       model="copilot",
       messages=[{"role": "user", "content": "Hello"}]
   )
   print(response.choices[0].message.content)
   ```

## Notes

- The DOM selectors for M365 Copilot may need adjustment as Microsoft updates their UI
- First run requires manual login; subsequent runs use saved session
- Token usage stats are not available from Copilot, so they're returned as 0
- Consider adding retry logic for transient failures
- May need to handle rate limiting from Microsoft's side
