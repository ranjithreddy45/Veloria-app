// ============================================================
// Sidebar Navigation Configuration
// ============================================================

import { LEAD_OPS_PAGES_ENABLED, PROJECTS_MODULE_ENABLED } from "@/config/feature-flags";

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
    title: "My work",
    href: "/my-work",
    icon: "ClipboardList",
    permissions: ["dashboard:read"],
  },
  {
    title: "Team chat",
    href: "/chat",
    icon: "MessagesSquare",
    permissions: ["dashboard:read"],
  },
  {
    title: "Playbook",
    href: "/playbook",
    icon: "Workflow",
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
        title: "Deal board",
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
        title: "Hall owners",
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
        title: "Dashboard",
        href: "/sales/dashboard",
        icon: "LayoutDashboard",
        permissions: ["leads:read"],
      },
      {
        // One CRM per team: Wedding / Corporate / Social side by side.
        title: "Team dashboard",
        href: "/sales/teams",
        icon: "Users",
        permissions: ["leads:read"],
      },
      {
        title: "Reports",
        href: "/sales/reports",
        icon: "BarChart3",
        permissions: ["leads:read"],
      },
      {
        title: "My calendar",
        href: "/calendar",
        icon: "Calendar",
        permissions: ["leads:read"],
      },
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
      // Lead-ops sub-modules — behind LEAD_OPS_PAGES_ENABLED (see
      // src/config/feature-flags.ts). Flip the flag to bring them back.
      ...(LEAD_OPS_PAGES_ENABLED
        ? [
            {
              title: "Speed-to-lead",
              href: "/leads/sla",
              icon: "Zap",
              permissions: ["leads:read"],
            },
            {
              title: "SLA war-room",
              href: "/leads/war-room",
              icon: "Siren",
              permissions: ["leads:read"],
            },
            {
              title: "Missed calls",
              href: "/leads/missed-calls",
              icon: "PhoneMissed",
              permissions: ["leads:read"],
            },
            {
              title: "Cooling leads",
              href: "/leads/cooling",
              icon: "Snowflake",
              permissions: ["leads:read"],
            },
          ]
        : []),
      {
        title: "Public quotes",
        href: "/settings/public-quotes",
        icon: "Calculator",
        permissions: ["publicquotes:read"],
      },
      {
        title: "Follow-ups",
        href: "/leads/followups",
        icon: "CalendarClock",
        permissions: ["leads:read"],
      },
      {
        title: "Web inquiries",
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
        title: "Inbox",
        href: "/crm/inbox",
        icon: "Inbox",
        permissions: ["communications:read"],
      },
      {
        title: "Cadences",
        href: "/crm/cadences",
        icon: "ListOrdered",
        permissions: ["communications:read"],
      },
      {
        title: "Sales signals",
        href: "/crm/signals",
        icon: "Activity",
        permissions: ["communications:read"],
      },
      {
        title: "Email insights",
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
        title: "WhatsApp console",
        href: "/whatsapp/console",
        icon: "MessagesSquare",
        permissions: ["whatsapp:read"],
      },
      {
        title: "Catalog funnel",
        href: "/whatsapp/catalog",
        icon: "Package",
        permissions: ["whatsapp:read"],
      },
      {
        title: "SMS",
        href: "/crm/sms",
        icon: "MessageSquare",
        permissions: ["sms:read"],
      },
      {
        title: "Call log",
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
        title: "All bookings",
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
        title: "Slot availability",
        href: "/availability",
        icon: "CalendarClock",
        permissions: ["bookings:read"],
      },
      {
        title: "Sell-down board",
        href: "/availability/sell-down",
        icon: "Target",
        permissions: ["bookings:read"],
      },
      {
        title: "Site visits",
        href: "/site-visits",
        icon: "CalendarCheck",
        permissions: ["tastings:read"],
      },
      {
        title: "Guest draw",
        href: "/admin/draw",
        icon: "Gift",
        permissions: ["bookings:read"],
      },
      {
        title: "Customer concierge",
        href: "/concierge",
        icon: "MessagesSquare",
        permissions: ["bookings:read"],
      },
    ],
  },
  // Projects — behind PROJECTS_MODULE_ENABLED (see src/config/feature-flags.ts).
  // Flip the flag to bring the whole band back.
  ...(PROJECTS_MODULE_ENABLED
    ? [
        {
          title: "Projects",
          href: "/projects",
          icon: "Building2",
          permissions: ["projects:read"],
          children: [
            { title: "Venues", href: "/projects", icon: "Building2", permissions: ["projects:read"] },
            { title: "Portfolio", href: "/projects/portfolio", icon: "BarChart3", permissions: ["projects:read"] },
            { title: "CapEx rate card", href: "/projects/rate-card", icon: "Calculator", permissions: ["projects:read"] },
            { title: "Vendors", href: "/projects/vendors", icon: "Truck", permissions: ["projects:read"] },
          ],
        },
      ]
    : []),
  {
    title: "Operations",
    href: "/tasks",
    icon: "Cog",
    permissions: ["tasks:read", "vendors:read", "resources:read", "staff:read", "bookings:read"],
    children: [
      {
        // CR-001: same Bookings dataset, second entry point under Operations.
        title: "Bookings / event list",
        href: "/bookings",
        icon: "CalendarCheck",
        permissions: ["bookings:read"],
      },
      {
        title: "Tasks",
        href: "/tasks",
        icon: "CheckSquare",
        permissions: ["tasks:read"],
      },
      {
        title: "Task templates",
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
        title: "SOP templates",
        href: "/settings/sop-templates",
        icon: "FileCheck",
        permissions: ["sop:read"],
      },
    ],
  },
  // New operational modules (banded under Delivery & Ops / Sales).
  {
    title: "Event operations",
    href: "/beo",
    icon: "ClipboardList",
    permissions: ["beo:read", "kitchen:read"],
    children: [
      { title: "Function sheets (BEO)", href: "/beo", icon: "FileText", permissions: ["beo:read"] },
      { title: "Kitchen & F&B", href: "/kitchen", icon: "UtensilsCrossed", permissions: ["kitchen:read"] },
    ],
  },
  {
    title: "Supply chain",
    href: "/procurement",
    icon: "Package",
    permissions: ["procurement:read", "logistics:read"],
    children: [
      { title: "Procurement", href: "/procurement", icon: "Package", permissions: ["procurement:read"] },
      { title: "Logistics & dispatch", href: "/logistics", icon: "Truck", permissions: ["logistics:read"] },
    ],
  },
  {
    title: "Support",
    href: "/support",
    icon: "Inbox",
    permissions: ["support:read"],
    children: [
      { title: "Tickets", href: "/support", icon: "Inbox", permissions: ["support:read"] },
    ],
  },
  {
    title: "Recruitment",
    href: "/recruitment",
    icon: "Briefcase",
    permissions: ["recruit:read"],
    children: [
      { title: "Overview", href: "/recruitment", icon: "Gauge", permissions: ["recruit:read"] },
      { title: "Job openings", href: "/recruitment/jobs", icon: "Briefcase", permissions: ["recruit:read"] },
      { title: "Candidates", href: "/recruitment/candidates", icon: "Users", permissions: ["recruit:read"] },
      { title: "Applications", href: "/recruitment/applications", icon: "ClipboardList", permissions: ["recruit:read"] },
      { title: "Offers", href: "/recruitment/offers", icon: "FileSignature", permissions: ["recruit:read"] },
      { title: "Background checks", href: "/recruitment/bgv", icon: "ShieldCheck", permissions: ["recruit:read"] },
    ],
  },
  // Employee self-service — visible to EVERY signed-in employee (empty
  // permissions = always shown), independent of the HR-admin nav below.
  // These MUST live under /me, not /people: ROUTE_PERMISSIONS gates the whole
  // "/people" prefix on hr:read, which STAFF does not hold — so /people/* links
  // here would render in the sidebar but dead-end at /not-authorized.
  {
    title: "My HR",
    href: "/me/attendance",
    icon: "Contact",
    permissions: [],
    children: [
      { title: "My attendance", href: "/me/attendance", icon: "Clock", permissions: [] },
      { title: "My leave", href: "/me/leave", icon: "CalendarCheck", permissions: [] },
      { title: "My payslips", href: "/me/payslips", icon: "FileText", permissions: [] },
      { title: "My reimbursements", href: "/me/reimbursements", icon: "Receipt", permissions: [] },
      // Claims waiting on THIS user's approval (level 1 / level 2 approvers).
      { title: "My approvals", href: "/me/approvals", icon: "CheckCircle2", permissions: [] },
      // The handbook is for everyone. Its route is open (dashboard:read
      // override in permissions.ts) but it used to be linked only from the
      // hr:read-gated People section, so ordinary staff never saw it exist.
      { title: "Employee handbook", href: "/people/handbook", icon: "BookOpen", permissions: [] },
      { title: "Help desk", href: "/me/helpdesk", icon: "MessageCircle", permissions: [] },
      // Self-service two-factor enrolment. Lives under /me so every staff role
      // can reach it (the /settings tree is settings:read-gated in middleware).
      { title: "Security & 2FA", href: "/me/security", icon: "ShieldCheck", permissions: [] },
    ],
  },
  // People split into focused sub-modules so the team finds things fast.
  {
    title: "People",
    href: "/people",
    icon: "Users",
    permissions: ["hr:read"],
    children: [
      { title: "Directory", href: "/people", icon: "Contact", permissions: ["hr:read"] },
      { title: "Org chart", href: "/people/org", icon: "Network", permissions: ["hr:read"] },
      { title: "Joining & exits", href: "/people/lifecycle", icon: "UserPlus", permissions: ["hr:read"] },
      { title: "Documents", href: "/people/documents", icon: "FileText", permissions: ["hr:read"] },
      // Readable by ALL staff (route override in permissions.ts) — a handbook
      // that only HR can open defeats its purpose.
      { title: "Employee handbook", href: "/people/handbook", icon: "FileText", permissions: ["dashboard:read"] },
    ],
  },
  {
    title: "Time & attendance",
    href: "/people/attendance",
    icon: "Clock",
    permissions: ["hr:read"],
    children: [
      { title: "Attendance", href: "/people/attendance", icon: "Clock", permissions: ["hr:read"] },
      { title: "Muster", href: "/people/attendance/muster", icon: "ClipboardList", permissions: ["hr:read"] },
      { title: "Leave", href: "/people/leave", icon: "CalendarCheck", permissions: ["hr:read"] },
      { title: "Comp-off", href: "/people/leave/comp-off", icon: "CalendarClock", permissions: ["hr:read"] },
      { title: "Holidays", href: "/people/leave/holidays", icon: "CalendarHeart", permissions: ["hr:admin"] },
      { title: "Shifts", href: "/people/shifts", icon: "CalendarClock", permissions: ["hr:read"] },
      { title: "Timesheets", href: "/people/timesheets", icon: "Clock", permissions: ["hr:read"] },
      { title: "Attendance policy", href: "/people/attendance/policy", icon: "ShieldCheck", permissions: ["hr:admin"] },
    ],
  },
  {
    title: "Performance",
    href: "/people/performance",
    icon: "Target",
    permissions: ["hr:read"],
    children: [
      { title: "Reviews", href: "/people/performance", icon: "Target", permissions: ["hr:read"] },
      { title: "OKRs", href: "/people/okr", icon: "Gauge", permissions: ["hr:read"] },
      { title: "Engagement", href: "/people/engagement", icon: "Star", permissions: ["hr:read"] },
      { title: "Learning", href: "/people/lms", icon: "Award", permissions: ["hr:read"] },
    ],
  },
  {
    title: "HR admin",
    href: "/people/analytics",
    icon: "ShieldCheck",
    permissions: ["hr:read"],
    children: [
      { title: "Analytics", href: "/people/analytics", icon: "BarChart3", permissions: ["hr:read"] },
      { title: "Reports", href: "/people/reports", icon: "FileText", permissions: ["hr:read"] },
      { title: "Help desk", href: "/people/helpdesk", icon: "MessageCircle", permissions: ["hr:read"] },
      { title: "Change requests", href: "/people/requests", icon: "Inbox", permissions: ["hr:approve"] },
      { title: "Compensation", href: "/people/compensation", icon: "IndianRupee", permissions: ["hr:read"] },
      { title: "Pay grades", href: "/people/settings/grades", icon: "Award", permissions: ["hr:admin"] },
      { title: "Required documents", href: "/people/settings/required-docs", icon: "FileCheck", permissions: ["hr:admin"] },
      { title: "Reminders", href: "/people/settings/reminders", icon: "Bell", permissions: ["hr:admin"] },
      { title: "Settings", href: "/people/settings", icon: "Settings", permissions: ["hr:admin"] },
    ],
  },
  {
    title: "Payroll",
    href: "/people/payroll",
    icon: "IndianRupee",
    permissions: ["hr:payroll", "hr:read"],
    children: [
      { title: "Attendance sheet", href: "/people/payroll/attendance-sheet", icon: "ClipboardList", permissions: ["hr:payroll"] },
      { title: "Payroll runs", href: "/people/payroll", icon: "CreditCard", permissions: ["hr:payroll"] },
      { title: "Disbursement", href: "/people/payroll/disbursement", icon: "Banknote", permissions: ["hr:payroll"] },
      { title: "Salary advances", href: "/people/payroll/advances", icon: "DollarSign", permissions: ["hr:payroll"] },
      { title: "Arrears", href: "/people/payroll/arrears", icon: "ListOrdered", permissions: ["hr:payroll"] },
      { title: "Reimbursements", href: "/people/payroll/reimbursements", icon: "Receipt", permissions: ["hr:payroll"] },
      { title: "Recurring pay", href: "/people/payroll/recurring", icon: "Repeat", permissions: ["hr:payroll"] },
      { title: "Statutory registers", href: "/people/payroll/registers", icon: "ClipboardList", permissions: ["hr:payroll"] },
      { title: "Statutory config", href: "/people/payroll/statutory-config", icon: "Landmark", permissions: ["hr:payroll"] },
      { title: "Gratuity", href: "/people/gratuity", icon: "Gift", permissions: ["hr:payroll"] },
      { title: "Full & final", href: "/people/payroll/fnf", icon: "FileInput", permissions: ["hr:payroll"] },
      { title: "Pay components", href: "/people/payroll/settings", icon: "Settings", permissions: ["hr:payroll"] },
      { title: "Reimbursement approvers", href: "/people/payroll/reimbursements/approvers", icon: "UserCheck", permissions: ["hr:admin"] },
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
        title: "Yield pricing",
        href: "/pricing/yield",
        icon: "TrendingUp",
        permissions: ["pricing:read"],
      },
      {
        title: "Date demand",
        href: "/pricing/demand",
        icon: "CalendarHeart",
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
  // Finance split into focused sub-modules (banded under one "Finance" section
  // in the sidebar) so the long single dropdown is easy to scan.
  {
    title: "Accounting",
    href: "/finance",
    icon: "Scale",
    permissions: ["finance:read"],
    children: [
      { title: "General ledger", href: "/finance", icon: "Scale", permissions: ["finance:read"] },
      { title: "Bank & reconcile", href: "/finance/bank", icon: "Landmark", permissions: ["finance:read"] },
      { title: "Reports", href: "/finance/reports", icon: "TrendingUp", permissions: ["finance:read"] },
      { title: "Event profitability", href: "/finance/reports/event-profitability", icon: "TrendingUp", permissions: ["finance:read"] },
      { title: "Tax & compliance", href: "/finance/tax", icon: "Percent", permissions: ["finance:read"] },
      // Fully approved employee expense claims, ready to pay.
      { title: "Reimbursements", href: "/finance/reimbursements", icon: "Receipt", permissions: ["finance:read"] },
    ],
  },
  {
    title: "Treasury & planning",
    href: "/finance/command-center",
    icon: "Gauge",
    permissions: ["finance:read"],
    children: [
      { title: "Command center", href: "/finance/command-center", icon: "Gauge", permissions: ["finance:read"] },
      { title: "Cash flow", href: "/finance/cash-flow", icon: "LineChart", permissions: ["finance:read"] },
      { title: "Budgets", href: "/finance/budgets", icon: "Calculator", permissions: ["finance:read"] },
      { title: "Anomalies", href: "/finance/anomalies", icon: "ShieldCheck", permissions: ["finance:read"] },
    ],
  },
  {
    title: "Billing",
    href: "/invoices",
    icon: "FileText",
    permissions: ["invoices:read", "payments:read"],
    children: [
      { title: "Invoices", href: "/invoices", icon: "FileText", permissions: ["invoices:read"] },
      { title: "Payments", href: "/payments", icon: "CreditCard", permissions: ["payments:read"] },
    ],
  },
  {
    title: "Payables & assets",
    href: "/payouts",
    icon: "Banknote",
    permissions: ["payouts:read", "commissions:read", "insurance:read", "finance:read"],
    children: [
      { title: "Payouts", href: "/payouts", icon: "Banknote", permissions: ["payouts:read"] },
      { title: "Vendor bills", href: "/payouts/bills", icon: "Receipt", permissions: ["payouts:read"] },
      { title: "Commissions", href: "/commissions", icon: "Percent", permissions: ["commissions:read"] },
      { title: "Payroll", href: "/finance/payroll", icon: "Banknote", permissions: ["finance:read"] },
      { title: "Fixed assets", href: "/finance/assets", icon: "Boxes", permissions: ["finance:read"] },
      { title: "Insurance", href: "/insurance", icon: "Shield", permissions: ["insurance:read"] },
    ],
  },
  {
    title: "Marketing",
    href: "/campaigns",
    icon: "Megaphone",
    permissions: ["campaigns:read", "referrals:read", "social:read", "loyalty:read", "marketing:read", "accounts:read"],
    children: [
      {
        title: "Campaigns",
        href: "/campaigns",
        icon: "Send",
        permissions: ["campaigns:read"],
      },
      {
        title: "Win-back",
        href: "/marketing/winback",
        icon: "History",
        permissions: ["marketing:read"],
      },
      {
        title: "Corporate accounts",
        href: "/accounts",
        icon: "Building2",
        permissions: ["accounts:read"],
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
            title: "All referrals",
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
            title: "Partner portal",
            href: "/referrals/partners",
            icon: "Handshake",
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
    permissions: ["dashboard:analytics", "analytics:read", "forecast:read", "budget:read", "surveys:read", "reviews:read", "performance:read", "competitors:read", "quality:read"],
    children: [
      {
        title: "Reports",
        href: "/reports",
        icon: "BarChart3",
        permissions: ["dashboard:analytics"],
      },
      {
        title: "Marketing",
        href: "/marketing",
        icon: "Megaphone",
        permissions: ["analytics:read"],
      },
      {
        title: "Campaigns (spend)",
        href: "/marketing/campaigns",
        icon: "Target",
        permissions: ["marketing:read"],
      },
      {
        title: "Marketing attribution",
        href: "/reports/marketing-attribution",
        icon: "Target",
        permissions: ["leads:read"],
      },
      {
        title: "Brochures",
        href: "/marketing/brochures",
        icon: "FileImage",
        permissions: ["marketing:read"],
      },
      {
        title: "Analytics",
        href: "/analytics",
        icon: "LineChart",
        permissions: ["analytics:read"],
      },
      {
        title: "Quality & Six Sigma",
        href: "/quality",
        icon: "Activity",
        permissions: ["quality:read"],
      },
      {
        title: "Performance",
        href: "/performance",
        icon: "Gauge",
        permissions: ["performance:read"],
        children: [
          {
            title: "KRA scorecards",
            href: "/performance/kra",
            icon: "ClipboardList",
            permissions: ["performance:read"],
          },
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
        title: "Agent activity",
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
      {
        title: "Feedback",
        href: "/feedback",
        icon: "MessageSquare",
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
    title: "Franchise",
    href: "/franchise",
    icon: "Network",
    permissions: ["franchise:read"],
    children: [
      {
        title: "Partners",
        href: "/franchise",
        icon: "Store",
        permissions: ["franchise:read"],
      },
      {
        title: "New partner",
        href: "/franchise/new",
        icon: "UserPlus",
        permissions: ["franchise:onboard"],
      },
    ],
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
        title: "Business contact",
        href: "/settings/business-contact",
        icon: "Phone",
        permissions: ["settings:venues"],
      },
      {
        title: "Customer content",
        href: "/settings/customer-content",
        icon: "FileText",
        permissions: ["settings:venues"],
      },
      {
        title: "Pipeline",
        href: "/settings/pipeline",
        icon: "Kanban",
        permissions: ["pipeline:manage"],
      },
      {
        title: "Contract templates",
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
        title: "Roles & permissions",
        href: "/settings/roles",
        icon: "ShieldCheck",
        permissions: ["users:manage-roles"],
      },
      { title: "Privacy & consent", href: "/settings/privacy", icon: "ShieldCheck", permissions: ["users:manage-roles"] },
      {
        // Owner logins for the venue portal: lead / booking counts only.
        title: "Venue owners",
        href: "/settings/venue-owners",
        icon: "Building2",
        permissions: ["venue-owners:manage"],
      },
      {
        title: "Email templates",
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
        title: "Integration health",
        href: "/settings/integrations/health",
        icon: "PlugZap",
        permissions: ["settings:read"],
      },
      {
        title: "System health",
        href: "/settings/system-health",
        icon: "Activity",
        // ADMIN + SUPER_ADMIN only (the page re-checks the role itself).
        permissions: ["users:manage-roles"],
      },
      {
        title: "Google Ads",
        href: "/settings/google-ads",
        icon: "Target",
        permissions: ["settings:read"],
      },
      {
        title: "OTA syndication",
        href: "/settings/integrations/ota",
        icon: "Store",
        permissions: ["settings:read"],
      },
      {
        title: "Emergency response",
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
        title: "Activity log",
        href: "/settings/activity-log",
        icon: "History",
        permissions: ["settings:read"],
      },
      {
        title: "Escalation rules",
        href: "/settings/escalation-rules",
        icon: "AlertTriangle",
        permissions: ["escalations:manage"],
      },
      {
        title: "Referral rules",
        href: "/settings/referral-rules",
        icon: "Award",
        permissions: ["referrals:manage"],
      },
      {
        title: "Assignment rules",
        href: "/settings/assignment-rules",
        icon: "Route",
        permissions: ["leads:read"],
      },
      {
        title: "Smart routing",
        href: "/settings/routing",
        icon: "Route",
        // /settings/routing rides the broad /settings -> settings:read middleware
        // gate; visibility-gate the nav on the same key so we never advertise a
        // link that would bounce to /not-authorized.
        permissions: ["settings:read"],
      },
      {
        // Wedding / Corporate / Social teams: members, heads, auto-routing.
        title: "Sales teams",
        href: "/settings/sales-teams",
        icon: "Users",
        permissions: ["leads:assign"],
      },
      {
        title: "Rep availability",
        href: "/settings/rep-availability",
        icon: "UserCog",
        permissions: ["leads:read"],
      },
      {
        title: "WhatsApp auto-catalog",
        href: "/settings/whatsapp-catalog",
        icon: "Package",
        permissions: ["settings:update"],
      },
      {
        title: "Macros",
        href: "/settings/macros",
        icon: "Zap",
        permissions: ["contacts:read", "leads:read"],
      },
      {
        title: "Scoring rules",
        href: "/settings/scoring-rules",
        icon: "Target",
        permissions: ["settings:read"],
      },
      {
        title: "Approval rules",
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
