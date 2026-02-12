/**
 * PM2 Ecosystem Configuration for SecureClaw
 * Always-on production deployment with auto-restart and monitoring
 */

module.exports = {
  apps: [
    {
      name: 'secureclaw-server',
      script: 'server_dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      error_file: './logs/server-error.log',
      out_file: './logs/server-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
    },
    {
      name: 'secureclaw-gateway',
      script: 'src/gateway/server.ts',
      interpreter: 'node',
      interpreter_args: '--loader tsx',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        GATEWAY_PORT: 18789,
      },
      env_production: {
        NODE_ENV: 'production',
        GATEWAY_PORT: 18789,
      },
      error_file: './logs/gateway-error.log',
      out_file: './logs/gateway-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
    },
    {
      name: 'secureclaw-cron',
      script: 'src/cron/autonomous-tasks.ts',
      interpreter: 'node',
      interpreter_args: '--loader tsx',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      cron_restart: '0 0 * * *', // Daily restart at midnight
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/cron-error.log',
      out_file: './logs/cron-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
  ],
};
