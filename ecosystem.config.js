module.exports = {
  apps: [{
    name: 'judicial-law-search',
    script: 'node_modules/next/dist/bin/next',
    args: 'start -H 0.0.0.0 -p 3001',
    cwd: 'C:\\Users\\26371\\Documents\\MLocalCoding\\judicial-law-search',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: 'logs/pm2-error.log',
    out_file: 'logs/pm2-out.log',
    log_file: 'logs/pm2-combined.log',
    time: true
  }]
};
