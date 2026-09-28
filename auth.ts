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
  clientIpOf,
  completeOtpLogin,
  isValidOtpPhone,
  maskPhone,
  normalizeOtpPhone,
  otpRateLimit,
  OtpLoginDisabledError,
  OtpNoRecordError,
  OtpRateLimitedError,
  OtpSharedNumberError,
  OtpTryAgainError,
  verifyLoginOtp,
} from "@/lib/otp";
import { getEffectivePermissions } from "@/lib/rbac";
import { ROLE_PERMISSIONS } from "@/lib/permissions";
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
      // Bake only the DELTA from the role's static defaults, never the whole
      // list. The full list used to go into the token, which is the session
      // cookie: when FINANCE was granted the admin set (230 permissions) that
      // cookie blew past Apache's LimitRequestFieldSize (8190 bytes) and every
      // request from that user came back 431 Request Header Fields Too Large —
      // they could not load any page, including /sign-in, to recover.
      // Middleware already knows the role, so it can rebuild the defaults
      // itself; only RolePermission overrides need carrying, and those are
      // normally empty.
      const bakePerms = async (role?: string) => {
        const t = token as { perms?: string[]; permsAdd?: string[]; permsDel?: string[] };
        delete t.perms; // drop any legacy full list rather than refreshing it
        try {
          if (!role || role === "SUPER_ADMIN" || role === "ADMIN") {
            delete t.permsAdd;
            delete t.permsDel;
            return;
          }
          const effective = new Set(await getEffectivePermissions(role));
          const defaults = new Set<string>(ROLE_PERMISSIONS[role] ?? []);
          const add = [...effective].filter((x) => !defaults.has(x));
          const del = [...defaults].filter((x) => !effective.has(x));
          if (add.length) t.permsAdd = add; else delete t.permsAdd;
          if (del.length) t.permsDel = del; else delete t.permsDel;
        } catch {
          // Never break auth on a DB hiccup — fall back to the role defaults.
          delete t.permsAdd;
          delete t.permsDel;
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
            delete (token as { perms?: string[] }).perms;
            delete (token as { permsAdd?: string[] }).permsAdd;
            delete (token as { permsDel?: string[] }).permsDel;
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

        // Every refusal below returns the same generic error to the browser (no
        // hint about which accounts exist), but the server log says why — so
        // when a named person "can't log in", one attempt answers it.
        // User not found or no password (OAuth-only account)
        if (!user || !user.hashedPassword) {
          console.warn(`[auth] password sign-in refused · ${user ? "account has no password" : "no account with this email"} · ${email.toLowerCase()}`);
          return null;
        }

        // Check if account is active
        if (!user.isActive) {
          console.warn(`[auth] password sign-in refused · account deactivated · ${user.email}`);
          return null;
        }

        // Verify password
        const isPasswordValid = await bcryptjs.compare(
          password,
          user.hashedPassword
        );

        if (!isPasswordValid) {
          console.warn(`[auth] password sign-in refused · wrong password · ${user.email}`);
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

    // Passwordless WhatsApp code sign-in, for the customer app (/app/welcome)
    // and staff (/sign-in) alike. A code proves control of ONE WhatsApp number;
    // completeOtpLogin (src/lib/otp.ts) then finds or creates the login for
    // exactly the records that carry that number. Existing logins keep their
    // role; new ones are CLIENT. Refusals after a valid code throw a coded
    // error so the screen can say what to do next.
    Credentials({
      id: "otp",
      name: "WhatsApp Code",
      credentials: {
        phone: { label: "Phone", type: "tel" },
        code: { label: "Code", type: "text" },
      },
      async authorize(credentials, request) {
        const normalized = normalizeOtpPhone(String(credentials?.phone ?? ""));
        const code = String(credentials?.code ?? "").trim();
        if (!isValidOtpPhone(normalized) || !/^\d{6}$/.test(code)) return null;

        // Per-IP and per-number caps on code checks, on top of 5 tries per code.
        const byIp = otpRateLimit("verify", "ip", clientIpOf(request?.headers));
        const byNumber = otpRateLimit("verify", "number", normalized);
        if (!byIp.success || !byNumber.success) {
          console.warn(`[auth] otp sign-in refused · too many attempts · ${maskPhone(normalized)}`);
          throw new OtpRateLimitedError();
        }

        // Verify (and consume) the code first, then resolve the login.
        const ok = await verifyLoginOtp(normalized, code);
        if (!ok) return null;

        let result: Awaited<ReturnType<typeof completeOtpLogin>>;
        try {
          result = await completeOtpLogin(normalized);
        } catch (error) {
          console.error(`[auth] otp sign-in failed after a valid code · ${maskPhone(normalized)}`, error);
          throw new OtpTryAgainError();
        }
        if (!result.ok) {
          console.warn(`[auth] otp sign-in refused · ${result.reason} · ${maskPhone(normalized)}`);
          if (result.reason === "SHARED_NUMBER") throw new OtpSharedNumberError();
          if (result.reason === "LOGIN_DISABLED") throw new OtpLoginDisabledError();
          throw new OtpNoRecordError();
        }
        const { user } = result;

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
