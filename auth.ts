import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import bcryptjs from "bcryptjs";
import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import { signInSchema } from "@/schemas/auth.schema";
import authConfig from "./auth.config";
import {
  normalizeOtpPhone,
  verifyLoginOtp,
  findActiveUserByPhone,
} from "@/lib/otp";
import { getEffectivePermissions } from "@/lib/rbac";
import {
  consumeVerifiedChallenge,
  isTwoFactorEnabled,
  loadTwoFactorTokenFlags,
  verifySecondFactor,
} from "@/lib/security/two-factor-login";
import {
  TwoFactorInvalidError,
  TwoFactorRateLimitedError,
  TwoFactorRequiredError,
  TwoFactorReusedError,
} from "@/lib/security/two-factor-errors";
import type { UserRole } from "@prisma/client";

// Two-factor flags carried in the JWT (see src/types/next-auth.d.ts):
//   tfa        — the user has an enabled authenticator (drives the policy banner)
//   tfaPending — this session signed in via Google / WhatsApp OTP and still owes
//                a code; auth.config `authorized` bounces it to /two-factor
//   tfaSid     — random id binding the pending state to THIS session; the
//                /two-factor page writes a UserTwoFactorChallenge row for it
type TwoFactorToken = { tfa?: boolean; tfaPending?: boolean; tfaSid?: string };

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  ...authConfig,

  trustHost: true,

  // Bake effective (override-aware) permissions into the token at sign-in so
  // the edge middleware can enforce per-route access without a DB read.
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, account, trigger }) {
      const tfaToken = token as TwoFactorToken;
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
      // Re-read the user's 2FA enrolment; clear a pending challenge once the
      // /two-factor page has verified a code for this exact session id.
      const refreshTwoFactor = async (userId: string) => {
        const { enabled } = await loadTwoFactorTokenFlags(userId);
        tfaToken.tfa = enabled;
        if (!tfaToken.tfaPending) return;
        if (!enabled) {
          delete tfaToken.tfaPending;
          delete tfaToken.tfaSid;
          return;
        }
        if (tfaToken.tfaSid) {
          try {
            if (await consumeVerifiedChallenge(tfaToken.tfaSid, userId)) {
              delete tfaToken.tfaPending;
              delete tfaToken.tfaSid;
            }
          } catch (error) {
            console.error("[2FA_CHALLENGE_CHECK_ERROR]", error);
          }
        }
      };

      if (user) {
        token.id = user.id as string;
        const role = (user as { role?: string }).role;
        (token as { role?: unknown }).role = role;
        await bakePerms(role);
        (token as { checkedAt?: number }).checkedAt = Date.now();

        // The email+password provider verified the TOTP inside `authorize`.
        // Google OAuth and the WhatsApp "otp" provider could not, so an
        // enrolled user owes a code before the session is usable.
        const { enabled } = await loadTwoFactorTokenFlags(String(token.id));
        tfaToken.tfa = enabled;
        if (enabled && account?.provider !== "credentials") {
          tfaToken.tfaPending = true;
          tfaToken.tfaSid = randomUUID();
        }
        return token;
      }

      // On later requests, periodically re-validate against the DB so a
      // deactivated user is locked out and role/permission changes take effect
      // without waiting for the JWT to expire (throttled to once / 5 min).
      // `trigger === "update"` (unstable_update from a server action) forces
      // the re-check — used right after a 2FA enrol / disable / challenge.
      const last = (token as { checkedAt?: number }).checkedAt ?? 0;
      const forceRefresh = trigger === "update";
      if (token.id && (forceRefresh || Date.now() - last > 5 * 60 * 1000)) {
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
          await refreshTwoFactor(token.id as string);
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
        // Second step: 6-digit authenticator code or a recovery code. Only
        // consulted once the password has checked out, so 2FA status is never
        // revealed to someone who doesn't know the password.
        totp: { label: "Authentication code", type: "text" },
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

        // Two-factor: enrolled users must also present a code. The thrown
        // errors carry a `code` the sign-in form reads to reveal the input.
        const totp =
          typeof credentials?.totp === "string" ? credentials.totp.trim() : "";
        if (!totp) {
          // Fail closed: a DB error here surfaces as a failed sign-in rather
          // than a silent skip of the second factor.
          if (await isTwoFactorEnabled(user.id)) throw new TwoFactorRequiredError();
        } else {
          const second = await verifySecondFactor(user.id, totp);
          if (!second.ok && second.reason !== "not_enabled") {
            if (second.reason === "rate_limited") throw new TwoFactorRateLimitedError();
            if (second.reason === "reused") throw new TwoFactorReusedError();
            throw new TwoFactorInvalidError();
          }
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
