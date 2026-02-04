import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ErrorResponse,
} from '../types/openai';
import {
  getCopilotModel,
  isValidModel,
  createModelNotFoundError,
  getAvailableModels,
} from '../browser/models';
import { chatCompletionOnPage, formatMessagesAsPrompt } from '../browser/copilot';
import { sessionManager } from '../browser/sessions';
import { requestQueue } from './queue';

/**
 * Handle POST /v1/chat/completions
 * Supports both stateless and session-based conversations
 */
export async function handleChatCompletion(
  req: Request,
  res: Response
): Promise<void> {
  const body = req.body as ChatCompletionRequest;

  // Validate request
  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    const error: ErrorResponse = {
      error: {
        message: 'messages is required and must be a non-empty array',
        type: 'invalid_request_error',
        code: 'invalid_messages',
      },
    };
    res.status(400).json(error);
    return;
  }

  // Check if streaming is requested (not supported)
  if (body.stream) {
    const error: ErrorResponse = {
      error: {
        message: 'Streaming is not supported by this server',
        type: 'invalid_request_error',
        code: 'streaming_not_supported',
      },
    };
    res.status(400).json(error);
    return;
  }

  // Validate model if specified
  const requestedModel = body.model;
  if (requestedModel && !isValidModel(requestedModel)) {
    res.status(400).json(createModelNotFoundError(requestedModel));
    return;
  }

  // Get the Copilot model to use
  const copilotModel = getCopilotModel(requestedModel);

  // Check for session_id (multi-turn conversation support)
  const requestedSessionId = body.session_id;
  const isExistingSession = requestedSessionId && sessionManager.hasSession(requestedSessionId);

  console.log(`[API] Chat completion request: model=${requestedModel || 'default'} -> ${copilotModel}`);
  console.log(`[API] Messages count: ${body.messages.length}, session_id: ${requestedSessionId || 'none'}`);

  try {
    // Get or create session
    const session = await sessionManager.getOrCreateSession(requestedSessionId);
    const isFirstMessage = session.messageCount === 0;

    console.log(`[API] Using session: ${session.id} (first message: ${isFirstMessage})`);

    // Determine what message to send
    // For sessions: only send the last user message (conversation history is maintained in Copilot)
    // For new sessions with system message: format system + user message together for first message
    let messageToSend: string;

    if (isFirstMessage) {
      // First message in session - include system message if present
      messageToSend = formatMessagesAsPrompt(body.messages);
    } else {
      // Continuing conversation - only send the last user message
      const lastUserMessage = [...body.messages].reverse().find(m => m.role === 'user');
      if (!lastUserMessage) {
        const error: ErrorResponse = {
          error: {
            message: 'No user message found in messages array',
            type: 'invalid_request_error',
            code: 'no_user_message',
          },
        };
        res.status(400).json(error);
        return;
      }
      messageToSend = lastUserMessage.content;
    }

    // Queue the request to ensure sequential processing
    // Each session's page is isolated, but we still queue to prevent race conditions
    const responseText = await requestQueue.enqueue(async () => {
      return await chatCompletionOnPage(
        session.page,
        messageToSend,
        copilotModel,
        isFirstMessage
      );
    });

    // Update session activity
    sessionManager.touchSession(session.id);

    // Format response in OpenAI format
    const response: ChatCompletionResponse = {
      id: `chatcmpl-${uuidv4()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: requestedModel || 'copilot-auto',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: responseText,
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 0, // Not available from Copilot
        completion_tokens: 0,
        total_tokens: 0,
      },
      // Include session_id so client can continue the conversation
      session_id: session.id,
    };

    console.log(`[API] Response generated: ${responseText.length} chars, session: ${session.id}`);
    res.json(response);
  } catch (error) {
    console.error('[API] Error processing chat completion:', error);

    const errorResponse: ErrorResponse = {
      error: {
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        type: 'server_error',
        code: 'internal_error',
      },
    };
    res.status(500).json(errorResponse);
  }
}

/**
 * Handle GET /v1/models
 */
export async function handleListModels(
  _req: Request,
  res: Response
): Promise<void> {
  console.log('[API] List models request');
  res.json(getAvailableModels());
}

/**
 * Handle GET /health
 */
export async function handleHealthCheck(
  _req: Request,
  res: Response
): Promise<void> {
  const sessionStats = sessionManager.getStats();

  const status = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    queue: {
      pending: requestQueue.getPendingCount(),
      processing: requestQueue.isProcessing(),
    },
    sessions: {
      active: sessionStats.activeSessions,
      max: sessionStats.maxSessions,
    },
  };

  res.json(status);
}

/**
 * Handle GET /v1/sessions
 * List all active sessions
 */
export async function handleListSessions(
  _req: Request,
  res: Response
): Promise<void> {
  console.log('[API] List sessions request');
  res.json(sessionManager.getStats());
}

/**
 * Handle DELETE /v1/sessions/:id
 * Close a specific session
 */
export async function handleDeleteSession(
  req: Request,
  res: Response
): Promise<void> {
  const sessionId = req.params.id;
  console.log(`[API] Delete session request: ${sessionId}`);

  const closed = await sessionManager.closeSession(sessionId);

  if (closed) {
    res.json({ success: true, message: `Session ${sessionId} closed` });
  } else {
    const error: ErrorResponse = {
      error: {
        message: `Session ${sessionId} not found`,
        type: 'invalid_request_error',
        code: 'session_not_found',
      },
    };
    res.status(404).json(error);
  }
}
