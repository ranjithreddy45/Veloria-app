import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import bcryptjs from "bcryptjs";
import prisma from "@/lib/prisma";
import { signInSchema } from "@/schemas/auth.schema";
import authConfig from "./auth.config";
import {
  normalizeOtpPhone,
  verifyLoginOtp,
  findActiveUserByPhone,
} from "@/lib/otp";
import { getEffectivePermissions } from "@/lib/rbac";
import type { UserRole } from "@prisma/client";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,

  trustHost: true,

  // Bake effective (override-aware) permissions into the token at sign-in so
  // the edge middleware can enforce per-route access without a DB read.
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      const bakePerms = async (role?: string) => {
        try {
          (token as { perms?: string[] }).perms =
            role === "SUPER_ADMIN" || role === "ADMIN"
              ? ["*"]
              : role
                ? await getEffectivePermissions(role)
                : [];
        } catch {
          (token as { perms?: string[] }).perms = undefined; // fall back to defaults
        }
      };

      if (user) {
        token.id = user.id as string;
        const role = (user as { role?: string }).role;
        (token as { role?: unknown }).role = role;
        await bakePerms(role);
        (token as { checkedAt?: number }).checkedAt = Date.now();
        return token;
      }

      // On later requests, periodically re-validate against the DB so a
      // deactivated user is locked out and role/permission changes take effect
      // without waiting for the JWT to expire (throttled to once / 5 min).
      const last = (token as { checkedAt?: number }).checkedAt ?? 0;
      if (token.id && Date.now() - last > 5 * 60 * 1000) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { isActive: true, role: true },
          });
          if (!dbUser || !dbUser.isActive) {
            // Force sign-out: strip identity so server checks treat as logged out.
            delete (token as { id?: string }).id;
            (token as { role?: unknown }).role = undefined;
            (token as { perms?: string[] }).perms = [];
            return token;
          }
          (token as { role?: unknown }).role = dbUser.role;
          await bakePerms(dbUser.role);
          (token as { checkedAt?: number }).checkedAt = Date.now();
        } catch {
          // Transient DB error — keep the existing token, re-check next cycle.
        }
      }
      return token;
    },
  },

  adapter: PrismaAdapter(prisma) as never,

  session: {
    strategy: "jwt",
  },

  // Override providers with full implementations
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
          role: "CLIENT" as UserRole,
        };
      },
    }),

    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // Validate credentials shape
        const parsed = signInSchema.safeParse(credentials);

        if (!parsed.success) {
          return null;
        }

        const { email, password } = parsed.data;

        // Look up user by email
        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        });

        // User not found or no password (OAuth-only account)
        if (!user || !user.hashedPassword) {
          return null;
        }

        // Check if account is active
        if (!user.isActive) {
          return null;
        }

        // Verify password
        const isPasswordValid = await bcryptjs.compare(
          password,
          user.hashedPassword
        );

        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
        };
      },
    }),

    // Passwordless WhatsApp OTP login. Verifies a one-time code (which was
    // sent only if an active account exists for the number), then signs that
    // user in. Works for staff and portal clients alike.
    Credentials({
      id: "otp",
      name: "WhatsApp Code",
      credentials: {
        phone: { label: "Phone", type: "tel" },
        code: { label: "Code", type: "text" },
      },
      async authorize(credentials) {
        const normalized = normalizeOtpPhone(String(credentials?.phone ?? ""));
        const code = String(credentials?.code ?? "");
        if (!normalized || !/^\d{6}$/.test(code)) return null;

        // Verify (and consume) the code first, then resolve the user.
        const ok = await verifyLoginOtp(normalized, code);
        if (!ok) return null;

        const user = await findActiveUserByPhone(normalized);
        if (!user) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],

  events: {
    async linkAccount({ user }) {
      // When an OAuth account is linked, mark email as verified
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: new Date() },
      });
    },
    // C9: Google identities are inherently email-verified. linkAccount covers
    // the first link, but ensure it on every Google sign-in (e.g. an account
    // that predates this rule, or one whose emailVerified was cleared) so the
    // portal's verified-only data gate always lets a real Google user through.
    async signIn({ user, account }) {
      if (account?.provider === "google" && user?.id) {
        try {
          await prisma.user.updateMany({
            where: { id: user.id, emailVerified: null },
            data: { emailVerified: new Date() },
          });
        } catch (err) {
          console.error("[GOOGLE_EMAIL_VERIFY_ERROR]", err);
        }
      }
    },
  },
});
