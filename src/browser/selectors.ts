/**
 * DOM selectors for the M365 Copilot Chat interface
 * These may need to be updated as Microsoft changes their UI
 */

export const selectors = {
  // Model selector (top-right dropdown)
  modelSelectorButton: '[data-testid="model-selector"], button:has-text("Auto"), button:has-text("Quick response"), button:has-text("Think deeper")',
  modelDropdown: '[role="listbox"], [role="menu"]',
  modelOption: (modelName: string) => `[role="option"]:has-text("${modelName}"), [role="menuitem"]:has-text("${modelName}"), button:has-text("${modelName}")`,
  moreSection: 'button:has-text("More"), [aria-expanded]:has-text("More")',

  // Chat input area
  chatInput: 'textarea[placeholder*="Message"], textarea[aria-label*="Message"], [contenteditable="true"]',
  submitButton: 'button[type="submit"], button[aria-label*="Send"], button[aria-label*="Submit"]',

  // Response area
  responseContainer: '[data-testid="message-content"], .message-content, [class*="response"]',
  assistantMessage: '[data-testid="assistant-message"], [data-message-author="assistant"]',
  lastAssistantMessage: '[data-testid="assistant-message"]:last-of-type, [data-message-author="assistant"]:last-of-type',

  // Loading/completion indicators
  stopButton: 'button:has-text("Stop"), button[aria-label*="Stop"]',
  loadingIndicator: '[data-testid="loading"], [class*="loading"], [class*="typing"]',

  // New chat / conversation controls
  newChatButton: 'button:has-text("New chat"), [aria-label*="New chat"]',

  // Login detection
  loginForm: 'input[type="email"], input[type="password"], form[action*="login"]',
  signInButton: 'button:has-text("Sign in"), input[type="submit"]',
  userProfile: '[data-testid="user-profile"], [aria-label*="Account"], img[alt*="profile"]',

  // Welcome/landing page detection
  welcomeMessage: 'text="Welcome to Copilot Chat"',
};

export type Selectors = typeof selectors;
