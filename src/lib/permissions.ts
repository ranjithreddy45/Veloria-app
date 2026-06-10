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

const ALL_PERMISSIONS: Permission[] = [
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
    "pricing:read",
    "pricing:manage",
    "quotes:read",
    "quotes:create",
    "quotes:update",
    "quotes:delete",
    "quotes:send",
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
};

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
