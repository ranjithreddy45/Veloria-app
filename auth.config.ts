import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@prisma/client";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import {
  TWO_FACTOR_CHALLENGE_PATH,
  TWO_FACTOR_ENFORCEMENT,
  TWO_FACTOR_HARD_ALLOWLIST,
  TWO_FACTOR_SETUP_PATH,
  isTwoFactorRequiredForRole,
} from "@/lib/security/two-factor-policy";

/** Paths a session that still owes its second factor may reach. */
function isTwoFactorChallengePath(pathname: string): boolean {
  return (
    pathname === TWO_FACTOR_CHALLENGE_PATH ||
    pathname.startsWith(`${TWO_FACTOR_CHALLENGE_PATH}/`) ||
    pathname.startsWith("/api/auth") ||
    pathname === "/not-authorized"
  );
}

/**
 * Edge-safe auth configuration.
 *
 * This file must NOT import Prisma, bcryptjs, or any Node.js-only
 * modules that cannot run in the Edge runtime (middleware).
 *
 * The Credentials provider here is a stub shape. The real `authorize`
 * logic lives in auth.ts where Prisma and bcryptjs are available.
 */
const authConfig: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      // Stub authorize — overridden in auth.ts
      authorize: () => null,
    }),
  ],

  pages: {
    signIn: "/sign-in",
  },

  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;

      // ------------------------------------------------------------------
      // Two-factor authentication (see src/lib/security/two-factor-policy.ts)
      // ------------------------------------------------------------------
      // 1. A Google / WhatsApp-OTP sign-in by an enrolled user is flagged
      //    `twoFactorPending` in the JWT (auth.ts). Until the /two-factor page
      //    verifies a code for this session, every other route bounces there —
      //    server actions POST to the page URL, so they are covered too.
      const tfUser = auth?.user as
        | { role?: string; twoFactorPending?: boolean; twoFactorEnabled?: boolean }
        | undefined;
      if (isLoggedIn && tfUser?.twoFactorPending) {
        if (isTwoFactorChallengePath(pathname)) return true;
        if (pathname.startsWith("/api/")) {
          return Response.json(
            { error: "Two-factor authentication required" },
            { status: 401 }
          );
        }
        return Response.redirect(new URL(TWO_FACTOR_CHALLENGE_PATH, nextUrl));
      }
      // 2. Hard enforcement (off by default): a required role that has not
      //    enrolled can only reach the setup page until it does.
      if (
        isLoggedIn &&
        (TWO_FACTOR_ENFORCEMENT as string) === "hard" &&
        isTwoFactorRequiredForRole(tfUser?.role) &&
        !tfUser?.twoFactorEnabled &&
        !pathname.startsWith("/api/") &&
        !(TWO_FACTOR_HARD_ALLOWLIST as readonly string[]).some(
          (p) => pathname === p || pathname.startsWith(`${p}/`)
        )
      ) {
        return Response.redirect(new URL(TWO_FACTOR_SETUP_PATH, nextUrl));
      }

      // Protected dashboard/internal routes
      const isOnDashboard = pathname.startsWith("/dashboard");
      const isOnPortal = pathname.startsWith("/portal");
      const isOnProtected =
        isOnDashboard ||
        isOnPortal ||
        pathname.startsWith("/contacts") ||
        pathname.startsWith("/leads") ||
        pathname.startsWith("/pipeline") ||
        pathname.startsWith("/bookings") ||
        pathname.startsWith("/tasks") ||
        pathname.startsWith("/invoices") ||
        pathname.startsWith("/payments") ||
        pathname.startsWith("/reports") ||
        pathname.startsWith("/settings") ||
        pathname.startsWith("/notifications") ||
        pathname.startsWith("/quotes") ||
        pathname.startsWith("/contracts") ||
        pathname.startsWith("/vendors") ||
        pathname.startsWith("/packages") ||
        pathname.startsWith("/pricing") ||
        pathname.startsWith("/menu") ||
        pathname.startsWith("/resources") ||
        pathname.startsWith("/inventory") ||
        pathname.startsWith("/staff") ||
        pathname.startsWith("/rentals") ||
        pathname.startsWith("/commissions") ||
        pathname.startsWith("/payouts") ||
        pathname.startsWith("/insurance") ||
        pathname.startsWith("/analytics") ||
        pathname.startsWith("/campaigns") ||
        pathname.startsWith("/referrals") ||
        pathname.startsWith("/loyalty") ||
        pathname.startsWith("/surveys") ||
        pathname.startsWith("/reviews") ||
        pathname.startsWith("/gallery") ||
        pathname.startsWith("/inquiries") ||
        pathname.startsWith("/performance") ||
        pathname.startsWith("/competitors") ||
        pathname.startsWith("/documents") ||
        pathname.startsWith("/whatsapp") ||
        pathname.startsWith("/approvals") ||
        pathname.startsWith("/crm") ||
        pathname.startsWith("/vendor-portal");

      // Auth pages (sign-in, sign-up, etc.)
      const isOnAuthPage =
        pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up");

      // Redirect logged-in users away from auth pages
      if (isOnAuthPage && isLoggedIn) {
        const role = (auth.user as { role?: string }).role;
        const redirectTo =
          role === "CLIENT"
            ? "/portal"
            : role === "VENDOR"
              ? "/vendor-portal"
              : "/dashboard";
        return Response.redirect(new URL(redirectTo, nextUrl));
      }

      // Require authentication for protected routes
      if (isOnProtected && !isLoggedIn) {
        return false; // Redirects to signIn page
      }

      return true;
    },

    jwt({ token, user }) {
      // On initial sign-in, `user` is available
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
      }
      return token;
    },

    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        // Effective (override-aware) permissions, baked at sign-in (auth.ts).
        (session.user as { perms?: string[] }).perms =
          (token as { perms?: string[] }).perms;
        // Two-factor flags (auth.ts jwt callback). The challenge id is not a
        // secret: only a verified code can turn it into a passed challenge.
        const tf = token as { tfa?: boolean; tfaPending?: boolean; tfaSid?: string };
        session.user.twoFactorEnabled = !!tf.tfa;
        session.user.twoFactorPending = !!tf.tfaPending;
        session.user.twoFactorSid = tf.tfaPending ? tf.tfaSid : undefined;
      }
      return session;
    },
  },
};

export default authConfig;
