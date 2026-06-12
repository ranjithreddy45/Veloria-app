import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@prisma/client";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

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
      }
      return session;
    },
  },
};

export default authConfig;
