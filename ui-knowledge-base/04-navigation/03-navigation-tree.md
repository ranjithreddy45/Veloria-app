# Master Navigation Tree

Below is the complete hierarchical tree of the Veloria Grand Sidebar Navigation as defined in `src/config/navigation.ts`:

```markdown
Veloria Grand Application Shell
├── Dashboard (/dashboard) [Icon: LayoutDashboard] [Perm: dashboard:read]
├── My Work (/my-work) [Icon: ClipboardList] [Perm: dashboard:read]
├── Team Chat (/chat) [Icon: MessagesSquare] [Perm: dashboard:read]
├── Playbook (/playbook) [Icon: Workflow] [Perm: dashboard:read]
│
├── BD CRM (/bd/dashboard) [Icon: Building2] [Perm: owners:read]
│   ├── Dashboard (/bd/dashboard) [Icon: LayoutDashboard]
│   ├── Leads (/bd/leads) [Icon: Inbox]
│   ├── Deal Board (/bd/deals) [Icon: Kanban]
│   ├── Contracts (/bd/contracts) [Icon: FileText]
│   ├── Properties (/bd/properties) [Icon: Building2]
│   └── Hall Owners (/owners) [Icon: Users]
│
├── Sales CRM (/contacts) [Icon: Users] [Perm: contacts:read, leads:read]
│   ├── Dashboard (/sales/dashboard) [Icon: LayoutDashboard]
│   ├── Reports (/sales/reports) [Icon: BarChart3]
│   ├── My Calendar (/calendar) [Icon: Calendar]
│   ├── Enquiry (/contacts) [Icon: Contact]
│   ├── Leads (/leads) [Icon: UserPlus]
│   ├── Speed-to-Lead (/leads/sla) [Gated: LEAD_OPS_PAGES_ENABLED]
│   ├── SLA War-Room (/leads/war-room) [Gated: LEAD_OPS_PAGES_ENABLED]
│   ├── Missed Calls (/leads/missed-calls) [Gated: LEAD_OPS_PAGES_ENABLED]
│   ├── Cooling Leads (/leads/cooling) [Gated: LEAD_OPS_PAGES_ENABLED]
│   ├── Public Quotes (/settings/public-quotes) [Icon: Calculator]
│   ├── Follow-ups (/leads/followups) [Icon: CalendarClock]
│   ├── Web Inquiries (/inquiries) [Icon: Inbox]
│   ├── Pipeline (/pipeline) [Icon: Kanban]
│   ├── Quotations (/quotations) [Icon: Calculator]
│   ├── Contracts (/contracts) [Icon: FileSignature]
│   └── Approvals (/approvals) [Icon: ShieldCheck]
│
├── Engagement (/crm/cadences) [Icon: Activity] [Perm: communications:read, whatsapp:read]
│   ├── Inbox (/crm/inbox) [Icon: Inbox]
│   ├── Cadences (/crm/cadences) [Icon: ListOrdered]
│   ├── Sales Signals (/crm/signals) [Icon: Activity]
│   ├── Email Insights (/crm/email-tracking) [Icon: MailOpen]
│   ├── WhatsApp (/whatsapp) [Icon: MessageCircle]
│   ├── WhatsApp Console (/whatsapp/console) [Icon: MessagesSquare]
│   ├── Catalog Funnel (/whatsapp/catalog) [Icon: Package]
│   ├── SMS (/crm/sms) [Icon: MessageSquare]
│   └── Call Log (/crm/calls) [Icon: Phone]
│
├── Bookings (/bookings) [Icon: CalendarCheck] [Perm: bookings:read]
│   ├── All Bookings (/bookings) [Icon: List]
│   ├── Calendar (/bookings/calendar) [Icon: Calendar]
│   ├── Slot Availability (/availability) [Icon: CalendarClock]
│   ├── Sell-Down Board (/availability/sell-down) [Icon: Target]
│   ├── Site Visits (/site-visits) [Icon: CalendarCheck]
│   ├── Guest Draw (/admin/draw) [Icon: Gift]
│   └── Customer Concierge (/concierge) [Icon: MessagesSquare]
│
├── Projects (/projects) [Icon: Building2] [Perm: projects:read]
│   ├── Venues (/projects) [Icon: Building2]
│   ├── Portfolio (/projects/portfolio) [Icon: BarChart3]
│   ├── CapEx Rate Card (/projects/rate-card) [Icon: Calculator]
│   └── Vendors (/projects/vendors) [Icon: Truck]
│
├── Operations (/tasks) [Icon: Cog] [Perm: tasks:read, vendors:read, staff:read]
│   ├── Bookings / Event List (/bookings) [Icon: CalendarCheck]
│   ├── Tasks (/tasks) [Icon: CheckSquare]
│   ├── Task Templates (/tasks/templates) [Icon: Copy]
│   ├── Vendors (/vendors) [Icon: Store]
│   ├── Resources (/resources) [Icon: Boxes]
│   ├── Staff (/staff) [Icon: UserCog]
│   └── SOP Templates (/settings/sop-templates) [Icon: FileCheck]
│
├── Event Operations (/beo) [Icon: ClipboardList] [Perm: beo:read, kitchen:read]
│   ├── Function Sheets (BEO) (/beo) [Icon: FileText]
│   └── Kitchen & F&B (/kitchen) [Icon: UtensilsCrossed]
│
├── Supply Chain (/procurement) [Icon: Package] [Perm: procurement:read, logistics:read]
│   ├── Procurement (/procurement) [Icon: Package]
│   └── Logistics & Dispatch (/logistics) [Icon: Truck]
│
├── Support (/support) [Icon: Inbox] [Perm: support:read]
│   └── Tickets (/support) [Icon: Inbox]
│
├── Recruitment (/recruitment) [Icon: Briefcase] [Perm: recruit:read]
│   ├── Overview (/recruitment) [Icon: Gauge]
│   ├── Job Openings (/recruitment/jobs) [Icon: Briefcase]
│   ├── Candidates (/recruitment/candidates) [Icon: Users]
│   ├── Applications (/recruitment/applications) [Icon: ClipboardList]
│   ├── Offers (/recruitment/offers) [Icon: FileSignature]
│   └── Background Checks (/recruitment/bgv) [Icon: ShieldCheck]
│
├── My HR (/me/attendance) [Icon: Contact] [Perm: Always Visible]
│   ├── My Attendance (/me/attendance) [Icon: Clock]
│   ├── My Leave (/me/leave) [Icon: CalendarCheck]
│   ├── My Payslips (/me/payslips) [Icon: FileText]
│   ├── My Reimbursements (/me/reimbursements) [Icon: Receipt]
│   ├── My Approvals (/me/approvals) [Icon: CheckCircle2]
│   ├── Employee Handbook (/people/handbook) [Icon: BookOpen]
│   ├── Help Desk (/me/helpdesk) [Icon: MessageCircle]
│   └── Security & 2FA (/me/security) [Icon: ShieldCheck]
│
├── People (/people) [Icon: Users] [Perm: hr:read]
│   ├── Directory (/people) [Icon: Contact]
│   ├── Org Chart (/people/org) [Icon: Network]
│   ├── Joining & Exits (/people/lifecycle) [Icon: UserPlus]
│   ├── Documents (/people/documents) [Icon: FileText]
│   └── Employee Handbook (/people/handbook) [Icon: FileText]
│
├── Time & Attendance (/people/attendance) [Icon: Clock] [Perm: hr:read]
│   ├── Attendance (/people/attendance) [Icon: Clock]
│   ├── Muster (/people/attendance/muster) [Icon: ClipboardList]
│   ├── Leave (/people/leave) [Icon: CalendarCheck]
│   ├── Comp-off (/people/leave/comp-off) [Icon: CalendarClock]
│   ├── Holidays (/people/leave/holidays) [Icon: CalendarHeart]
│   ├── Shifts (/people/shifts) [Icon: CalendarClock]
│   ├── Timesheets (/people/timesheets) [Icon: Clock]
│   └── Attendance Policy (/people/attendance/policy) [Icon: ShieldCheck]
│
├── Performance (/people/performance) [Icon: Target] [Perm: hr:read]
│   ├── Reviews (/people/performance) [Icon: Target]
│   ├── OKRs (/people/okr) [Icon: Gauge]
│   ├── Engagement (/people/engagement) [Icon: Star]
│   └── Learning (/people/lms) [Icon: Award]
│
├── HR Admin (/people/analytics) [Icon: ShieldCheck] [Perm: hr:read]
│   ├── Analytics (/people/analytics) [Icon: BarChart3]
│   ├── Reports (/people/reports) [Icon: FileText]
│   ├── Help Desk (/people/helpdesk) [Icon: MessageCircle]
│   ├── Change Requests (/people/requests) [Icon: Inbox]
│   ├── Compensation (/people/compensation) [Icon: IndianRupee]
│   ├── Pay Grades (/people/settings/grades) [Icon: Award]
│   ├── Required Documents (/people/settings/required-docs) [Icon: FileCheck]
│   ├── Reminders (/people/settings/reminders) [Icon: Bell]
│   └── Settings (/people/settings) [Icon: Settings]
│
├── Payroll (/people/payroll) [Icon: IndianRupee] [Perm: hr:payroll, hr:read]
│   ├── Attendance Sheet (/people/payroll/attendance-sheet) [Icon: ClipboardList]
│   ├── Payroll Runs (/people/payroll) [Icon: CreditCard]
│   ├── Disbursement (/people/payroll/disbursement) [Icon: Banknote]
│   ├── Salary Advances (/people/payroll/advances) [Icon: DollarSign]
│   ├── Arrears (/people/payroll/arrears) [Icon: ListOrdered]
│   ├── Reimbursements (/people/payroll/reimbursements) [Icon: Receipt]
│   ├── Recurring Pay (/people/payroll/recurring) [Icon: Repeat]
│   ├── Statutory Registers (/people/payroll/registers) [Icon: ClipboardList]
│   ├── Statutory Config (/people/payroll/statutory-config) [Icon: Landmark]
│   ├── Gratuity (/people/gratuity) [Icon: Gift]
│   ├── Full & Final (/people/payroll/fnf) [Icon: FileInput]
│   ├── Pay Components (/people/payroll/settings) [Icon: Settings]
│   └── Reimbursement Approvers (/people/payroll/reimbursements/approvers) [Icon: UserCheck]
│
├── Catalog (/packages) [Icon: Package] [Perm: packages:read, menu:read, pricing:read]
│   ├── Packages (/packages) [Icon: Gift]
│   ├── Menu (/menu) [Icon: UtensilsCrossed]
│   ├── Pricing (/pricing) [Icon: DollarSign]
│   ├── Yield Pricing (/pricing/yield) [Icon: TrendingUp]
│   ├── Date Demand (/pricing/demand) [Icon: CalendarHeart]
│   ├── Inventory (/inventory) [Icon: Warehouse]
│   └── Rentals (/rentals) [Icon: Truck]
│
├── Accounting (/finance) [Icon: Scale] [Perm: finance:read]
│   ├── General Ledger (/finance) [Icon: Scale]
│   ├── Bank & Reconcile (/finance/bank) [Icon: Landmark]
│   ├── Reports (/finance/reports) [Icon: TrendingUp]
│   ├── Event Profitability (/finance/reports/event-profitability) [Icon: TrendingUp]
│   ├── Tax & Compliance (/finance/tax) [Icon: Percent]
│   └── Reimbursements (/finance/reimbursements) [Icon: Receipt]
│
├── Treasury & Planning (/finance/command-center) [Icon: Gauge] [Perm: finance:read]
│   ├── Command Center (/finance/command-center) [Icon: Gauge]
│   ├── Cash Flow (/finance/cash-flow) [Icon: LineChart]
│   ├── Budgets (/finance/budgets) [Icon: Calculator]
│   └── Anomalies (/finance/anomalies) [Icon: ShieldCheck]
│
├── Billing (/invoices) [Icon: FileText] [Perm: invoices:read, payments:read]
│   ├── Invoices (/invoices) [Icon: FileText]
│   └── Payments (/payments) [Icon: CreditCard]
│
├── Payables & Assets (/payouts) [Icon: Banknote] [Perm: payouts:read, finance:read]
│   ├── Payouts (/payouts) [Icon: Banknote]
│   ├── Vendor Bills (/payouts/bills) [Icon: Receipt]
│   ├── Commissions (/commissions) [Icon: Percent]
│   ├── Payroll (/finance/payroll) [Icon: Banknote]
│   ├── Fixed Assets (/finance/assets) [Icon: Boxes]
│   └── Insurance (/insurance) [Icon: Shield]
│
├── Marketing (/campaigns) [Icon: Megaphone] [Perm: campaigns:read, marketing:read]
│   ├── Campaigns (/campaigns) [Icon: Send]
│   ├── Win-back (/marketing/winback) [Icon: History]
│   ├── Corporate Accounts (/accounts) [Icon: Building2]
│   ├── Loyalty (/loyalty) [Icon: Star]
│   └── Referrals (/referrals) [Icon: Gift]
│       ├── All Referrals (/referrals)
│       ├── Dashboard (/referrals/dashboard)
│       ├── Leaderboard (/referrals/leaderboard)
│       ├── Partner Portal (/referrals/partners)
│       ├── Rewards (/referrals/rewards)
│       └── Assets (/referrals/assets)
│
├── Analytics (/reports) [Icon: BarChart3] [Perm: analytics:read, dashboard:analytics]
│   ├── Reports (/reports) [Icon: BarChart3]
│   ├── Marketing (/marketing) [Icon: Megaphone]
│   ├── Campaigns (spend) (/marketing/campaigns) [Icon: Target]
│   ├── Marketing attribution (/reports/marketing-attribution) [Icon: Target]
│   ├── Brochures (/marketing/brochures) [Icon: FileImage]
│   ├── Analytics (/analytics) [Icon: LineChart]
│   ├── Quality & Six Sigma (/quality) [Icon: Activity]
│   ├── Performance (/performance) [Icon: Gauge]
│   │   ├── KRA Scorecards (/performance/kra)
│   │   ├── Velos (/performance/velos)
│   │   ├── Scores (/performance/scores)
│   │   ├── Leaderboard (/performance/leaderboard)
│   │   ├── Badges (/performance/badges)
│   │   ├── Vendors (/performance/vendors)
│   │   └── Incentives (/performance/incentives)
│   ├── Agent Activity (/analytics/agents) [Icon: UserCog]
│   ├── Anomalies (/analytics/anomalies) [Icon: AlertOctagon]
│   ├── Forecast (/analytics/forecast) [Icon: TrendingUp]
│   ├── Budget (/analytics/budget) [Icon: Calculator]
│   ├── Competitors (/competitors) [Icon: Swords]
│   ├── Surveys (/surveys) [Icon: ClipboardList]
│   ├── Reviews (/reviews) [Icon: Star]
│   └── Feedback (/feedback) [Icon: MessageSquare]
│
├── Documents (/documents) [Icon: FolderOpen] [Perm: documents:read]
├── Gallery (/gallery) [Icon: Image] [Perm: gallery:read]
├── Franchise (/franchise) [Icon: Network] [Perm: franchise:read]
│   ├── Partners (/franchise) [Icon: Store]
│   └── New Partner (/franchise/new) [Icon: UserPlus]
│
└── Settings (/settings) [Icon: Settings] [Perm: settings:read, users:read]
    ├── Venues (/settings/venues)
    ├── Business Contact (/settings/business-contact)
    ├── Customer Content (/settings/customer-content)
    ├── Pipeline (/settings/pipeline)
    ├── Contract Templates (/settings/contract-templates)
    ├── Users (/settings/users)
    ├── Roles & Permissions (/settings/roles)
    ├── Privacy & Consent (/settings/privacy)
    ├── Email Templates (/settings/email-templates)
    ├── Workflows (/settings/workflows)
    ├── Integrations (/settings/integrations)
    ├── Integration Health (/settings/integrations/health)
    ├── System Health (/settings/system-health)
    ├── Google Ads (/settings/google-ads)
    ├── OTA Syndication (/settings/integrations/ota)
    ├── Emergency Response (/settings/emergency)
    ├── Notifications (/settings/notifications)
    ├── Activity Log (/settings/activity-log)
    ├── Escalation Rules (/settings/escalation-rules)
    ├── Referral Rules (/settings/referral-rules)
    ├── Assignment Rules (/settings/assignment-rules)
    ├── Smart Routing (/settings/routing)
    ├── Rep Availability (/settings/rep-availability)
    ├── WhatsApp Auto-Catalog (/settings/whatsapp-catalog)
    ├── Macros (/settings/macros)
    ├── Scoring Rules (/settings/scoring-rules)
    ├── Approval Rules (/settings/approval-rules)
    ├── Webforms (/settings/webforms)
    └── Blueprints (/settings/blueprints)
```
