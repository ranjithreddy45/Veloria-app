import NextAuth from "next-auth";
import authConfig from "./auth.config";
import { NextResponse } from "next/server";
import { routePermission, hasPermission } from "@/lib/permissions";

/**
 * Use the edge-safe authConfig (no Prisma, no bcryptjs) for middleware.
 * The full auth.ts config is only used in Node.js server contexts.
 */
const { auth } = NextAuth(authConfig);

/**
 * Internal roles that can access the dashboard and internal CRM routes.
 */
const INTERNAL_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "SALES_EXEC",
  "SALES_HEAD",
  "EVENT_COORDINATOR",
  "FINANCE",
  "STAFF",
  // BD / Acquisition CRM roles
  "BD_EXECUTIVE",
  "BD_HEAD",
  "OPERATIONS",
  "OPERATIONS_HEAD",
  "PROPERTY_MANAGER",
  "LEGAL",
  // Projects team
  "PROJECTS_EXEC",
  "PROJECTS_HEAD",
  // Design team
  "DESIGN_EXEC",
  "DESIGN_HEAD",
  // HR / People (shared identity)
  "HR_MANAGER",
  "HR_EXECUTIVE",
  "AUDITOR",
] as const;

/**
 * Roles allowed to access the client portal.
 */
const PORTAL_ROLES = ["CLIENT", "SUPER_ADMIN", "ADMIN"] as const;

/**
 * Roles allowed to access the vendor portal.
 */
const VENDOR_PORTAL_ROLES = ["VENDOR", "SUPER_ADMIN", "ADMIN"] as const;

/**
 * Route prefixes that require internal roles.
 */
const INTERNAL_ROUTES = [
  "/dashboard",
  "/admin", // staff-only admin surfaces (e.g. /admin/draw). Public draw is /draw.
  "/chat", // internal team chat — any logged-in staff (no per-route permission)
  "/my-work",
  "/recruitment",
  "/contacts",
  "/leads",
  "/pipeline",
  "/bookings",
  "/tasks",
  "/invoices",
  "/payments",
  "/finance",
  "/reports",
  "/quality",
  "/settings",
  "/notifications",
  "/quotes",
  "/quotations",
  "/availability",
  "/contracts",
  "/vendors",
  "/packages",
  "/pricing",
  "/menu",
  "/resources",
  "/inventory",
  "/staff",
  "/rentals",
  "/payouts",
  "/commissions",
  "/insurance",
  "/analytics",
  "/campaigns",
  "/referrals",
  "/loyalty",
  "/surveys",
  "/reviews",
  "/gallery",
  "/inquiries",
  "/performance",
  "/competitors",
  "/documents",
  "/whatsapp",
  "/approvals",
  "/crm",
  "/owners",
  "/bd",
  "/projects",
  "/marketing",
  "/feedback", // internal staff dashboard; PUBLIC review landing is /r/[token]
  "/franchise", // internal partner mgmt; PUBLIC white-label storefront is /s/[slug]
  "/accounts", // corporate-account farming dashboard (internal)
  "/site-visits", // site-visit booking staff dashboard; PUBLIC booking page is /visit/[token]
  // ------------------------------------------------------------------
  // PUBLIC customer-facing routes are intentionally NOT listed here and
  // therefore fall through the allowlist as public (mirroring /pay, /hold,
  // /s, /r). Do NOT add these to INTERNAL_ROUTES or customer features break:
  //   /q     -> self-serve quote share link (token-gated)
  //   /refer -> referral partner landing (token-gated); note this does NOT
  //             startsWith("/referrals"), so the internal /referrals gate is unaffected
  //   /visit -> public site-visit self-booking (token-gated)
  //   /v     -> public digital brochure (slug-gated)
  // ------------------------------------------------------------------
];

export default auth((req) => {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;
  const user = req.auth?.user;
  const role = user?.role;

  // Check if the route is an internal route
  const isInternalRoute = INTERNAL_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  // Check if the route is a portal route
  const isPortalRoute = pathname.startsWith("/portal");

  // Role-based access control for internal routes
  if (isInternalRoute) {
    if (!role || !(INTERNAL_ROLES as readonly string[]).includes(role)) {
      return NextResponse.redirect(new URL("/not-authorized", nextUrl));
    }
    // Per-route permission enforcement. SUPER_ADMIN / ADMIN bypass everything;
    // every other role must hold the permission the route requires. Effective
    // (override-aware) permissions, when present on the session, win over the
    // static defaults; otherwise we fall back to the role's default matrix.
    if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
      const required = routePermission(pathname);
      if (required) {
        const effective = (user as { perms?: string[] } | undefined)?.perms;
        const allowed = Array.isArray(effective)
          ? effective.includes(required)
          : hasPermission(role, required);
        if (!allowed) {
          return NextResponse.redirect(new URL("/not-authorized", nextUrl));
        }
      }
    }
  }

  // Role-based access control for portal routes
  if (isPortalRoute) {
    // H4: a logged-OUT visitor should be sent to sign in (and returned here
    // afterwards), not to the staff-style /not-authorized page.
    if (!role) {
      const signInUrl = new URL("/sign-in", nextUrl);
      signInUrl.searchParams.set("callbackUrl", pathname + nextUrl.search);
      return NextResponse.redirect(signInUrl);
    }
    // Logged in but with a non-portal role → genuine authorization failure.
    if (!(PORTAL_ROLES as readonly string[]).includes(role)) {
      return NextResponse.redirect(new URL("/not-authorized", nextUrl));
    }
  }

  // Role-based access control for vendor portal routes
  const isVendorPortalRoute = pathname.startsWith("/vendor-portal");
  if (isVendorPortalRoute) {
    if (!role || !(VENDOR_PORTAL_ROLES as readonly string[]).includes(role)) {
      return NextResponse.redirect(new URL("/not-authorized", nextUrl));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api/auth (NextAuth API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt
     * - Public assets (images, svgs, etc.)
     */
    "/((?!api/auth|api/widget|api/track|api/webforms|api/webhooks|api/v1|api/ota|form|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|\\.well-known|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.svg$|.*\\.ico$|.*\\.webp$).*)",
  ],
};
