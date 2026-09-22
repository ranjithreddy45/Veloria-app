# CHUNK 01-17 — BUILD, DEPLOYMENT & RUNTIME ARCHITECTURE

- **Status**: `CODE VERIFIED`
- **Module**: System Architecture
- **Target Path**: `knowledge-base/01-system-architecture/17-build-deployment-runtime.md`

---

## 🚀 Build Pipeline & Script Entries

Derived directly from `package.json`:

```bash
pnpm dev             # Launches Next.js dev server on http://localhost:3000
pnpm build           # Compiles Next.js production build (prisma generate + next build)
pnpm start           # Starts compiled Next.js Node.js server
pnpm db:migrate      # Runs Prisma database schema migrations (prisma migrate deploy)
pnpm cap:build       # Executes Next.js build followed by Capacitor sync (npx cap sync)
```

---

## 🐳 Production Containerization & VPS Deployment

1. **Docker Containerization (`Dockerfile`, `docker-compose.yml`)**: Multi-stage Node.js 20 alpine container building standalone Next.js production server.
2. **PM2 Process Manager (`ecosystem.config.js`)**: Manages Node.js process clustering, auto-restart on crash, and log rotation:
   ```javascript
   module.exports = {
     apps: [
       {
         name: "veloria-app",
         script: "node_modules/next/dist/bin/next",
         args: "start",
         instances: "max",
         exec_mode: "cluster",
         env: { NODE_ENV: "production", PORT: 3000 }
       }
     ]
   };
   ```
3. **VPS Bash Deployment Script (`deploy.sh`)**: Automates Git pull, dependency install, database migration, asset build, and PM2 reload on target production servers.
4. **Legacy Vercel Manifest (`vercel.json`)**: Preserved for Vercel deployment support.
