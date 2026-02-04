export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  // Session support - allows multi-turn conversations
  session_id?: string;
}

export interface ChatCompletionChoice {
  index: number;
  message: ChatMessage;
  finish_reason: 'stop' | 'length' | 'content_filter' | null;
}

export interface ChatCompletionUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage: ChatCompletionUsage;
  // Session support - returned for multi-turn conversations
  session_id?: string;
}

export interface Model {
  id: string;
  object: 'model';
  created: number;
  owned_by: string;
}

export interface ModelsResponse {
  object: 'list';
  data: Model[];
}

export interface ErrorResponse {
  error: {
    message: string;
    type: string;
    code: string;
  };
}

export interface SessionInfo {
  id: string;
  createdAt: number;
  lastActivityAt: number;
  messageCount: number;
  idleMinutes: number;
}

export interface SessionsResponse {
  activeSessions: number;
  maxSessions: number;
  sessions: SessionInfo[];
}
