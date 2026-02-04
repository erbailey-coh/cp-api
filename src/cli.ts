#!/usr/bin/env node
/**
 * Copilot Shim CLI
 * A simple CLI for managing the Copilot Shim API server
 */

import { spawn, execSync, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';

const VERSION = '1.0.0';
const SERVICE_NAME = 'copilot-shim';

// Colors for terminal output
const colors = {
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  blue: (s: string) => `\x1b[34m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

// Get the package root directory (where dist/ is located)
function getPackageRoot(): string {
  // When running from dist/cli.js, go up one level
  return path.resolve(__dirname, '..');
}

// Get the PID file path
function getPidFile(): string {
  const dataDir = process.env.COPILOT_SHIM_DATA_DIR || path.join(getPackageRoot(), '.copilot-shim');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, 'server.pid');
}

// Get logs directory
function getLogsDir(): string {
  const logsDir = path.join(getPackageRoot(), 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  return logsDir;
}

// Check if PM2 is available
function hasPm2(): boolean {
  try {
    execSync('pm2 --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Check if the server is running by checking the health endpoint
async function isServerRunning(port: number = 4891): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/health`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

// Get server health info
async function getHealthInfo(port: number = 4891): Promise<any | null> {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/health`, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(null);
    });
  });
}

// Read PID from file
function readPid(): number | null {
  const pidFile = getPidFile();
  if (fs.existsSync(pidFile)) {
    try {
      const pid = parseInt(fs.readFileSync(pidFile, 'utf-8').trim(), 10);
      return isNaN(pid) ? null : pid;
    } catch {
      return null;
    }
  }
  return null;
}

// Write PID to file
function writePid(pid: number): void {
  fs.writeFileSync(getPidFile(), pid.toString());
}

// Remove PID file
function removePid(): void {
  const pidFile = getPidFile();
  if (fs.existsSync(pidFile)) {
    fs.unlinkSync(pidFile);
  }
}

// Check if a process is running
function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// Start the server in foreground
async function startForeground(): Promise<void> {
  const serverPath = path.join(getPackageRoot(), 'dist', 'index.js');

  if (!fs.existsSync(serverPath)) {
    console.error(colors.red('Error: Server not built. Run "npm run build" first.'));
    process.exit(1);
  }

  // Check if already running
  const port = parseInt(process.env.PORT || '4891', 10);
  if (await isServerRunning(port)) {
    console.error(colors.yellow(`Server is already running on port ${port}`));
    process.exit(1);
  }

  // Import and run the server directly
  require(serverPath);
}

// Start the server in background using PM2
async function startBackground(): Promise<void> {
  const port = parseInt(process.env.PORT || '4891', 10);

  // Check if already running
  if (await isServerRunning(port)) {
    console.error(colors.yellow(`Server is already running on port ${port}`));
    process.exit(1);
  }

  if (!hasPm2()) {
    console.log(colors.yellow('PM2 not found. Installing PM2 for background process management...'));
    try {
      execSync('npm install -g pm2', { stdio: 'inherit' });
    } catch {
      console.error(colors.red('Failed to install PM2. Please install it manually: npm install -g pm2'));
      process.exit(1);
    }
  }

  const packageRoot = getPackageRoot();
  const ecosystemConfig = path.join(packageRoot, 'ecosystem.config.js');

  console.log(colors.blue('Starting Copilot Shim in background...'));

  try {
    if (fs.existsSync(ecosystemConfig)) {
      execSync(`pm2 start ${ecosystemConfig}`, {
        cwd: packageRoot,
        stdio: 'inherit'
      });
    } else {
      // Start directly with pm2
      const serverPath = path.join(packageRoot, 'dist', 'index.js');
      execSync(`pm2 start ${serverPath} --name ${SERVICE_NAME}`, {
        cwd: packageRoot,
        stdio: 'inherit'
      });
    }
    console.log(colors.green('Server started successfully!'));
    console.log(`\nCheck status with: ${colors.cyan('copilot-shim status')}`);
    console.log(`View logs with: ${colors.cyan('copilot-shim logs')}`);
  } catch (error) {
    console.error(colors.red('Failed to start server'));
    process.exit(1);
  }
}

// Stop the server
async function stopServer(): Promise<void> {
  const port = parseInt(process.env.PORT || '4891', 10);

  if (hasPm2()) {
    console.log(colors.blue('Stopping Copilot Shim...'));
    try {
      execSync(`pm2 stop ${SERVICE_NAME}`, { stdio: 'inherit' });
      console.log(colors.green('Server stopped.'));
    } catch {
      // PM2 process might not exist, check if server is running another way
      if (await isServerRunning(port)) {
        console.log(colors.yellow('Server is running but not managed by PM2.'));
        console.log('If running in foreground, press Ctrl+C in that terminal.');
      } else {
        console.log(colors.yellow('Server is not running.'));
      }
    }
  } else {
    // Try to find and kill the process
    const pid = readPid();
    if (pid && isProcessRunning(pid)) {
      process.kill(pid, 'SIGTERM');
      removePid();
      console.log(colors.green('Server stopped.'));
    } else if (await isServerRunning(port)) {
      console.log(colors.yellow('Server is running but PID unknown.'));
      console.log('If running in foreground, press Ctrl+C in that terminal.');
    } else {
      console.log(colors.yellow('Server is not running.'));
    }
  }
}

// Restart the server
async function restartServer(): Promise<void> {
  if (hasPm2()) {
    console.log(colors.blue('Restarting Copilot Shim...'));
    try {
      execSync(`pm2 restart ${SERVICE_NAME}`, { stdio: 'inherit' });
      console.log(colors.green('Server restarted.'));
    } catch {
      // If restart fails, try starting fresh
      await startBackground();
    }
  } else {
    await stopServer();
    await startBackground();
  }
}

// Show server status
async function showStatus(): Promise<void> {
  const port = parseInt(process.env.PORT || '4891', 10);

  console.log(colors.bold('\nCopilot Shim Status\n'));

  // Check if server is responding
  const health = await getHealthInfo(port);

  if (health) {
    console.log(`  Status: ${colors.green('● Running')}`);
    console.log(`  URL: http://localhost:${port}`);
    console.log(`  Queue: ${health.queue?.pending || 0} pending, ${health.queue?.processing || 0} processing`);
    console.log(`  Sessions: ${health.sessions?.active || 0} active`);
    console.log(`  Uptime: ${formatUptime(health.uptime)}`);
  } else {
    console.log(`  Status: ${colors.red('○ Stopped')}`);
  }

  // Show PM2 status if available
  if (hasPm2()) {
    console.log('\n' + colors.bold('PM2 Process:\n'));
    try {
      execSync(`pm2 show ${SERVICE_NAME} 2>/dev/null || echo "  Not managed by PM2"`, {
        stdio: 'inherit'
      });
    } catch {
      console.log('  Not managed by PM2');
    }
  }

  console.log('');
}

// Format uptime in human readable format
function formatUptime(seconds: number): string {
  if (!seconds) return 'unknown';

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}

// Show logs
async function showLogs(follow: boolean = false): Promise<void> {
  if (hasPm2()) {
    const args = follow ? '' : '--lines 50';
    try {
      execSync(`pm2 logs ${SERVICE_NAME} ${args}`, { stdio: 'inherit' });
    } catch {
      console.log(colors.yellow('No logs available or service not found.'));
    }
  } else {
    const logsDir = getLogsDir();
    const logFile = path.join(logsDir, 'copilot-shim.log');

    if (fs.existsSync(logFile)) {
      if (follow) {
        const tail = spawn('tail', ['-f', logFile], { stdio: 'inherit' });
        process.on('SIGINT', () => tail.kill());
      } else {
        execSync(`tail -n 50 ${logFile}`, { stdio: 'inherit' });
      }
    } else {
      console.log(colors.yellow('No logs found. Start the server first.'));
    }
  }
}

// Print help
function printHelp(): void {
  console.log(`
${colors.bold('Copilot Shim')} - OpenAI-compatible API proxy for Microsoft 365 Copilot

${colors.bold('USAGE:')}
  cp-api <command> [options]

${colors.bold('COMMANDS:')}
  ${colors.cyan('start')}              Start the server (foreground)
  ${colors.cyan('start --background')} Start the server in background (using PM2)
  ${colors.cyan('stop')}               Stop the background server
  ${colors.cyan('restart')}            Restart the background server
  ${colors.cyan('status')}             Show server status
  ${colors.cyan('logs')}               Show recent logs
  ${colors.cyan('logs --follow')}      Follow logs in real-time
  ${colors.cyan('help')}               Show this help message
  ${colors.cyan('version')}            Show version

${colors.bold('ENVIRONMENT VARIABLES:')}
  PORT                    Server port (default: 4891)
  HOST                    Server host (default: 0.0.0.0)
  HEADLESS                Run browser headless (default: true)
  BROWSER_DATA_DIR        Browser profile directory

${colors.bold('EXAMPLES:')}
  ${colors.yellow('# Start in foreground (for development)')}
  cp-api start

  ${colors.yellow('# Start in background (for production)')}
  cp-api start --background

  ${colors.yellow('# Check status')}
  cp-api status

  ${colors.yellow('# Stop the server')}
  cp-api stop

${colors.bold('API USAGE:')}
  curl http://localhost:4891/v1/chat/completions \\
    -H "Content-Type: application/json" \\
    -d '{"model": "copilot-auto", "messages": [{"role": "user", "content": "Hello"}]}'
`);
}

// Print version
function printVersion(): void {
  console.log(`copilot-shim v${VERSION}`);
}

// Main CLI entry point
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0]?.toLowerCase();

  switch (command) {
    case 'start':
      if (args.includes('--background') || args.includes('-b') || args.includes('-d') || args.includes('--daemon')) {
        await startBackground();
      } else {
        await startForeground();
      }
      break;

    case 'stop':
      await stopServer();
      break;

    case 'restart':
      await restartServer();
      break;

    case 'status':
      await showStatus();
      break;

    case 'logs':
    case 'log':
      await showLogs(args.includes('--follow') || args.includes('-f'));
      break;

    case 'help':
    case '--help':
    case '-h':
      printHelp();
      break;

    case 'version':
    case '--version':
    case '-v':
      printVersion();
      break;

    default:
      if (command) {
        console.error(colors.red(`Unknown command: ${command}\n`));
      }
      printHelp();
      process.exit(command ? 1 : 0);
  }
}

main().catch((error) => {
  console.error(colors.red('Error:'), error.message);
  process.exit(1);
});
