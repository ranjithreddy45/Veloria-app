const dotenv = require('dotenv');
const env = dotenv.config({ path: './.env' }).parsed || {};

// Force the test URLs, overriding anything in .env
env.AUTH_URL = "https://test.theveloriagrand.com";
env.NEXTAUTH_URL = "https://test.theveloriagrand.com";
env.NEXT_PUBLIC_APP_URL = "https://test.theveloriagrand.com";
// VERY IMPORTANT: Do NOT trust the host header from cPanel's proxy, because 
// it often incorrectly sends the primary domain (app.theveloriagrand.com) 
// instead of the addon domain (test.theveloriagrand.com).
env.AUTH_TRUST_HOST = "false";

module.exports = {
  apps: [
    {
      name: "veloria-test",
      script: "./.next/standalone/server.js",
      instances: 1,
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
        HOSTNAME: "0.0.0.0",
        ...env
      },
    },
  ],
};
