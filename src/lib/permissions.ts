// ============================================================
// Permission Definitions
// ============================================================

export type Permission =
  // Hall Owners (B2B / owner-side CRM)
  | "owners:read"
  | "owners:create"
  | "owners:update"
  | "owners:delete"
  // Contacts
  | "contacts:read"
  | "contacts:create"
  | "contacts:update"
  | "contacts:delete"
  // Leads
  | "leads:read"
  | "leads:create"
  | "leads:update"
  | "leads:delete"
  | "leads:assign"
  // Pipeline
  | "pipeline:read"
  | "pipeline:update"
  | "pipeline:manage"
  // Bookings
  | "bookings:read"
  | "bookings:create"
  | "bookings:update"
  | "bookings:delete"
  | "bookings:cancel"
  // Tasks
  | "tasks:read"
  | "tasks:create"
  | "tasks:update"
  | "tasks:delete"
  | "tasks:assign"
  // Invoices
  | "invoices:read"
  | "invoices:create"
  | "invoices:update"
  | "invoices:delete"
  | "invoices:send"
  // Payments
  | "payments:read"
  | "payments:create"
  | "payments:update"
  | "payments:refund"
  // Finance module (double-entry GL)
  | "finance:read"
  // Settings
  | "settings:read"
  | "settings:update"
  | "settings:venues"
  | "settings:templates"
  // Users
  | "users:read"
  | "users:create"
  | "users:update"
  | "users:delete"
  | "users:manage-roles"
  // Dashboard
  | "dashboard:read"
  | "dashboard:analytics"
  // Pricing
  | "pricing:read"
  | "pricing:manage"
  // Quotes
  | "quotes:read"
  | "quotes:create"
  | "quotes:update"
  | "quotes:delete"
  | "quotes:send"
  | "quotes:approve"
  // Contracts
  | "contracts:read"
  | "contracts:create"
  | "contracts:update"
  | "contracts:send"
  // Packages
  | "packages:read"
  | "packages:create"
  | "packages:update"
  | "packages:delete"
  // Vendors
  | "vendors:read"
  | "vendors:create"
  | "vendors:update"
  | "vendors:delete"
  | "vendors:assign"
  // Operations
  | "operations:read"
  | "operations:create"
  | "operations:update"
  // Projects (venue readiness)
  | "projects:read"
  | "projects:create"
  | "projects:update"
  | "projects:approve"
  | "projects:audit"
  // HR / People
  | "hr:read"
  | "hr:write"
  | "hr:admin"
  | "hr:approve"
  | "hr:statutory"
  // Menu
  | "menu:read"
  | "menu:create"
  | "menu:update"
  | "menu:delete"
  // Guests
  | "guests:read"
  | "guests:create"
  | "guests:update"
  | "guests:delete"
  | "guests:checkin"
  // Workflows
  | "workflows:read"
  | "workflows:create"
  | "workflows:update"
  | "workflows:delete"
  // Resources
  | "resources:read"
  | "resources:create"
  | "resources:update"
  | "resources:delete"
  // Inventory
  | "inventory:read"
  | "inventory:create"
  | "inventory:update"
  | "inventory:delete"
  // Staff
  | "staff:read"
  | "staff:create"
  | "staff:update"
  | "staff:payroll"
  // Rentals
  | "rentals:read"
  | "rentals:create"
  | "rentals:update"
  | "rentals:delete"
  // Payouts
  | "payouts:read"
  | "payouts:create"
  | "payouts:approve"
  // Commissions
  | "commissions:read"
  | "commissions:create"
  | "commissions:approve"
  // Forecasting & Budget
  | "forecast:read"
  | "forecast:create"
  | "budget:read"
  | "budget:create"
  | "budget:update"
  // Accounting Sync
  | "accounting:read"
  | "accounting:sync"
  // Insurance
  | "insurance:read"
  | "insurance:create"
  | "insurance:update"
  | "insurance:delete"
  // Campaigns
  | "campaigns:read"
  | "campaigns:create"
  | "campaigns:update"
  | "campaigns:send"
  // Communications
  | "communications:read"
  | "communications:create"
  | "communications:delete"
  // WhatsApp
  | "whatsapp:read"
  | "whatsapp:send"
  // Referrals
  | "referrals:read"
  | "referrals:create"
  | "referrals:update"
  // Social Media
  | "social:read"
  | "social:create"
  | "social:update"
  // Email Templates
  | "email-templates:read"
  | "email-templates:create"
  | "email-templates:update"
  | "email-templates:delete"
  // Loyalty
  | "loyalty:read"
  | "loyalty:manage"
  // Surveys
  | "surveys:read"
  | "surveys:create"
  | "surveys:update"
  | "surveys:delete"
  // Reviews
  | "reviews:read"
  | "reviews:moderate"
  // Widget
  | "widget:read"
  | "widget:manage"
  // Gallery
  | "gallery:read"
  | "gallery:create"
  | "gallery:update"
  | "gallery:delete"
  // Tastings
  | "tastings:read"
  | "tastings:create"
  | "tastings:update"
  // Analytics & Performance
  | "analytics:read"
  | "analytics:advanced"
  | "performance:read"
  // Competitors
  | "competitors:read"
  | "competitors:create"
  | "competitors:update"
  | "competitors:delete"
  // Vendor Portal
  | "vendor-portal:access"
  | "vendor-portal:bids"
  | "vendor-portal:payouts"
  // Phase 12: System Infrastructure
  | "documents:read"
  | "documents:create"
  | "documents:delete"
  | "emergency:read"
  | "emergency:create"
  | "emergency:update"
  | "currency:read"
  | "currency:manage"
  | "multi-venue:read"
  | "multi-venue:manage"
  | "sms:read"
  | "sms:manage"
  // Portal (Client-facing)
  | "portal:access"
  | "portal:bookings"
  | "portal:invoices"
  | "portal:payments"
  // Execution & Accountability
  | "execution:read"
  | "execution:create"
  | "execution:update"
  | "execution:approve"
  | "sop:read"
  | "sop:create"
  | "sop:update"
  | "sop:delete"
  | "escalations:read"
  | "escalations:create"
  | "escalations:manage"
  | "performance:manage"
  | "performance:awards"
  | "referrals:manage"
  | "referrals:rewards"
  | "referrals:assets"
  | "invitations:send"
  | "invitations:read"
  | "reminders:manage"
  // AI
  | "ai:use"
  | "ai:admin";

// ============================================================
// All Permissions (for SUPER_ADMIN)
// ============================================================

export const ALL_PERMISSIONS: Permission[] = [
  "owners:read",
  "owners:create",
  "owners:update",
  "owners:delete",
  "contacts:read",
  "contacts:create",
  "contacts:update",
  "contacts:delete",
  "leads:read",
  "leads:create",
  "leads:update",
  "leads:delete",
  "leads:assign",
  "pipeline:read",
  "pipeline:update",
  "pipeline:manage",
  "bookings:read",
  "bookings:create",
  "bookings:update",
  "bookings:delete",
  "bookings:cancel",
  "tasks:read",
  "tasks:create",
  "tasks:update",
  "tasks:delete",
  "tasks:assign",
  "invoices:read",
  "invoices:create",
  "invoices:update",
  "invoices:delete",
  "invoices:send",
  "payments:read",
  "payments:create",
  "payments:update",
  "payments:refund",
  "finance:read",
  "settings:read",
  "settings:update",
  "settings:venues",
  "settings:templates",
  "users:read",
  "users:create",
  "users:update",
  "users:delete",
  "users:manage-roles",
  "dashboard:read",
  "dashboard:analytics",
  "pricing:read",
  "pricing:manage",
  "quotes:read",
  "quotes:create",
  "quotes:update",
  "quotes:delete",
  "quotes:send",
  "quotes:approve",
  "contracts:read",
  "contracts:create",
  "contracts:update",
  "contracts:send",
  "packages:read",
  "packages:create",
  "packages:update",
  "packages:delete",
  "vendors:read",
  "vendors:create",
  "vendors:update",
  "vendors:delete",
  "vendors:assign",
  "operations:read",
  "operations:create",
  "operations:update",
  "projects:read",
  "projects:create",
  "projects:update",
  "projects:approve",
  "projects:audit",
  "hr:read",
  "hr:write",
  "hr:admin",
  "hr:approve",
  "hr:statutory",
  "menu:read",
  "menu:create",
  "menu:update",
  "menu:delete",
  "guests:read",
  "guests:create",
  "guests:update",
  "guests:delete",
  "guests:checkin",
  "workflows:read",
  "workflows:create",
  "workflows:update",
  "workflows:delete",
  "resources:read",
  "resources:create",
  "resources:update",
  "resources:delete",
  "inventory:read",
  "inventory:create",
  "inventory:update",
  "inventory:delete",
  "staff:read",
  "staff:create",
  "staff:update",
  "staff:payroll",
  "rentals:read",
  "rentals:create",
  "rentals:update",
  "rentals:delete",
  "payouts:read",
  "payouts:create",
  "payouts:approve",
  "commissions:read",
  "commissions:create",
  "commissions:approve",
  "forecast:read",
  "forecast:create",
  "budget:read",
  "budget:create",
  "budget:update",
  "accounting:read",
  "accounting:sync",
  "insurance:read",
  "insurance:create",
  "insurance:update",
  "insurance:delete",
  "campaigns:read",
  "campaigns:create",
  "campaigns:update",
  "campaigns:send",
  "communications:read",
  "communications:create",
  "communications:delete",
  "whatsapp:read",
  "whatsapp:send",
  "referrals:read",
  "referrals:create",
  "referrals:update",
  "social:read",
  "social:create",
  "social:update",
  "email-templates:read",
  "email-templates:create",
  "email-templates:update",
  "email-templates:delete",
  "loyalty:read",
  "loyalty:manage",
  "surveys:read",
  "surveys:create",
  "surveys:update",
  "surveys:delete",
  "reviews:read",
  "reviews:moderate",
  "widget:read",
  "widget:manage",
  "gallery:read",
  "gallery:create",
  "gallery:update",
  "gallery:delete",
  "tastings:read",
  "tastings:create",
  "tastings:update",
  "analytics:read",
  "analytics:advanced",
  "performance:read",
  "competitors:read",
  "competitors:create",
  "competitors:update",
  "competitors:delete",
  "documents:read",
  "documents:create",
  "documents:delete",
  "emergency:read",
  "emergency:create",
  "emergency:update",
  "currency:read",
  "currency:manage",
  "multi-venue:read",
  "multi-venue:manage",
  "sms:read",
  "sms:manage",
  "vendor-portal:access",
  "vendor-portal:bids",
  "vendor-portal:payouts",
  "portal:access",
  "portal:bookings",
  "portal:invoices",
  "portal:payments",
  "execution:read",
  "execution:create",
  "execution:update",
  "execution:approve",
  "sop:read",
  "sop:create",
  "sop:update",
  "sop:delete",
  "escalations:read",
  "escalations:create",
  "escalations:manage",
  "performance:manage",
  "performance:awards",
  "referrals:manage",
  "referrals:rewards",
  "referrals:assets",
  "invitations:send",
  "invitations:read",
  "reminders:manage",
  "ai:use",
  "ai:admin",
];

// ============================================================
// Role -> Permission Mapping
// ============================================================

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  SUPER_ADMIN: [...ALL_PERMISSIONS],

  ADMIN: [
    "owners:read",
    "owners:create",
    "owners:update",
    "owners:delete",
    "contacts:read",
    "contacts:create",
    "contacts:update",
    "contacts:delete",
    "leads:read",
    "leads:create",
    "leads:update",
    "leads:delete",
    "leads:assign",
    "pipeline:read",
    "pipeline:update",
    "pipeline:manage",
    "bookings:read",
    "bookings:create",
    "bookings:update",
    "bookings:delete",
    "bookings:cancel",
    "tasks:read",
    "tasks:create",
    "tasks:update",
    "tasks:delete",
    "tasks:assign",
    "invoices:read",
    "invoices:create",
    "invoices:update",
    "invoices:delete",
    "invoices:send",
    "payments:read",
    "payments:create",
    "payments:update",
    "payments:refund",
    "finance:read",
    "pricing:read",
    "pricing:manage",
    "quotes:read",
    "quotes:create",
    "quotes:update",
    "quotes:delete",
    "quotes:send",
    "quotes:approve",
    "contracts:read",
    "contracts:create",
    "contracts:update",
    "contracts:send",
    "packages:read",
    "packages:create",
    "packages:update",
    "packages:delete",
    "vendors:read",
    "vendors:create",
    "vendors:update",
    "vendors:delete",
    "vendors:assign",
    "operations:read",
    "operations:create",
    "operations:update",
    "projects:read",
    "projects:create",
    "projects:update",
    "projects:approve",
    "projects:audit",
    "hr:read",
    "hr:write",
    "hr:admin",
    "hr:approve",
    "hr:statutory",
    "menu:read",
    "menu:create",
    "menu:update",
    "menu:delete",
    "guests:read",
    "guests:create",
    "guests:update",
    "guests:delete",
    "guests:checkin",
    "workflows:read",
    "workflows:create",
    "workflows:update",
    "workflows:delete",
    "resources:read",
    "resources:create",
    "resources:update",
    "resources:delete",
    "inventory:read",
    "inventory:create",
    "inventory:update",
    "inventory:delete",
    "staff:read",
    "staff:create",
    "staff:update",
    "staff:payroll",
    "rentals:read",
    "rentals:create",
    "rentals:update",
    "rentals:delete",
    "payouts:read",
    "payouts:create",
    "payouts:approve",
    "commissions:read",
    "commissions:create",
    "commissions:approve",
    "forecast:read",
    "forecast:create",
    "budget:read",
    "budget:create",
    "budget:update",
    "accounting:read",
    "accounting:sync",
    "insurance:read",
    "insurance:create",
    "insurance:update",
    "insurance:delete",
    "campaigns:read",
    "campaigns:create",
    "campaigns:update",
    "campaigns:send",
    "communications:read",
    "communications:create",
    "communications:delete",
    "whatsapp:read",
    "whatsapp:send",
    "referrals:read",
    "referrals:create",
    "referrals:update",
    "social:read",
    "social:create",
    "social:update",
    "email-templates:read",
    "email-templates:create",
    "email-templates:update",
    "email-templates:delete",
    "settings:read",
    "settings:update",
    "settings:venues",
    "settings:templates",
    "users:read",
    "users:create",
    "users:update",
    "dashboard:read",
    "dashboard:analytics",
    "loyalty:read",
    "loyalty:manage",
    "surveys:read",
    "surveys:create",
    "surveys:update",
    "surveys:delete",
    "reviews:read",
    "reviews:moderate",
    "widget:read",
    "widget:manage",
    "gallery:read",
    "gallery:create",
    "gallery:update",
    "gallery:delete",
    "tastings:read",
    "tastings:create",
    "tastings:update",
    "analytics:read",
    "analytics:advanced",
    "performance:read",
    "competitors:read",
    "competitors:create",
    "competitors:update",
    "competitors:delete",
    "documents:read",
    "documents:create",
    "documents:delete",
    "emergency:read",
    "emergency:create",
    "emergency:update",
    "currency:read",
    "currency:manage",
    "multi-venue:read",
    "multi-venue:manage",
    "sms:read",
    "sms:manage",
    "execution:read",
    "execution:create",
    "execution:update",
    "execution:approve",
    "sop:read",
    "sop:create",
    "sop:update",
    "sop:delete",
    "escalations:read",
    "escalations:create",
    "escalations:manage",
    "performance:manage",
    "performance:awards",
    "referrals:manage",
    "referrals:rewards",
    "referrals:assets",
    "invitations:send",
    "invitations:read",
    "reminders:manage",
    "ai:use",
    "ai:admin",
  ],

  SALES_EXEC: [
    "contacts:read",
    "contacts:create",
    "contacts:update",
    "leads:read",
    "leads:create",
    "leads:update",
    "pipeline:read",
    "pipeline:update",
    "bookings:read",
    "bookings:create",
    "bookings:update",
    "tasks:read",
    "tasks:create",
    "tasks:update",
    "invoices:read",
    "payments:read",
    "pricing:read",
    "quotes:read",
    "quotes:create",
    "quotes:update",
    "quotes:send",
    "contracts:read",
    "packages:read",
    "vendors:read",
    "communications:read",
    "communications:create",
    "whatsapp:read",
    "whatsapp:send",
    "referrals:read",
    "referrals:create",
    "campaigns:read",
    "dashboard:read",
    "loyalty:read",
    "reviews:read",
    "gallery:read",
    "tastings:read",
    "tastings:create",
    "analytics:read",
    "performance:read",
    "competitors:read",
    "referrals:manage",
    "referrals:rewards",
    "referrals:assets",
    "invitations:read",
    "ai:use",
  ],

  EVENT_COORDINATOR: [
    "contacts:read",
    "leads:read",
    "bookings:read",
    "bookings:update",
    "tasks:read",
    "tasks:create",
    "tasks:update",
    "tasks:assign",
    "invoices:read",
    "payments:read",
    "quotes:read",
    "contracts:read",
    "packages:read",
    "vendors:read",
    "vendors:assign",
    "operations:read",
    "operations:create",
    "operations:update",
    "menu:read",
    "menu:create",
    "menu:update",
    "guests:read",
    "guests:create",
    "guests:update",
    "guests:checkin",
    "workflows:read",
    "resources:read",
    "resources:create",
    "inventory:read",
    "inventory:create",
    "staff:read",
    "rentals:read",
    "rentals:create",
    "dashboard:read",
    "settings:read",
    "gallery:read",
    "gallery:create",
    "tastings:read",
    "tastings:create",
    "tastings:update",
    "reviews:read",
    "surveys:read",
    "analytics:read",
    "performance:read",
    "documents:read",
    "documents:create",
    "emergency:read",
    "emergency:create",
    "execution:read",
    "execution:create",
    "execution:update",
    "sop:read",
    "escalations:read",
    "escalations:create",
    "invitations:send",
    "invitations:read",
    "reminders:manage",
    "ai:use",
  ],

  FINANCE: [
    "contacts:read",
    "bookings:read",
    "invoices:read",
    "invoices:create",
    "invoices:update",
    "invoices:delete",
    "invoices:send",
    "payments:read",
    "payments:create",
    "payments:update",
    "payments:refund",
    "finance:read",
    "pricing:read",
    "quotes:read",
    "contracts:read",
    "vendors:read",
    "payouts:read",
    "payouts:create",
    "payouts:approve",
    "commissions:read",
    "commissions:create",
    "commissions:approve",
    "forecast:read",
    "forecast:create",
    "budget:read",
    "budget:create",
    "budget:update",
    "accounting:read",
    "accounting:sync",
    "insurance:read",
    "insurance:create",
    "insurance:update",
    "insurance:delete",
    "dashboard:read",
    "dashboard:analytics",
    "settings:read",
    "analytics:read",
    "analytics:advanced",
    "performance:read",
    "documents:read",
    "currency:read",
    "referrals:rewards",
    "ai:use",
  ],

  STAFF: [
    "contacts:read",
    "bookings:read",
    "tasks:read",
    "tasks:update",
    "operations:read",
    "guests:read",
    "guests:checkin",
    "dashboard:read",
    "execution:read",
    "execution:update",
  ],

  CLIENT: [
    "portal:access",
    "portal:bookings",
    "portal:invoices",
    "portal:payments",
  ],

  VENDOR: [
    "vendor-portal:access",
    "vendor-portal:bids",
    "vendor-portal:payouts",
  ],

  // ---- BD / Acquisition CRM roles ----
  // Server-side BD authorization is enforced by acqCan() (src/lib/acq/rbac.ts);
  // these grants make the BD CRM nav + pages reachable for the right people.
  BD_EXECUTIVE: [
    "dashboard:read",
    "owners:read",
    "owners:create",
    "owners:update",
    "contacts:read",
  ],
  BD_HEAD: [
    "dashboard:read",
    "owners:read",
    "owners:create",
    "owners:update",
    "owners:delete",
    "contacts:read",
  ],
  OPERATIONS: [
    "dashboard:read",
    "owners:read",
    "operations:read",
    "operations:update",
    "tasks:read",
    "tasks:update",
    "projects:read",
    "projects:audit", // ops runs the deep audit + sign-off on a readied venue
    "execution:read",
    "execution:update",
    "bookings:read",
  ],
  PROJECTS_EXEC: [
    "dashboard:read",
    "owners:read",
    "projects:read",
    "projects:create",
    "projects:update",
    "tasks:read",
    "tasks:create",
    "tasks:update",
    "vendors:read",
    "vendors:assign",
  ],
  PROJECTS_HEAD: [
    "dashboard:read",
    "owners:read",
    "projects:read",
    "projects:create",
    "projects:update",
    "projects:approve", // approves the CapEx projection + final handover go-ahead
    "tasks:read",
    "tasks:create",
    "tasks:update",
    "vendors:read",
    "vendors:assign",
    "analytics:read",
  ],
  LEGAL: [
    "dashboard:read",
    "owners:read",
    "contracts:read",
  ],
  // HR / People module roles
  HR_MANAGER: [
    "dashboard:read",
    "hr:read",
    "hr:write",
    "hr:admin",
    "hr:approve",
    "hr:statutory",
    "analytics:read",
  ],
  HR_EXECUTIVE: [
    "dashboard:read",
    "hr:read",
    "hr:write",
    "hr:approve",
  ],
  AUDITOR: [
    "dashboard:read",
    "hr:read",
    "analytics:read",
  ],
};

// ============================================================
// Route → required permission (enforced in middleware, edge-safe).
// Most-specific (longest) prefix wins. Routes not listed are open to any
// internal role. SUPER_ADMIN and ADMIN bypass all route gating.
// ============================================================
export const ROUTE_PERMISSIONS: { prefix: string; permission: Permission }[] = [
  // More specific first (the lookup sorts by length, but keep readable).
  { prefix: "/settings/users", permission: "users:read" },
  { prefix: "/settings/roles", permission: "users:manage-roles" },
  { prefix: "/bd", permission: "owners:read" },
  { prefix: "/projects", permission: "projects:read" },
  { prefix: "/people", permission: "hr:read" },
  { prefix: "/owners", permission: "owners:read" },
  { prefix: "/leads", permission: "leads:read" },
  { prefix: "/pipeline", permission: "pipeline:read" },
  { prefix: "/contacts", permission: "contacts:read" },
  { prefix: "/quotes", permission: "quotes:read" },
  { prefix: "/quotations", permission: "quotes:read" },
  { prefix: "/contracts", permission: "contracts:read" },
  { prefix: "/bookings", permission: "bookings:read" },
  { prefix: "/availability", permission: "bookings:read" },
  { prefix: "/tasks", permission: "tasks:read" },
  { prefix: "/invoices", permission: "invoices:read" },
  { prefix: "/payments", permission: "payments:read" },
  { prefix: "/finance", permission: "finance:read" },
  { prefix: "/payouts", permission: "payouts:read" },
  { prefix: "/commissions", permission: "commissions:read" },
  { prefix: "/insurance", permission: "insurance:read" },
  { prefix: "/reports", permission: "analytics:read" },
  { prefix: "/analytics", permission: "analytics:read" },
  { prefix: "/vendors", permission: "vendors:read" },
  { prefix: "/packages", permission: "packages:read" },
  { prefix: "/pricing", permission: "pricing:read" },
  { prefix: "/menu", permission: "menu:read" },
  { prefix: "/inventory", permission: "inventory:read" },
  { prefix: "/rentals", permission: "rentals:read" },
  { prefix: "/staff", permission: "staff:read" },
  { prefix: "/resources", permission: "resources:read" },
  { prefix: "/campaigns", permission: "campaigns:read" },
  { prefix: "/referrals", permission: "referrals:read" },
  { prefix: "/loyalty", permission: "loyalty:read" },
  { prefix: "/surveys", permission: "surveys:read" },
  { prefix: "/reviews", permission: "reviews:read" },
  { prefix: "/gallery", permission: "gallery:read" },
  { prefix: "/competitors", permission: "competitors:read" },
  { prefix: "/documents", permission: "documents:read" },
  { prefix: "/whatsapp", permission: "whatsapp:read" },
  { prefix: "/performance", permission: "performance:read" },
  { prefix: "/crm", permission: "communications:read" },
  { prefix: "/inquiries", permission: "leads:read" },
  { prefix: "/settings", permission: "settings:read" },
];

/** The permission a path requires (longest matching prefix wins), or null. */
export function routePermission(pathname: string): Permission | null {
  let best: { prefix: string; permission: Permission } | null = null;
  for (const r of ROUTE_PERMISSIONS) {
    const match = pathname === r.prefix || pathname.startsWith(r.prefix + "/");
    if (match && (!best || r.prefix.length > best.prefix.length)) best = r;
  }
  return best ? best.permission : null;
}

// ============================================================
// Permission Check Functions
// ============================================================

/**
 * Check if a user role has a specific permission.
 */
export function hasPermission(role: string, permission: string): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  return permissions.includes(permission as Permission);
}

/**
 * Get all permissions for a given user role.
 */
export function getUserPermissions(role: string): string[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/**
 * Check if a user role has ANY of the specified permissions.
 */
export function hasAnyPermission(
  role: string,
  permissions: string[]
): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

/**
 * Check if a user role has ALL of the specified permissions.
 */
export function hasAllPermissions(
  role: string,
  permissions: string[]
): boolean {
  return permissions.every((permission) => hasPermission(role, permission));
}
