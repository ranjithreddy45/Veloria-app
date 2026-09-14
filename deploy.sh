#!/bin/bash
echo "🚀 Starting Deployment to VPS..."

# 1. Sync the code
echo "Syncing files..."
rsync -avz --exclude 'node_modules' --exclude '.next' --exclude '.git' -e "ssh -i ./id_rsa" ./ theveloriagrand@43.225.53.88:~/veloria-app-prod

# 2. Build and restart on the server
echo "🔨 Building and Restarting PM2..."
ssh -i ./id_rsa theveloriagrand@43.225.53.88 << 'EOF'
  cd ~/veloria-app-prod
  pnpm install
  pnpm run build
  pm2 reload veloria-prod
EOF

echo "Deployment Complete!"
