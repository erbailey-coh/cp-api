// PM2 Ecosystem Configuration for Copilot Shim
// https://pm2.keymetrics.io/docs/usage/application-declaration/

module.exports = {
  apps: [
    {
      name: 'copilot-shim',
      script: 'dist/index.js',
      cwd: __dirname,

      // Environment variables
      env: {
        NODE_ENV: 'production',
        PORT: 4891,
        // Start headless - will auto-switch to headed if login needed
        HEADLESS: 'true',
      },

      // Restart configuration
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 5000,

      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: './logs/error.log',
      out_file: './logs/output.log',
      merge_logs: true,
      log_type: 'json',

      // Watch for crashes but don't watch files (we don't want auto-restart on file changes)
      watch: false,

      // Resource limits
      max_memory_restart: '1G',

      // Process will be run in fork mode (not cluster) since we need single browser instance
      exec_mode: 'fork',
      instances: 1,

      // Kill timeout - give browser time to close gracefully
      kill_timeout: 10000,

      // Wait for ready signal
      wait_ready: false,

      // Don't run as daemon in WSL2 - we need GUI access for login
      // When started via Windows Task Scheduler, it will have desktop access
    },
  ],
};
