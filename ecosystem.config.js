// ecosystem.config.js
// PM2 process manager configuration for production deployment
//
// Usage:
//   pm2 start ecosystem.config.js          # start all
//   pm2 start ecosystem.config.js --env production
//   pm2 logs neurofast-worker              # tail logs
//   pm2 monit                              # real-time dashboard
//   pm2 save && pm2 startup               # survive server reboots

module.exports = {
  apps: [
    // ─── TRAINING WORKER ──────────────────────────────────────────────────────
    {
      name: "neurofast-worker",
      script: "tsx",
      args: "lib/queue/worker.ts",
      instances: 1,                    // 1 process (concurrency=3 handles parallelism)
      autorestart: true,
      watch: false,                    // never watch in production
      max_memory_restart: "512M",      // restart if OOM
      restart_delay: 5000,             // 5s before restart after crash
      max_restarts: 10,                // give up after 10 restarts in 15min
      min_uptime: "10s",               // must stay up 10s to count as successful start

      // Environment variables — set in .env.local or via PM2 env
      env: {
        NODE_ENV: "development",
        DOTENV_CONFIG_PATH: ".env.local",
      },
      env_production: {
        NODE_ENV: "production",
      },

      // Logging
      out_file: "./logs/worker-out.log",
      error_file: "./logs/worker-error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,

      // Health monitoring — PM2 watches this file written by worker every 30s
      // If file stops updating, PM2 can restart
      listen_timeout: 60000,
      kill_timeout: 30000,             // give worker 30s to finish active jobs on SIGTERM
    },
  ],
};
