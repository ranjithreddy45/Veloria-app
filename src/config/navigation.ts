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
    title: "BD CRM",
    href: "/bd/dashboard",
    icon: "Building2",
    permissions: ["owners:read"],
    children: [
      {
        title: "Dashboard",
        href: "/bd/dashboard",
        icon: "LayoutDashboard",
        permissions: ["owners:read"],
      },
      {
        title: "Leads",
        href: "/bd/leads",
        icon: "Inbox",
        permissions: ["owners:read"],
      },
      {
        title: "Follow-ups",
        href: "/bd/followups",
        icon: "CalendarClock",
        permissions: ["owners:read"],
      },
      {
        title: "Deal Board",
        href: "/bd/deals",
        icon: "Kanban",
        permissions: ["owners:read"],
      },
      {
        title: "Contracts",
        href: "/bd/contracts",
        icon: "FileText",
        permissions: ["owners:read"],
      },
      {
        title: "Properties",
        href: "/bd/properties",
        icon: "Building2",
        permissions: ["owners:read"],
      },
      {
        title: "Hall Owners",
        href: "/owners",
        icon: "Users",
        permissions: ["owners:read"],
      },
    ],
  },
  {
    title: "Sales CRM",
    href: "/contacts",
    icon: "Users",
    permissions: ["contacts:read", "leads:read"],
    children: [
      {
        title: "Enquiry",
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
        title: "Follow-ups",
        href: "/leads/followups",
        icon: "CalendarClock",
        permissions: ["leads:read"],
      },
      {
        title: "Web Inquiries",
        href: "/inquiries",
        icon: "Inbox",
        permissions: ["leads:read"],
      },
      {
        title: "Pipeline",
        href: "/pipeline",
        icon: "Kanban",
        permissions: ["pipeline:read"],
      },
      {
        title: "Quotations",
        href: "/quotations",
        icon: "Calculator",
        permissions: ["quotes:read"],
      },
      {
        title: "Contracts",
        href: "/contracts",
        icon: "FileSignature",
        permissions: ["contracts:read"],
      },
      {
        title: "Approvals",
        href: "/approvals",
        icon: "ShieldCheck",
        permissions: ["leads:read", "contacts:read"],
      },
    ],
  },
  {
    title: "Engagement",
    href: "/crm/cadences",
    icon: "Activity",
    // /crm/* is gated by communications:read in middleware; gate the nav on the
    // same permission so we never advertise a link that bounces to /not-authorized.
    permissions: ["communications:read", "whatsapp:read"],
    children: [
      {
        title: "Cadences",
        href: "/crm/cadences",
        icon: "ListOrdered",
        permissions: ["communications:read"],
      },
      {
        title: "Sales Signals",
        href: "/crm/signals",
        icon: "Activity",
        permissions: ["communications:read"],
      },
      {
        title: "Email Insights",
        href: "/crm/email-tracking",
        icon: "MailOpen",
        permissions: ["communications:read"],
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
        permissions: ["communications:read"],
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
        title: "Slot Availability",
        href: "/availability",
        icon: "CalendarClock",
        permissions: ["bookings:read"],
      },
    ],
  },
  {
    title: "Projects",
    href: "/projects",
    icon: "Building2",
    permissions: ["projects:read"],
    children: [
      { title: "Venues", href: "/projects", icon: "Building2", permissions: ["projects:read"] },
      { title: "Portfolio", href: "/projects/portfolio", icon: "BarChart3", permissions: ["projects:read"] },
      { title: "CapEx Rate Card", href: "/projects/rate-card", icon: "Calculator", permissions: ["projects:read"] },
      { title: "Vendors", href: "/projects/vendors", icon: "Truck", permissions: ["projects:read"] },
    ],
  },
  {
    title: "People",
    href: "/people",
    icon: "Users",
    permissions: ["hr:read"],
    children: [
      {
        title: "Directory",
        href: "/people",
        icon: "Contact",
        permissions: ["hr:read"],
      },
      {
        title: "Org Chart",
        href: "/people/org",
        icon: "Network",
        permissions: ["hr:read"],
      },
      {
        title: "Leave",
        href: "/people/leave",
        icon: "CalendarCheck",
        permissions: ["hr:read"],
      },
      {
        title: "Attendance",
        href: "/people/attendance",
        icon: "Clock",
        permissions: ["hr:read"],
      },
      {
        title: "Documents",
        href: "/people/documents",
        icon: "FileText",
        permissions: ["hr:read"],
      },
      {
        title: "Joining & Exits",
        href: "/people/lifecycle",
        icon: "UserPlus",
        permissions: ["hr:read"],
      },
      {
        title: "Performance",
        href: "/people/performance",
        icon: "Target",
        permissions: ["hr:read"],
      },
      {
        title: "Shifts",
        href: "/people/shifts",
        icon: "CalendarClock",
        permissions: ["hr:read"],
      },
      {
        title: "Analytics",
        href: "/people/analytics",
        icon: "BarChart3",
        permissions: ["hr:read"],
      },
      {
        title: "Help Desk",
        href: "/people/helpdesk",
        icon: "MessageCircle",
        permissions: ["hr:read"],
      },
      {
        title: "Change Requests",
        href: "/people/requests",
        icon: "Inbox",
        permissions: ["hr:approve"],
      },
      {
        title: "Settings",
        href: "/people/settings",
        icon: "Settings",
        permissions: ["hr:admin"],
      },
      // P2 — roadmap stubs (nav present, "coming soon").
      { title: "Timesheets", href: "/people/timesheets", icon: "Clock", permissions: ["hr:read"] },
      { title: "OKR", href: "/people/okr", icon: "Target", permissions: ["hr:read"] },
      { title: "Compensation", href: "/people/compensation", icon: "IndianRupee", permissions: ["hr:read"] },
      { title: "Learning", href: "/people/lms", icon: "Award", permissions: ["hr:read"] },
      { title: "Engagement", href: "/people/engagement", icon: "Star", permissions: ["hr:read"] },
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
            title: "Velos",
            href: "/performance/velos",
            icon: "Sparkles",
            permissions: ["performance:read"],
          },
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
        title: "Roles & Permissions",
        href: "/settings/roles",
        icon: "ShieldCheck",
        permissions: ["users:manage-roles"],
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
