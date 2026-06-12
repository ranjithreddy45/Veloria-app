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
  "EVENT_COORDINATOR",
  "FINANCE",
  "STAFF",
  // BD / Acquisition CRM roles
  "BD_EXECUTIVE",
  "BD_HEAD",
  "OPERATIONS",
  "LEGAL",
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
  "/contacts",
  "/leads",
  "/pipeline",
  "/bookings",
  "/tasks",
  "/invoices",
  "/payments",
  "/reports",
  "/settings",
  "/notifications",
  "/quotes",
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
    if (!role || !(PORTAL_ROLES as readonly string[]).includes(role)) {
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
    "/((?!api/auth|api/widget|api/track|api/webforms|form|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|\\.well-known|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.svg$|.*\\.ico$|.*\\.webp$).*)",
  ],
};
