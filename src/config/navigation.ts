// ============================================================
// Sidebar Navigation Configuration
// ============================================================

export interface NavItem {
  title: string;
  href: string;
  icon: string;
  permissions: string[];
  children?: NavItem[];
}

export const sidebarNavigation: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: "LayoutDashboard",
    permissions: ["dashboard:read"],
  },
  {
    title: "CRM",
    href: "/contacts",
    icon: "Users",
    permissions: ["contacts:read", "leads:read"],
    children: [
      {
        title: "Contacts",
        href: "/contacts",
        icon: "Contact",
        permissions: ["contacts:read"],
      },
      {
        title: "Leads",
        href: "/leads",
        icon: "UserPlus",
        permissions: ["leads:read"],
      },
      {
        title: "Sales Signals",
        href: "/crm/signals",
        icon: "Activity",
        permissions: ["contacts:read", "leads:read"],
      },
      {
        title: "Cadences",
        href: "/crm/cadences",
        icon: "ListOrdered",
        permissions: ["leads:read"],
      },
      {
        title: "Email Insights",
        href: "/crm/email-tracking",
        icon: "MailOpen",
        permissions: ["contacts:read"],
      },
      {
        title: "WhatsApp",
        href: "/whatsapp",
        icon: "MessageCircle",
        permissions: ["whatsapp:read"],
      },
      {
        title: "Call Log",
        href: "/crm/calls",
        icon: "Phone",
        permissions: ["contacts:read", "leads:read"],
      },
    ],
  },
  {
    title: "Approvals",
    href: "/approvals",
    icon: "ShieldCheck",
    permissions: ["settings:read", "leads:read", "contacts:read"],
  },
  {
    title: "Sales",
    href: "/pipeline",
    icon: "TrendingUp",
    permissions: ["pipeline:read", "quotes:read", "contracts:read"],
    children: [
      {
        title: "Pipeline",
        href: "/pipeline",
        icon: "Kanban",
        permissions: ["pipeline:read"],
      },
      {
        title: "Quotes",
        href: "/quotes",
        icon: "FileText",
        permissions: ["quotes:read"],
      },
      {
        title: "Contracts",
        href: "/contracts",
        icon: "FileSignature",
        permissions: ["contracts:read"],
      },
    ],
  },
  {
    title: "Bookings",
    href: "/bookings",
    icon: "CalendarCheck",
    permissions: ["bookings:read"],
    children: [
      {
        title: "All Bookings",
        href: "/bookings",
        icon: "List",
        permissions: ["bookings:read"],
      },
      {
        title: "Calendar",
        href: "/bookings/calendar",
        icon: "Calendar",
        permissions: ["bookings:read"],
      },
      {
        title: "Inquiries",
        href: "/inquiries",
        icon: "Inbox",
        permissions: ["bookings:read"],
      },
    ],
  },
  {
    title: "Operations",
    href: "/tasks",
    icon: "Cog",
    permissions: ["tasks:read", "vendors:read", "resources:read", "staff:read"],
    children: [
      {
        title: "Tasks",
        href: "/tasks",
        icon: "CheckSquare",
        permissions: ["tasks:read"],
      },
      {
        title: "Task Templates",
        href: "/tasks/templates",
        icon: "Copy",
        permissions: ["tasks:read"],
      },
      {
        title: "Vendors",
        href: "/vendors",
        icon: "Store",
        permissions: ["vendors:read"],
      },
      {
        title: "Resources",
        href: "/resources",
        icon: "Boxes",
        permissions: ["resources:read"],
      },
      {
        title: "Staff",
        href: "/staff",
        icon: "UserCog",
        permissions: ["staff:read"],
      },
      {
        title: "SOP Templates",
        href: "/settings/sop-templates",
        icon: "FileCheck",
        permissions: ["sop:read"],
      },
    ],
  },
  {
    title: "Catalog",
    href: "/packages",
    icon: "Package",
    permissions: ["packages:read", "pricing:read", "menu:read", "inventory:read", "rentals:read"],
    children: [
      {
        title: "Packages",
        href: "/packages",
        icon: "Gift",
        permissions: ["packages:read"],
      },
      {
        title: "Menu",
        href: "/menu",
        icon: "UtensilsCrossed",
        permissions: ["menu:read"],
      },
      {
        title: "Pricing",
        href: "/pricing",
        icon: "DollarSign",
        permissions: ["pricing:read"],
      },
      {
        title: "Inventory",
        href: "/inventory",
        icon: "Warehouse",
        permissions: ["inventory:read"],
      },
      {
        title: "Rentals",
        href: "/rentals",
        icon: "Truck",
        permissions: ["rentals:read"],
      },
    ],
  },
  {
    title: "Finance",
    href: "/invoices",
    icon: "IndianRupee",
    permissions: ["invoices:read", "payments:read", "payouts:read", "commissions:read", "insurance:read"],
    children: [
      {
        title: "Invoices",
        href: "/invoices",
        icon: "FileText",
        permissions: ["invoices:read"],
      },
      {
        title: "Payments",
        href: "/payments",
        icon: "CreditCard",
        permissions: ["payments:read"],
      },
      {
        title: "Payouts",
        href: "/payouts",
        icon: "Banknote",
        permissions: ["payouts:read"],
      },
      {
        title: "Commissions",
        href: "/commissions",
        icon: "Percent",
        permissions: ["commissions:read"],
      },
      {
        title: "Insurance",
        href: "/insurance",
        icon: "Shield",
        permissions: ["insurance:read"],
      },
    ],
  },
  {
    title: "Marketing",
    href: "/campaigns",
    icon: "Megaphone",
    permissions: ["campaigns:read", "referrals:read", "social:read", "loyalty:read"],
    children: [
      {
        title: "Campaigns",
        href: "/campaigns",
        icon: "Send",
        permissions: ["campaigns:read"],
      },
      {
        title: "Loyalty",
        href: "/loyalty",
        icon: "Star",
        permissions: ["loyalty:read"],
      },
      {
        title: "Referrals",
        href: "/referrals",
        icon: "Gift",
        permissions: ["referrals:read"],
        children: [
          {
            title: "All Referrals",
            href: "/referrals",
            icon: "List",
            permissions: ["referrals:read"],
          },
          {
            title: "Dashboard",
            href: "/referrals/dashboard",
            icon: "LayoutDashboard",
            permissions: ["referrals:read"],
          },
          {
            title: "Leaderboard",
            href: "/referrals/leaderboard",
            icon: "Trophy",
            permissions: ["referrals:read"],
          },
          {
            title: "Rewards",
            href: "/referrals/rewards",
            icon: "Gift",
            permissions: ["referrals:rewards"],
          },
          {
            title: "Assets",
            href: "/referrals/assets",
            icon: "Image",
            permissions: ["referrals:assets"],
          },
        ],
      },
    ],
  },
  {
    title: "Analytics",
    href: "/reports",
    icon: "BarChart3",
    permissions: ["dashboard:analytics", "analytics:read", "forecast:read", "budget:read", "surveys:read", "reviews:read", "performance:read", "competitors:read"],
    children: [
      {
        title: "Reports",
        href: "/reports",
        icon: "BarChart3",
        permissions: ["dashboard:analytics"],
      },
      {
        title: "Analytics",
        href: "/analytics",
        icon: "LineChart",
        permissions: ["analytics:read"],
      },
      {
        title: "Performance",
        href: "/performance",
        icon: "Gauge",
        permissions: ["performance:read"],
        children: [
          {
            title: "Scores",
            href: "/performance/scores",
            icon: "BarChart3",
            permissions: ["performance:read"],
          },
          {
            title: "Leaderboard",
            href: "/performance/leaderboard",
            icon: "Trophy",
            permissions: ["performance:read"],
          },
          {
            title: "Badges",
            href: "/performance/badges",
            icon: "Medal",
            permissions: ["performance:read"],
          },
          {
            title: "Vendors",
            href: "/performance/vendors",
            icon: "Users",
            permissions: ["performance:read"],
          },
          {
            title: "Incentives",
            href: "/performance/incentives",
            icon: "Gift",
            permissions: ["performance:manage"],
          },
        ],
      },
      {
        title: "Agent Activity",
        href: "/analytics/agents",
        icon: "UserCog",
        permissions: ["performance:read"],
      },
      {
        title: "Anomalies",
        href: "/analytics/anomalies",
        icon: "AlertOctagon",
        permissions: ["analytics:read"],
      },
      {
        title: "Forecast",
        href: "/analytics/forecast",
        icon: "TrendingUp",
        permissions: ["forecast:read"],
      },
      {
        title: "Budget",
        href: "/analytics/budget",
        icon: "Calculator",
        permissions: ["budget:read"],
      },
      {
        title: "Competitors",
        href: "/competitors",
        icon: "Swords",
        permissions: ["competitors:read"],
      },
      {
        title: "Surveys",
        href: "/surveys",
        icon: "ClipboardList",
        permissions: ["surveys:read"],
      },
      {
        title: "Reviews",
        href: "/reviews",
        icon: "Star",
        permissions: ["reviews:read"],
      },
    ],
  },
  {
    title: "Documents",
    href: "/documents",
    icon: "FolderOpen",
    permissions: ["documents:read"],
  },
  {
    title: "Gallery",
    href: "/gallery",
    icon: "Image",
    permissions: ["gallery:read"],
  },
  {
    title: "Settings",
    href: "/settings",
    icon: "Settings",
    permissions: ["settings:read", "users:read"],
    children: [
      {
        title: "Venues",
        href: "/settings/venues",
        icon: "MapPin",
        permissions: ["settings:venues"],
      },
      {
        title: "Pipeline",
        href: "/settings/pipeline",
        icon: "Kanban",
        permissions: ["pipeline:manage"],
      },
      {
        title: "Contract Templates",
        href: "/settings/contract-templates",
        icon: "FileSignature",
        permissions: ["settings:templates"],
      },
      {
        title: "Users",
        href: "/settings/users",
        icon: "Users",
        permissions: ["users:read"],
      },
      {
        title: "Email Templates",
        href: "/settings/email-templates",
        icon: "Mail",
        permissions: ["email-templates:read"],
      },
      {
        title: "Workflows",
        href: "/settings/workflows",
        icon: "Workflow",
        permissions: ["workflows:read"],
      },
      {
        title: "Integrations",
        href: "/settings/integrations",
        icon: "Plug",
        permissions: ["settings:read"],
      },
      {
        title: "Lead Capture",
        href: "/settings/integrations/lead-capture",
        icon: "Webhook",
        permissions: ["settings:read"],
      },
      {
        title: "Telephony",
        href: "/settings/integrations/telephony",
        icon: "PhoneCall",
        permissions: ["settings:read"],
      },
      {
        title: "Emergency",
        href: "/settings/emergency",
        icon: "AlertTriangle",
        permissions: ["emergency:read"],
      },
      {
        title: "Notifications",
        href: "/settings/notifications",
        icon: "Bell",
        permissions: ["sms:read"],
      },
      {
        title: "Activity Log",
        href: "/settings/activity-log",
        icon: "History",
        permissions: ["settings:read"],
      },
      {
        title: "Escalation Rules",
        href: "/settings/escalation-rules",
        icon: "AlertTriangle",
        permissions: ["escalations:manage"],
      },
      {
        title: "Referral Rules",
        href: "/settings/referral-rules",
        icon: "Award",
        permissions: ["referrals:manage"],
      },
      {
        title: "Assignment Rules",
        href: "/settings/assignment-rules",
        icon: "Route",
        permissions: ["leads:read"],
      },
      {
        title: "Macros",
        href: "/settings/macros",
        icon: "Zap",
        permissions: ["contacts:read", "leads:read"],
      },
      {
        title: "Scoring Rules",
        href: "/settings/scoring-rules",
        icon: "Target",
        permissions: ["settings:read"],
      },
      {
        title: "Approval Rules",
        href: "/settings/approval-rules",
        icon: "ShieldCheck",
        permissions: ["settings:read"],
      },
      {
        title: "Webforms",
        href: "/settings/webforms",
        icon: "FileInput",
        permissions: ["settings:read"],
      },
      {
        title: "Blueprints",
        href: "/settings/blueprints",
        icon: "Workflow",
        permissions: ["settings:read"],
      },
    ],
  },
];

/**
 * Filter navigation items based on user's permissions.
 * An item is visible if the user has ANY of its required permissions.
 */
export function filterNavigationByPermissions(
  items: NavItem[],
  userPermissions: string[]
): NavItem[] {
  return items
    .filter((item) =>
      item.permissions.length === 0 ||
      item.permissions.some((p) => userPermissions.includes(p))
    )
    .map((item) => ({
      ...item,
      children: item.children
        ? filterNavigationByPermissions(item.children, userPermissions)
        : undefined,
    }))
    .filter(
      (item) =>
        !item.children || item.children.length > 0
    );
}
