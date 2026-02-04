import * as path from 'path';
import * as os from 'os';

export const config = {
  // Server settings
  port: parseInt(process.env.PORT || '4891', 10),
  host: process.env.HOST || '0.0.0.0', // Bind to all interfaces for WSL2/Windows access

  // Browser settings
  browserDataDir: process.env.BROWSER_DATA_DIR || path.join(os.homedir(), '.copilot-shim', 'browser-data'),
  headless: process.env.HEADLESS !== 'false', // Default to headless, set HEADLESS=false for headed mode

  // Copilot settings
  copilotUrl: 'https://m365.cloud.microsoft/chat',

  // Timeouts (in milliseconds)
  navigationTimeout: 60000,
  responseTimeout: 120000, // Max time to wait for Copilot response
  loginCheckTimeout: 5000,

  // Request queue settings
  maxQueueSize: 100,
  requestTimeout: 180000, // Max time for a single request
};

export type Config = typeof config;
