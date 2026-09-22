# CHUNK 02-02 — AUTH PROVIDER ARCHITECTURE

- **Status**: `CODE VERIFIED`
- **Module**: Authentication & Security
- **Target Path**: `knowledge-base/02-authentication-security/02-auth-provider-architecture.md`

---

## 📌 Authentication Configuration Manifests

The authentication provider layer is split into two core files:
1. `auth.config.ts`: Edge-safe NextAuth configuration (no Prisma or `bcryptjs` imports). Consumed by `middleware.ts`.
2. `auth.ts`: Full Node.js NextAuth execution engine with Prisma ORM adapter (`@auth/prisma-adapter`) and `bcryptjs` password hashing.

---

## 🔐 Credentials & OAuth Providers (`auth.ts`)

```typescript
// auth.ts Excerpt
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/sign-in",
    error: "/sign-in",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        totpCode: { label: "2FA Code", type: "text" },
      },
      async authorize(credentials) {
        // 1. Zod Validation
        const parsed = signInSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const { email, password, totpCode } = parsed.data;

        // 2. Query User from Database
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash) return null;

        # 3. Password Hash Verification via bcryptjs
        const passwordMatch = await bcryptjs.compare(password, user.passwordHash);
        if (!passwordMatch) return null;

        // 4. 2FA Check if enabled for Role/User
        if (user.twoFactorEnabled) {
          const totpResult = await verifySecondFactor(user.id, totpCode);
          if (!totpResult.ok) throw new Error("TwoFactorRequired");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
});
```
