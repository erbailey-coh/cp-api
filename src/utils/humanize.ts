/**
 * Utilities for adding human-like behavior to browser interactions
 * Adds natural variability to timing and interactions
 */

/**
 * Sleep for a random duration within a range
 * @param minMs - Minimum milliseconds
 * @param maxMs - Maximum milliseconds
 */
export async function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  await new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Add a small jitter delay (50-150ms) - for between micro-actions
 */
export async function microDelay(): Promise<void> {
  await randomDelay(50, 150);
}

/**
 * Add a short delay (200-600ms) - like human reaction time
 */
export async function shortDelay(): Promise<void> {
  await randomDelay(200, 600);
}

/**
 * Add a medium delay (800-2000ms) - like reading/thinking time
 */
export async function thinkingDelay(): Promise<void> {
  await randomDelay(800, 2000);
}

/**
 * Add a longer delay (1500-4000ms) - like considering options
 */
export async function consideringDelay(): Promise<void> {
  await randomDelay(1500, 4000);
}

/**
 * Calculate typing delay per character (humans type ~200-400 chars/min)
 * Returns delay in ms per character with variability
 */
export function getTypingDelay(): number {
  // Average 40-80ms per character, with occasional pauses
  const baseDelay = Math.random() * 40 + 40; // 40-80ms

  // 10% chance of a longer pause (like thinking while typing)
  if (Math.random() < 0.1) {
    return baseDelay + Math.random() * 200 + 100; // extra 100-300ms
  }

  return baseDelay;
}

/**
 * Type text with human-like delays between characters
 * @param page - Playwright page
 * @param selector - Element selector
 * @param text - Text to type
 */
export async function humanType(
  page: { type: (selector: string, text: string, options?: { delay?: number }) => Promise<void> },
  selector: string,
  text: string
): Promise<void> {
  // Type with variable delay per character
  const avgDelay = 50 + Math.random() * 30; // 50-80ms average
  await page.type(selector, text, { delay: avgDelay });
}

/**
 * Add random mouse movement jitter before clicking
 * Simulates human mouse behavior
 */
export async function jitterBeforeAction(): Promise<void> {
  // Random short delay before action (like moving mouse to target)
  await randomDelay(100, 400);
}

/**
 * Simulate reading content on the page
 * @param contentLength - Approximate length of content
 */
export async function simulateReading(contentLength: number): Promise<void> {
  // Average reading speed: ~200-300 words per minute
  // Assuming ~5 chars per word, that's ~1000-1500 chars per minute
  // So roughly 40-60ms per character for reading
  const readingTimeMs = contentLength * (40 + Math.random() * 20);

  // Cap at reasonable max (30 seconds) and min (500ms)
  const cappedTime = Math.max(500, Math.min(30000, readingTimeMs));

  await new Promise((resolve) => setTimeout(resolve, cappedTime));
}

/**
 * Add variability to a base timeout value
 * @param baseMs - Base timeout in milliseconds
 * @param variabilityPercent - Percentage of variability (default 20%)
 */
export function jitterTimeout(baseMs: number, variabilityPercent: number = 20): number {
  const variability = baseMs * (variabilityPercent / 100);
  const jitter = (Math.random() * 2 - 1) * variability; // -variability to +variability
  return Math.floor(baseMs + jitter);
}
