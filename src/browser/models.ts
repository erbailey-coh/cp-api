import { Model, ModelsResponse, ErrorResponse } from '../types/openai';

// Copilot model identifiers as they appear in the UI
export enum CopilotModel {
  Auto = 'Auto',
  Quick = 'Quick response',
  Think = 'Think deeper',
  GPT52Quick = 'GPT-5.2 Quick response',
  GPT52Think = 'GPT-5.2 Think deeper',
}

// Whether the model is in the "More" section (requires expanding)
export const modelsInMoreSection = new Set([
  CopilotModel.GPT52Quick,
  CopilotModel.GPT52Think,
]);

// Mapping from OpenAI-style model names to Copilot models
const modelMapping: Record<string, CopilotModel> = {
  // Auto model
  'copilot-auto': CopilotModel.Auto,
  'auto': CopilotModel.Auto,

  // Quick response model
  'copilot-quick': CopilotModel.Quick,
  'gpt-4o': CopilotModel.Quick,
  'gpt-4o-mini': CopilotModel.Quick,
  'gpt-4': CopilotModel.Quick,
  'gpt-3.5-turbo': CopilotModel.Quick,

  // Think deeper model
  'copilot-think': CopilotModel.Think,
  'o1': CopilotModel.Think,
  'o1-mini': CopilotModel.Think,
  'o1-preview': CopilotModel.Think,

  // GPT-5.2 Quick response
  'gpt-5.2': CopilotModel.GPT52Quick,
  'gpt-5.2-quick': CopilotModel.GPT52Quick,
  'gpt-5': CopilotModel.GPT52Quick,

  // GPT-5.2 Think deeper
  'gpt-5.2-think': CopilotModel.GPT52Think,
  'o3': CopilotModel.GPT52Think,
  'o3-mini': CopilotModel.GPT52Think,
};

// Default model when none specified or unrecognized
export const defaultModel = CopilotModel.Auto;

// List of available model names for the API
export const availableModelNames = [
  'copilot-auto',
  'copilot-quick',
  'copilot-think',
  'gpt-5.2-quick',
  'gpt-5.2-think',
];

/**
 * Map an OpenAI-style model name to a Copilot model
 * Returns null if the model is not recognized
 */
export function mapModelName(modelName: string): CopilotModel | null {
  const normalized = modelName.toLowerCase().trim();
  return modelMapping[normalized] || null;
}

/**
 * Get a Copilot model, using default if not specified or not found
 */
export function getCopilotModel(modelName?: string): CopilotModel {
  if (!modelName) {
    return defaultModel;
  }
  return mapModelName(modelName) || defaultModel;
}

/**
 * Check if a model name is valid/supported
 */
export function isValidModel(modelName: string): boolean {
  return mapModelName(modelName) !== null;
}

/**
 * Create an error response for invalid model
 */
export function createModelNotFoundError(modelName: string): ErrorResponse {
  return {
    error: {
      message: `Model '${modelName}' is not supported. Available models: ${availableModelNames.join(', ')}`,
      type: 'invalid_request_error',
      code: 'model_not_found',
    },
  };
}

/**
 * Get the list of available models in OpenAI format
 */
export function getAvailableModels(): ModelsResponse {
  const now = Math.floor(Date.now() / 1000);

  const models: Model[] = availableModelNames.map((id) => ({
    id,
    object: 'model' as const,
    created: now,
    owned_by: 'microsoft-copilot',
  }));

  return {
    object: 'list',
    data: models,
  };
}
