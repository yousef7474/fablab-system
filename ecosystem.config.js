// PM2 Configuration for Production
module.exports = {
  apps: [{
    name: 'fablab-api',
    script: 'server/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env_production: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: '/var/log/fablab/error.log',
    out_file: '/var/log/fablab/out.log',
    log_file: '/var/log/fablab/combined.log',
    time: true
  }]
};
