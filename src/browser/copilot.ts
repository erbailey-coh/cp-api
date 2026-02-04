import { Page } from 'playwright';
import { browserManager } from './manager';
import { selectors } from './selectors';
import { config } from '../utils/config';
import { CopilotModel, modelsInMoreSection } from './models';
import {
  randomDelay,
  shortDelay,
  thinkingDelay,
  consideringDelay,
  jitterBeforeAction,
  jitterTimeout,
  getTypingDelay,
} from '../utils/humanize';

/**
 * Ensure page is on the Copilot chat page
 */
async function ensureOnCopilot(page: Page): Promise<void> {
  if (!page.url().includes('m365.cloud.microsoft/chat')) {
    console.log('[Copilot] Navigating to Copilot...');
    await page.goto(config.copilotUrl, { timeout: config.navigationTimeout });
    await thinkingDelay();
  }
}

/**
 * Navigate to the M365 Copilot chat page (legacy - uses default page)
 */
export async function navigateToCopilot(): Promise<Page> {
  const page = await browserManager.getPage();
  await ensureOnCopilot(page);
  return page;
}

/**
 * Select a model from the model dropdown
 */
export async function selectModelOnPage(page: Page, model: CopilotModel): Promise<void> {
  console.log(`[Copilot] Selecting model: ${model}`);

  try {
    // Small delay before interacting (like moving mouse to button)
    await jitterBeforeAction();

    // Click the model selector button to open dropdown
    const modelButton = await page.$(selectors.modelSelectorButton);
    if (!modelButton) {
      console.warn('[Copilot] Model selector button not found, skipping model selection');
      return;
    }

    await modelButton.click();

    // Wait for dropdown to open (human reaction time)
    await shortDelay();

    // If the model is in the "More" section, expand it first
    if (modelsInMoreSection.has(model)) {
      await jitterBeforeAction();
      const moreButton = await page.$(selectors.moreSection);
      if (moreButton) {
        await moreButton.click();
        await shortDelay();
      }
    }

    // Brief pause before selecting (like reading options)
    await jitterBeforeAction();

    // Click the target model option
    const modelOptionSelector = selectors.modelOption(model);
    await page.waitForSelector(modelOptionSelector, { timeout: jitterTimeout(5000) });
    await page.click(modelOptionSelector);

    // Wait for selection to register
    await shortDelay();

    console.log(`[Copilot] Model "${model}" selected successfully`);
  } catch (error) {
    console.error(`[Copilot] Error selecting model: ${error}`);
    // Try to close the dropdown if it's still open
    await shortDelay();
    await page.keyboard.press('Escape');
  }
}

/**
 * Select a model (legacy - uses default page)
 */
export async function selectModel(model: CopilotModel): Promise<void> {
  const page = await browserManager.getPage();
  await selectModelOnPage(page, model);
}

/**
 * Send a message on a specific page and return the response
 */
export async function sendMessageOnPage(page: Page, message: string): Promise<string> {
  console.log(`[Copilot] Sending message (${message.length} chars)...`);

  // Brief pause before starting to type (like positioning cursor)
  await jitterBeforeAction();

  // Find and fill the chat input
  const inputSelector = selectors.chatInput;
  await page.waitForSelector(inputSelector, { timeout: jitterTimeout(10000) });

  // Clear any existing text and type the new message
  const input = await page.$(inputSelector);
  if (!input) {
    throw new Error('Chat input not found');
  }

  // Focus and clear the input with natural timing
  await input.click();
  await randomDelay(50, 150);
  await page.keyboard.press('Control+A');
  await randomDelay(30, 100);
  await page.keyboard.press('Backspace');

  // Pause before typing (like preparing to type)
  await shortDelay();

  // Type the message with human-like character delays
  // For long messages, use fill() but add a thinking delay
  // For short messages, type character by character
  if (message.length > 200) {
    // Long message: use fill (faster) but add natural delays around it
    await thinkingDelay();
    await input.fill(message);
    await consideringDelay(); // Pause to "review" what was typed
  } else {
    // Short message: type with realistic delays
    const avgDelay = getTypingDelay();
    await page.type(inputSelector, message, { delay: avgDelay });
  }

  // Natural pause before hitting Enter (like reviewing the message)
  await randomDelay(300, 800);

  // Submit the message
  await page.keyboard.press('Enter');

  // Wait for response to complete
  const response = await waitForResponseOnPage(page);

  return response;
}

/**
 * Send a message (legacy - uses default page)
 */
export async function sendMessage(message: string): Promise<string> {
  const page = await browserManager.getPage();
  return sendMessageOnPage(page, message);
}

/**
 * Wait for Copilot to finish generating a response on a specific page
 */
async function waitForResponseOnPage(page: Page): Promise<string> {
  const startTime = Date.now();

  console.log('[Copilot] Waiting for response...');

  // Wait for the stop button to appear (indicates generation started)
  try {
    await page.waitForSelector(selectors.stopButton, { timeout: jitterTimeout(10000) });
    console.log('[Copilot] Response generation started');
  } catch {
    // Stop button might not appear for quick responses
    console.log('[Copilot] Stop button not detected, checking for response directly');
  }

  // Wait for the stop button to disappear (indicates generation complete)
  // Use variable polling interval for more natural behavior
  let responseComplete = false;
  while (!responseComplete && (Date.now() - startTime) < config.responseTimeout) {
    // Variable wait between checks (400-800ms)
    await randomDelay(400, 800);

    // Check if stop button is gone
    const stopButton = await page.$(selectors.stopButton);
    const loadingIndicator = await page.$(selectors.loadingIndicator);

    if (!stopButton && !loadingIndicator) {
      // Give it a moment to ensure rendering is complete (variable)
      await randomDelay(800, 1500);
      responseComplete = true;
    }
  }

  if (!responseComplete) {
    throw new Error('Response timeout - Copilot took too long to respond');
  }

  console.log('[Copilot] Response complete, extracting text...');

  // Small delay before extracting (like reading the response)
  await shortDelay();

  // Extract the response text
  const response = await extractLastResponseFromPage(page);

  return response;
}

/**
 * Extract the last assistant response from a specific page
 */
async function extractLastResponseFromPage(page: Page): Promise<string> {
  // Try multiple selectors to find the response
  const possibleSelectors = [
    selectors.lastAssistantMessage,
    selectors.assistantMessage,
    selectors.responseContainer,
  ];

  for (const selector of possibleSelectors) {
    try {
      const elements = await page.$$(selector);
      if (elements.length > 0) {
        // Get the last element (most recent response)
        const lastElement = elements[elements.length - 1];
        const text = await lastElement.textContent();
        if (text && text.trim()) {
          return text.trim();
        }
      }
    } catch {
      continue;
    }
  }

  // Fallback: try to get text from any message-like container
  try {
    const allMessages = await page.$$('[class*="message"], [data-testid*="message"]');
    if (allMessages.length > 0) {
      const lastMessage = allMessages[allMessages.length - 1];
      const text = await lastMessage.textContent();
      if (text) {
        return text.trim();
      }
    }
  } catch {
    // Ignore fallback errors
  }

  throw new Error('Could not extract response from page');
}

/**
 * Start a new chat conversation on a specific page
 */
export async function startNewChatOnPage(page: Page): Promise<void> {
  console.log('[Copilot] Starting new chat...');

  try {
    // Pause before clicking (like deciding to start fresh)
    await consideringDelay();

    const newChatButton = await page.$(selectors.newChatButton);
    if (newChatButton) {
      await jitterBeforeAction();
      await newChatButton.click();

      // Wait for new chat to initialize
      await thinkingDelay();
      console.log('[Copilot] New chat started');
    } else {
      // If no button found, try navigating to a fresh page
      await page.goto(config.copilotUrl, { timeout: config.navigationTimeout });
      await thinkingDelay();
    }
  } catch (error) {
    console.error('[Copilot] Error starting new chat:', error);
  }
}

/**
 * Start a new chat (legacy - uses default page)
 */
export async function startNewChat(): Promise<void> {
  const page = await browserManager.getPage();
  await startNewChatOnPage(page);
}

/**
 * Send a chat completion request on a specific page (session)
 * This is the session-aware version
 */
export async function chatCompletionOnPage(
  page: Page,
  message: string,
  model: CopilotModel,
  isFirstMessage: boolean
): Promise<string> {
  // Ensure we're on the Copilot page
  await ensureOnCopilot(page);

  // Small delay before interacting (like orienting on the page)
  await shortDelay();

  // On first message, start a fresh chat to avoid picking up old conversations
  if (isFirstMessage) {
    // Start a new chat to ensure we're not continuing an old conversation
    await startNewChatOnPage(page);
    await shortDelay();

    // Select the requested model
    await selectModelOnPage(page, model);
    await shortDelay();
  }

  // Send the message and get the response
  const response = await sendMessageOnPage(page, message);

  // Small delay after receiving response (like reading it)
  await shortDelay();

  return response;
}

/**
 * Send a chat completion request to Copilot (legacy - stateless)
 * This is the main entry point for the API without sessions
 */
export async function chatCompletion(
  messages: Array<{ role: string; content: string }>,
  model: CopilotModel
): Promise<string> {
  // Ensure we're on the Copilot page
  await navigateToCopilot();

  // Small delay before interacting (like orienting on the page)
  await shortDelay();

  // Select the requested model
  await selectModel(model);

  // Brief pause between model selection and typing
  await shortDelay();

  // Combine all messages into a single prompt
  // (Copilot doesn't have a native way to handle message history)
  const prompt = formatMessagesAsPrompt(messages);

  // Send the message and get the response
  const response = await sendMessage(prompt);

  // Small delay after receiving response (like reading it)
  await shortDelay();

  return response;
}

/**
 * Format OpenAI-style messages into a single prompt string
 * Used for stateless mode when there's no active session
 */
export function formatMessagesAsPrompt(
  messages: Array<{ role: string; content: string }>
): string {
  if (messages.length === 1) {
    return messages[0].content;
  }

  // For multiple messages, format them with role prefixes
  return messages
    .map((msg) => {
      if (msg.role === 'system') {
        return `[System Instructions]\n${msg.content}`;
      } else if (msg.role === 'assistant') {
        return `[Previous Assistant Response]\n${msg.content}`;
      } else {
        return msg.content;
      }
    })
    .join('\n\n');
}
