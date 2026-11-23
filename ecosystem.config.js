module.exports = {
  apps: [
    {
      name: "veloria-prod",
      // prod-server.cjs pins 127.0.0.1:3010 + TZ=UTC and fills in missing static
      // files before starting .next/standalone/server.js. Do not point this back
      // at server.js: a restart from a login shell would bind the public IP (503).
      script: "./prod-server.cjs",
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
