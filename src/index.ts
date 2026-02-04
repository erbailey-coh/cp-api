import express from 'express';
import cors from 'cors';
import { router } from './api/routes';
import { config } from './utils/config';
import { browserManager } from './browser/manager';
import { requestQueue } from './api/queue';

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Routes
app.use(router);

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Server] Unhandled error:', err);
  res.status(500).json({
    error: {
      message: 'Internal server error',
      type: 'server_error',
      code: 'internal_error',
    },
  });
});

// Graceful shutdown handler
async function shutdown(signal: string): Promise<void> {
  console.log(`\n[Server] Received ${signal}, shutting down gracefully...`);

  // Clear pending requests
  requestQueue.clear();

  // Close browser
  await browserManager.close();

  console.log('[Server] Shutdown complete');
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Start server
async function main(): Promise<void> {
  console.log('');
  console.log('╔' + '═'.repeat(58) + '╗');
  console.log('║' + ' '.repeat(8) + 'Copilot Shim - OpenAI API Proxy' + ' '.repeat(18) + '║');
  console.log('║' + ' '.repeat(12) + 'for Microsoft 365 Copilot' + ' '.repeat(21) + '║');
  console.log('╚' + '═'.repeat(58) + '╝');
  console.log('');

  // Ensure user is logged in (will open browser if needed)
  const loggedIn = await browserManager.ensureLoggedIn();

  if (!loggedIn) {
    console.error('[Server] Login failed or timed out. Please restart and try again.');
    process.exit(1);
  }

  // Start HTTP server - bind to all interfaces for WSL2/Windows access
  app.listen(config.port, config.host, () => {
    console.log('');
    console.log('┌' + '─'.repeat(58) + '┐');
    console.log('│' + ' '.repeat(19) + 'SERVER READY' + ' '.repeat(27) + '│');
    console.log('├' + '─'.repeat(58) + '┤');
    console.log(`│  URL: http://localhost:${config.port}` + ' '.repeat(35 - config.port.toString().length) + '│');
    console.log('│' + ' '.repeat(58) + '│');
    console.log('│  Endpoints:                                              │');
    console.log('│    POST /v1/chat/completions  - Chat with Copilot        │');
    console.log('│    GET  /v1/models            - List available models    │');
    console.log('│    GET  /v1/sessions          - List active sessions     │');
    console.log('│    DELETE /v1/sessions/:id    - Close a session          │');
    console.log('│    GET  /health               - Health check             │');
    console.log('└' + '─'.repeat(58) + '┘');
    console.log('');
    console.log('Example:');
    console.log(`  curl http://localhost:${config.port}/v1/chat/completions \\`);
    console.log('    -H "Content-Type: application/json" \\');
    console.log('    -d \'{"model": "copilot-auto", "messages": [{"role": "user", "content": "Hello"}]}\'');
    console.log('');
    console.log('Press Ctrl+C to stop the server');
    console.log('');
  });
}

main().catch((error) => {
  console.error('[Server] Fatal error:', error);
  process.exit(1);
});
