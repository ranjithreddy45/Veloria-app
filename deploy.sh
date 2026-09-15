#!/bin/bash
echo "🚀 Starting Deployment to VPS..."

# 1. Sync the code
echo "Syncing files..."
rsync -avz --exclude 'node_modules' --exclude '.next' --exclude '.git' --exclude '.env' -e "ssh -i ./id_rsa" ./ theveloriagrand@43.225.53.88:~/veloria-app-prod

# 2. Build and restart on the server
echo "🔨 Building and Restarting PM2..."
ssh -i ./id_rsa theveloriagrand@43.225.53.88 << 'EOF'
  cd ~/veloria-app-prod
  pnpm install
  rm -rf .next/standalone
  pnpm run build
  
  # Copy static files to standalone output
  cp -r public .next/standalone/
  cp -r .next/static .next/standalone/.next/
  
  # Reload PM2 using the cluster configuration (zero-downtime)
  pm2 reload ecosystem.config.js --env production || pm2 start ecosystem.config.js --env production
EOF

echo "Deployment Complete!"
