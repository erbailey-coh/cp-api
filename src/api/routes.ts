import { Router, Request, Response, NextFunction } from 'express';
import {
  handleChatCompletion,
  handleListModels,
  handleHealthCheck,
  handleListSessions,
  handleDeleteSession,
} from './handlers';

const router = Router();

// Request logging middleware
router.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[HTTP] ${req.method} ${req.path}`);
  next();
});

// OpenAI-compatible endpoints
router.post('/v1/chat/completions', handleChatCompletion);
router.get('/v1/models', handleListModels);

// Session management endpoints
router.get('/v1/sessions', handleListSessions);
router.delete('/v1/sessions/:id', handleDeleteSession);

// Also support without /v1 prefix for convenience
router.post('/chat/completions', handleChatCompletion);
router.get('/models', handleListModels);
router.get('/sessions', handleListSessions);
router.delete('/sessions/:id', handleDeleteSession);

// Health check endpoint
router.get('/health', handleHealthCheck);
router.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'copilot-shim',
    description: 'OpenAI-compatible API proxy for Microsoft 365 Copilot',
    version: '1.0.0',
    features: {
      multi_turn_conversations: 'Use session_id parameter to continue conversations',
      session_timeout: '30 minutes of inactivity',
      max_concurrent_sessions: 10,
    },
    endpoints: {
      chat_completions: 'POST /v1/chat/completions',
      models: 'GET /v1/models',
      sessions: 'GET /v1/sessions',
      delete_session: 'DELETE /v1/sessions/:id',
      health: 'GET /health',
    },
  });
});

export { router };
