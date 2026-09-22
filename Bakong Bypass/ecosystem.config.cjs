module.exports = {
  apps: [
    {
      name: "bakong-api",
      script: "server.js",
      env: {
        PORT: 3000,
      },
      autorestart: true,
      restart_delay: 5000,
      max_memory_restart: "1G",
    },
  ],
};
