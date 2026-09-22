# CHUNK 02-03 — NEXTAUTH ARCHITECTURE

- **Status**: `CODE VERIFIED`
- **Module**: Authentication & Security
- **Target Path**: `knowledge-base/02-authentication-security/03-nextauth-architecture.md`

---

## 📌 NextAuth v5 Split Architecture & Module Augmentation

Veloria Grand uses **NextAuth v5 (`5.0.0-beta.30`)**. To comply with Next.js Edge Middleware requirements while retaining PostgreSQL database access, the setup is split into two configuration files:

```
auth.config.ts (Edge Safe Configuration)
  ├── Lightweight NextAuth config (no Prisma, no bcryptjs)
  ├── Defines JWT & Session callbacks for role & 2FA flags
  └── Exported for use in middleware.ts

auth.ts (Full Node.js Engine)
  ├── Extends auth.config.ts with PrismaAdapter(prisma)
  ├── Implements Credentials provider with bcryptjs password hashing
  └── Exported for use in Server Components, Server Actions, and API Routes
```

---

## 🛠️ TypeScript Module Augmentation (`src/types/next-auth.d.ts`)

NextAuth's default `Session` and `JWT` interfaces are augmented to include custom domain fields:

```typescript
import { DefaultSession } from "next-auth";
import { UserRole } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      twoFactorVerified?: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    twoFactorVerified?: boolean;
  }
}
```

---

## 🔄 Callbacks & Session Hydration

1. **`jwt` Callback**: Executed whenever a JWT token is created or updated. Attaches `id`, `role`, and `twoFactorVerified` flags to the JWT token payload.
2. **`session` Callback**: Executed whenever `auth()` or `useSession()` is called. Copies `token.id`, `token.role`, and `token.twoFactorVerified` from the JWT to `session.user`.
3. **Session Retrieval**:
   - **Server Components & Server Actions**: Calls `const session = await auth();` (Async, 0 KB client JS).
   - **Client Components**: Wrapped in `SessionProvider` (`src/providers/session-provider.tsx`), using `useSession()`.
