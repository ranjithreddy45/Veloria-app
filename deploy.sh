#!/bin/bash
set -e
echo "🚀 Starting Deployment to VPS..."

# 1. Sync the code
echo "Syncing files..."
rsync -avz --exclude 'node_modules' --exclude '.next' --exclude '.git' --exclude '.env' -e "ssh -i ./id_rsa" ./ theveloriagrand@43.225.53.88:~/veloria-app-prod

# 2. Build and restart on the server
echo "🔨 Building and Restarting PM2..."
ssh -i ./id_rsa theveloriagrand@43.225.53.88 << 'EOF'
  cd ~/veloria-app-prod
  pnpm install
  # Completely remove the old .next directory to prevent stale build caches
  rm -rf .next
  pnpm run build
  
  # Copy static files to standalone output
  cp -r public .next/standalone/
  cp -r .next/static .next/standalone/.next/
  
  # We must delete the old processes because they are holding the port!
  pm2 delete veloria-prod || true
  
  if [ -f "ecosystem.config.js" ]; then
    pm2 start ecosystem.config.js --env production
  else
    echo "Ecosystem config not found. Falling back to simple start."
    HOSTNAME=127.0.0.1 PORT=3010 pm2 start .next/standalone/server.js --name veloria-prod
  fi
EOF

echo "Deployment Complete!"
