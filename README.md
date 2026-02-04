# Copilot Shim

An OpenAI-compatible API server that proxies requests to Microsoft 365 Copilot.

## Features

- **OpenAI API Compatible** - Use any OpenAI client library with Microsoft 365 Copilot
- **Multi-session Support** - Maintain multiple concurrent conversations
- **Model Selection** - Map OpenAI model names to Copilot models (Auto, Quick response, Think deeper)
- **Simple CLI** - Start and stop the server with simple commands

## Installation

```bash
# Clone the repository
git clone <repo-url>
cd copilot-shim

# Install dependencies
npm install

# Build the project
npm run build

# Link the CLI globally (optional)
npm link
```

## Usage

### CLI Commands

```bash
# Start the server (foreground)
cp-api start

# Start in background (uses PM2)
cp-api start --background

# Stop the server
cp-api stop

# Check server status
cp-api status

# View logs
cp-api logs

# Follow logs in real-time
cp-api logs --follow
```

### First Run

On first run, a browser window will open for you to log in to your Microsoft 365 account. After authentication, the browser session is saved and subsequent runs will use the cached credentials.

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/chat/completions` | Send a message to Copilot |
| GET | `/v1/models` | List available models |
| GET | `/v1/sessions` | List active sessions |
| DELETE | `/v1/sessions/:id` | Close a session |
| GET | `/health` | Health check |

### Example Request

```bash
curl http://localhost:4891/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "copilot-auto",
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
    ]
  }'
```

### Multi-turn Conversations

Use the `session_id` field to maintain conversation context:

```bash
# First message - get a session_id from the response
curl http://localhost:4891/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "copilot-auto", "messages": [{"role": "user", "content": "My name is Alice"}]}'

# Follow-up message - include the session_id
curl http://localhost:4891/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "copilot-auto",
    "session_id": "<session-id-from-previous-response>",
    "messages": [{"role": "user", "content": "What is my name?"}]
  }'
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4891` | Server port |
| `HOST` | `0.0.0.0` | Server bind address |
| `HEADLESS` | `true` | Run browser in headless mode |
| `BROWSER_DATA_DIR` | `./browser-data` | Browser profile directory |

### Model Mapping

| OpenAI Model | Copilot Model |
|--------------|---------------|
| `gpt-4o`, `gpt-4`, `gpt-3.5-turbo` | Quick response |
| `o1`, `o1-mini`, `o1-preview` | Think deeper |
| `gpt-5.2`, `gpt-5` | GPT-5.2 Quick response |
| `o3`, `o3-mini` | GPT-5.2 Think deeper |
| `copilot-auto` | Auto |

## Development

```bash
# Build and run in one command
npm run dev

# Build only
npm run build

# Start the server directly
npm start
```

## Requirements

- Node.js 18+
- Microsoft 365 account with Copilot access
- Display server (for initial login) - WSL2 users need WSLg or an X server

## License

ISC
