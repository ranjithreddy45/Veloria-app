module.exports = {
  apps: [
    {
      name: "veloria-prod",
      script: "./.next/standalone/server.js",
      instances: "max", // Utilize all available CPU cores
      exec_mode: "cluster", // Enable cluster mode for zero-downtime reloads and multi-threading
      env: {
        NODE_ENV: "production",
        PORT: 3010,
        HOSTNAME: "127.0.0.1",
      },
    },
  ],
};
