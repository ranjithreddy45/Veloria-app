#!/bin/bash
set -e
echo "🧪 Starting Deployment to VPS (TEST Environment)..."

# 1. Sync the code
echo "Syncing files..."
rsync -avz --delete --exclude 'node_modules' --exclude '.next' --exclude '.git' --exclude '.env' -e "ssh -i ./id_rsa" ./ theveloriagrand@43.225.53.88:~/veloria-app-test

# 2. Build and restart on the server
echo "🔨 Building and Restarting PM2..."
ssh -i ./id_rsa theveloriagrand@43.225.53.88 << 'EOF'
  cd ~/veloria-app-test
  npm install
  # Completely remove the old .next directory to prevent stale build caches
  rm -rf .next
  npm run build
  
  # Copy static files to standalone output
  cp -r public .next/standalone/
  cp -r .next/static .next/standalone/.next/
  
  # We must delete the old test process because it holds the port!
  pm2 delete veloria-test || true
  
  if [ -f "ecosystem.test.config.js" ]; then
    pm2 start ecosystem.test.config.js --env production
  else
    echo "Ecosystem config not found. Falling back to simple start."
    HOSTNAME=127.0.0.1 PORT=3001 pm2 start .next/standalone/server.js --name veloria-test
  fi
EOF

echo "Test Environment Deployment Complete! 🎉"
