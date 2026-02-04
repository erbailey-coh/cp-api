import { chromium, BrowserContext, Page } from 'playwright';
import * as fs from 'fs';
import * as os from 'os';
import { config } from '../utils/config';

/**
 * Detect if running in WSL2
 */
function isWSL(): boolean {
  try {
    const release = os.release().toLowerCase();
    return release.includes('wsl') || release.includes('microsoft');
  } catch {
    return false;
  }
}

/**
 * Get browser launch arguments based on environment
 */
function getBrowserArgs(headless: boolean): string[] {
  const baseArgs = [
    '--disable-blink-features=AutomationControlled',
    '--no-sandbox',
    '--disable-setuid-sandbox',
  ];

  // Additional args for WSL2 to improve stability
  if (isWSL()) {
    return [
      ...baseArgs,
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--disable-dev-shm-usage',
      // Use software rendering which works better in WSL2
      '--use-gl=swiftshader',
      // Ensure window is visible in headed mode
      '--window-position=100,100',
      '--window-size=1280,720',
      // Additional stability flags for WSL2
      '--disable-features=VizDisplayCompositor',
      '--force-device-scale-factor=1',
    ];
  }

  return baseArgs;
}

/**
 * Manages the browser instance and provides access to pages
 * Uses a singleton pattern to ensure only one browser instance
 */
class BrowserManager {
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private initialized = false;
  private initializing: Promise<void> | null = null;
  private currentHeadless = true;

  /**
   * Initialize the browser with persistent context
   * @param headless - Whether to run in headless mode
   */
  async initialize(headless: boolean = true): Promise<void> {
    // Prevent multiple simultaneous initializations
    if (this.initializing) {
      return this.initializing;
    }

    // If already initialized with different headless mode, close and reinitialize
    if (this.initialized && this.currentHeadless !== headless) {
      await this.close();
    }

    if (this.initialized) {
      return;
    }

    this.initializing = this.doInitialize(headless);
    await this.initializing;
    this.initializing = null;
  }

  private async doInitialize(headless: boolean): Promise<void> {
    const inWSL = isWSL();
    const dataDir = config.browserDataDir;

    if (inWSL) {
      console.log('[Browser] WSL2 environment detected - using bundled Chromium with WSL2-optimized settings');
    }

    // Ensure browser data directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    console.log(`[Browser] Launching browser (headless: ${headless})`);
    console.log(`[Browser] User data directory: ${dataDir}`);

    const args = getBrowserArgs(headless);

    // Build launch options
    const launchOptions: Parameters<typeof chromium.launchPersistentContext>[1] = {
      headless: headless,
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      args: args,
      // Use slower operations for stability in WSL2 or headed mode
      slowMo: (inWSL || !headless) ? 100 : 0,
      // Increase default timeout for WSL2
      timeout: inWSL ? 60000 : 30000,
    };

    // Launch browser with persistent context to maintain login state
    this.context = await chromium.launchPersistentContext(dataDir, launchOptions);

    // Get or create page
    const pages = this.context.pages();
    this.page = pages.length > 0 ? pages[0] : await this.context.newPage();

    // For headed mode, bring window to front
    if (!headless) {
      try {
        await this.page.bringToFront();
      } catch {
        // Ignore if this fails
      }
    }

    this.initialized = true;
    this.currentHeadless = headless;
    console.log('[Browser] Browser initialized successfully');
  }

  /**
   * Get the page instance, initializing if necessary
   */
  async getPage(): Promise<Page> {
    if (!this.initialized || !this.page) {
      await this.initialize(config.headless);
    }
    return this.page!;
  }

  /**
   * Check if the user is logged in to Microsoft by navigating to Copilot
   * Only use this for initial login check, not during login flow
   */
  async checkLoginStatus(): Promise<boolean> {
    // Use headless mode for quick check
    await this.initialize(true);
    const page = await this.getPage();

    try {
      // Navigate to Copilot
      await page.goto(config.copilotUrl, { timeout: config.navigationTimeout });

      // Wait for page to settle
      await page.waitForTimeout(3000);

      // Check if we landed on the Copilot page (logged in) or login page
      return this.isOnCopilotPage(page);
    } catch (error) {
      console.error('[Browser] Error checking login state:', error);
      return false;
    }
  }

  /**
   * Check if the current page is the Copilot chat page (indicates logged in)
   * This does NOT navigate - just checks current page state
   */
  private async isOnCopilotPage(page: Page): Promise<boolean> {
    try {
      const url = page.url();
      console.log(`[Browser] Checking URL: ${url}`);

      // If we're on a Microsoft login page, we're definitely not logged in
      if (url.includes('login.microsoftonline.com') ||
          url.includes('login.live.com') ||
          url.includes('login.microsoft.com') ||
          url.includes('duo.com') ||
          url.includes('duosecurity.com')) {
        return false;
      }

      // If we're on the Copilot chat page, we're logged in
      // Check for various possible URL patterns
      if (url.includes('m365.cloud.microsoft') ||
          url.includes('copilot.microsoft.com') ||
          url.includes('microsoft365.com')) {

        // URL looks right - just verify we're not on an error page
        // by checking the page has loaded something meaningful
        const pageContent = await page.content();

        // If page has substantial content and no login form, consider it logged in
        if (pageContent.length > 5000) {
          const hasLoginForm = await page.$('input[type="email"], input[type="password"]');
          if (!hasLoginForm) {
            console.log('[Browser] Detected Copilot page - login successful');
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      console.error('[Browser] Error checking page state:', error);
      return false;
    }
  }

  /**
   * Wait for login to complete by watching for navigation to Copilot
   * This does NOT interfere with the page - just observes URL changes
   */
  private async waitForLoginCompletion(page: Page, timeoutMs: number): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      // Just check the URL and page state without navigating
      const isLoggedIn = await this.isOnCopilotPage(page);

      if (isLoggedIn) {
        return true;
      }

      // Wait before checking again - don't interfere with the page
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return false;
  }

  /**
   * Open a headed browser for the user to log in
   * Returns true if login was successful
   */
  async performLogin(timeoutMs: number = 300000): Promise<boolean> {
    // Close any existing browser
    await this.close();

    const inWSL = isWSL();

    console.log('');
    console.log('┌' + '─'.repeat(58) + '┐');
    console.log('│' + ' '.repeat(18) + 'LOGIN REQUIRED' + ' '.repeat(26) + '│');
    console.log('├' + '─'.repeat(58) + '┤');
    console.log('│  A browser window will open. Please log in to your      │');
    console.log('│  Microsoft account to continue.                         │');
    console.log('│                                                         │');
    console.log('│  The window will close automatically once login is      │');
    console.log('│  detected. Your session will be saved for future use.   │');
    console.log('│                                                         │');
    console.log('│  Supports multi-step login (username, password, 2FA).   │');
    if (inWSL) {
      console.log('├' + '─'.repeat(58) + '┤');
      console.log('│  NOTE: Running in WSL2. If browser window appears       │');
      console.log('│  blank or unresponsive, try moving or resizing it.      │');
    }
    console.log('└' + '─'.repeat(58) + '┘');
    console.log('');

    // Open headed browser for login
    await this.initialize(false);
    const page = await this.getPage();

    // Navigate to Copilot (this will redirect to login if not authenticated)
    await page.goto(config.copilotUrl, { timeout: config.navigationTimeout });

    // For WSL2, try to force a repaint after navigation
    if (inWSL) {
      await page.waitForTimeout(1000);
      try {
        await page.evaluate('window.dispatchEvent(new Event("resize")); document.body.style.opacity = "0.99"; setTimeout(() => { document.body.style.opacity = "1"; }, 100);');
      } catch {
        // Ignore if this fails
      }
    }

    console.log('[Browser] Waiting for login (timeout: ' + Math.floor(timeoutMs / 60000) + ' minutes)...');
    console.log('[Browser] Complete all login steps (username, password, 2FA) in the browser window.');

    // Wait for login to complete without interfering
    const loggedIn = await this.waitForLoginCompletion(page, timeoutMs);

    if (loggedIn) {
      console.log('');
      console.log('┌' + '─'.repeat(58) + '┐');
      console.log('│' + ' '.repeat(17) + 'LOGIN SUCCESSFUL!' + ' '.repeat(24) + '│');
      console.log('│  Your session has been saved. The browser will now     │');
      console.log('│  switch to headless mode for normal operation.         │');
      console.log('└' + '─'.repeat(58) + '┘');
      console.log('');

      // Close headed browser and reopen in headless mode
      await this.close();
      await this.initialize(true);

      return true;
    }

    console.error('[Browser] Login timeout - user did not complete login in time');
    return false;
  }

  /**
   * Ensure the user is logged in, performing login flow if necessary
   * This is the main entry point for login handling
   */
  async ensureLoggedIn(): Promise<boolean> {
    console.log('[Browser] Checking login status...');

    // First, check if already logged in (headless)
    const alreadyLoggedIn = await this.checkLoginStatus();

    if (alreadyLoggedIn) {
      console.log('[Browser] Already logged in to Microsoft account');
      return true;
    }

    // Not logged in - need to perform login
    console.log('[Browser] Not logged in - starting login flow...');
    return this.performLogin();
  }

  /**
   * Close the browser and clean up
   */
  async close(): Promise<void> {
    if (this.context) {
      console.log('[Browser] Closing browser...');
      await this.context.close();
      this.context = null;
      this.page = null;
      this.initialized = false;
    }
  }

  /**
   * Check if browser is initialized and running
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Check if currently running in headless mode
   */
  isHeadless(): boolean {
    return this.currentHeadless;
  }

  /**
   * Get the browser context for creating new pages (sessions)
   */
  async getContext(): Promise<BrowserContext | null> {
    if (!this.initialized) {
      await this.initialize(config.headless);
    }
    return this.context;
  }
}

// Export singleton instance
export const browserManager = new BrowserManager();
