# Implementation Checklist

This checklist tracks the implementation progress of the Copilot Shim project. Agents should update this file as tasks are completed.

## Legend
- [ ] Not started
- [x] Completed
- [~] In progress

---

## Phase 1: Project Setup

- [x] Initialize npm project with `npm init`
- [x] Create `package.json` with required dependencies
- [x] Create `tsconfig.json` for TypeScript configuration
- [x] Install dependencies: express, playwright, uuid, cors
- [x] Install dev dependencies: typescript, @types/express, @types/node, @types/cors, @types/uuid
- [x] Install Playwright browsers: `npx playwright install chromium`
- [x] Add npm scripts: `dev`, `build`, `start`
- [x] Create directory structure (`src/`, `src/api/`, `src/browser/`, `src/types/`, `src/utils/`)

## Phase 2: Type Definitions

- [x] Create `src/types/openai.ts` with:
  - [x] `ChatCompletionRequest` interface
  - [x] `ChatCompletionResponse` interface
  - [x] `ChatMessage` interface
  - [x] `Model` interface
  - [x] `ErrorResponse` interface

## Phase 3: Configuration

- [x] Create `src/utils/config.ts` with:
  - [x] Port configuration (default: 3000)
  - [x] Browser data directory path (~/.copilot-shim/browser-data/)
  - [x] Headless mode flag
  - [x] Copilot URL constant
  - [x] Timeout settings

## Phase 4: Model Mapping

- [x] Create `src/browser/models.ts` with:
  - [x] `CopilotModel` enum/type (Auto, Quick, Think, GPT52Quick, GPT52Think)
  - [x] Model name mapping object (OpenAI names → Copilot names)
  - [x] `mapModelName()` function
  - [x] `getAvailableModels()` function for /v1/models endpoint
  - [x] Model validation with proper error messages

## Phase 5: DOM Selectors

- [x] Create `src/browser/selectors.ts` with:
  - [x] Model selector button selector
  - [x] Model dropdown option selectors
  - [x] "More" expander selector
  - [x] Chat input textarea selector
  - [x] Submit button selector (if needed)
  - [x] Response container selector
  - [x] Response completion indicator selector
  - [x] Login detection selector
  - [x] "New chat" button selector

## Phase 6: Browser Manager

- [x] Create `src/browser/manager.ts` with:
  - [x] `BrowserManager` class
  - [x] `initialize()` - Launch persistent browser context
  - [x] `getPage()` - Get or create page
  - [x] `isLoggedIn()` - Check login state
  - [x] `waitForLogin()` - Wait for manual login
  - [x] `close()` - Clean shutdown
  - [x] Singleton pattern for single browser instance
  - [x] Error handling for browser crashes

## Phase 7: Copilot Interactions

- [x] Create `src/browser/copilot.ts` with:
  - [x] `navigateToCopilot()` - Navigate to m365.cloud.microsoft/chat
  - [x] `selectModel(model)` - Click model selector and choose model
  - [x] `expandMoreModels()` - Expand "More" section if needed (integrated in selectModel)
  - [x] `sendMessage(text)` - Type and submit message
  - [x] `waitForResponse()` - Wait for response to complete
  - [x] `extractResponse()` - Get response text from UI (extractLastResponse)
  - [x] `startNewChat()` - Click new chat to reset conversation
  - [x] Error handling for UI timeouts

## Phase 8: API Handlers

- [x] Create `src/api/handlers.ts` with:
  - [x] `handleChatCompletion()` - Process /v1/chat/completions
  - [x] `handleListModels()` - Return available models
  - [x] `handleHealthCheck()` - Return server status
  - [x] Request validation
  - [x] Response formatting (OpenAI format)
  - [x] Error response formatting

## Phase 9: API Routes

- [x] Create `src/api/routes.ts` with:
  - [x] `POST /v1/chat/completions` route
  - [x] `GET /v1/models` route
  - [x] `GET /health` route
  - [x] Request logging middleware

## Phase 10: Main Server

- [x] Create `src/index.ts` with:
  - [x] Express app setup
  - [x] CORS middleware
  - [x] JSON body parser
  - [x] Route mounting
  - [x] Browser initialization on startup
  - [x] Graceful shutdown handling (SIGINT, SIGTERM)
  - [x] Console logging for server status

## Phase 11: Request Queue

- [x] Implement request queue to serialize Copilot interactions:
  - [x] Queue data structure
  - [x] `enqueue()` function
  - [x] `processQueue()` worker (processNext)
  - [x] Request timeout handling
  - [x] Queue status in health check

## Phase 12: Multi-turn Session Support

- [x] Create `src/browser/sessions.ts` with:
  - [x] `Session` interface (id, page, timestamps, messageCount)
  - [x] `SessionManager` class
  - [x] `createSession()` - Create new browser page for session
  - [x] `getSession()` - Get existing session by ID
  - [x] `getOrCreateSession()` - Get or create session
  - [x] `closeSession()` - Close session and browser page
  - [x] `closeAllSessions()` - Clean shutdown
  - [x] `touchSession()` - Update activity timestamp
  - [x] `getStats()` - Return session statistics
  - [x] Automatic cleanup of expired sessions (30 min timeout)
  - [x] Max concurrent sessions limit (10)
- [x] Update `src/browser/copilot.ts` with:
  - [x] `chatCompletionOnPage()` - Session-aware chat function
  - [x] `sendMessageOnPage()` - Send message on specific page
  - [x] `selectModelOnPage()` - Select model on specific page
  - [x] `startNewChatOnPage()` - Start new chat on specific page
- [x] Update `src/api/handlers.ts` with:
  - [x] Session support in `handleChatCompletion()`
  - [x] `handleListSessions()` - List active sessions
  - [x] `handleDeleteSession()` - Delete specific session
- [x] Update `src/api/routes.ts` with:
  - [x] `GET /v1/sessions` route
  - [x] `DELETE /v1/sessions/:id` route
- [x] Update `src/types/openai.ts` with:
  - [x] `session_id` field in request
  - [x] `session_id` field in response
- [x] Update `src/browser/manager.ts` with:
  - [x] `getContext()` - Get browser context for session creation

## Phase 13: Testing & Verification

- [ ] Test server startup
- [ ] Test manual login flow (first run)
- [ ] Test with curl:
  - [ ] `POST /v1/chat/completions` with default model
  - [ ] `POST /v1/chat/completions` with specific model
  - [ ] `POST /v1/chat/completions` with invalid model (expect error)
  - [ ] `GET /v1/models`
  - [ ] `GET /health`
- [ ] Test with OpenAI Python SDK
- [ ] Test model selection for each model type
- [ ] Test session persistence (restart server, verify still logged in)
- [ ] Test session support:
  - [ ] `GET /v1/sessions` - list sessions
  - [ ] Multi-turn conversation with session_id
  - [ ] `DELETE /v1/sessions/:id` - close session

## Phase 14: Documentation

- [ ] Create README.md with:
  - [ ] Project description
  - [ ] Installation instructions
  - [ ] First-time setup (login flow)
  - [ ] Usage examples (curl, Python SDK)
  - [ ] Available models
  - [ ] Configuration options
  - [ ] Troubleshooting guide

---

## Notes for Agents

1. **Update this checklist** as you complete tasks - mark items with `[x]`
2. **Work in phase order** - each phase builds on the previous
3. **Test incrementally** - don't wait until the end to test
4. **DOM selectors may need adjustment** - the M365 Copilot UI may change
5. **Reference PLAN.md** for architectural decisions and details
