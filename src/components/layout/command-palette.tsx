"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Kanban,
  CalendarCheck,
  CheckSquare,
  FileText,
  IndianRupee,
  Settings,
  Search,
  Loader2,
  BarChart3,
  Plus,
  Clock,
  Sparkles,
  PhoneCall,
  Webhook,
  Building2,
  ArrowUpRight,
  CornerDownLeft,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { globalSearch, type SearchResult } from "@/actions/search.actions";

// ============================================================
// Quick navigation entries (shown on the empty landing view)
// ============================================================

const QUICK_NAV = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Contacts", href: "/contacts", icon: Users },
  { title: "Leads", href: "/leads", icon: UserPlus },
  { title: "Sales Pipeline", href: "/pipeline", icon: Kanban },
  { title: "Bookings", href: "/bookings", icon: CalendarCheck },
  { title: "Calls", href: "/crm/calls", icon: PhoneCall },
  { title: "Tasks", href: "/tasks", icon: CheckSquare },
  { title: "Invoices", href: "/invoices", icon: FileText },
  { title: "Payments", href: "/payments", icon: IndianRupee },
  { title: "Reports", href: "/reports", icon: BarChart3 },
  { title: "Workflows", href: "/settings/workflows", icon: Webhook },
  { title: "Settings", href: "/settings", icon: Settings },
];

// ============================================================
// Quick actions — direct shortcuts to "new X" forms
// ============================================================

const QUICK_ACTIONS = [
  { title: "New lead", href: "/leads/new", shortcut: "L", icon: UserPlus },
  { title: "New contact", href: "/contacts/new", shortcut: "C", icon: Users },
  { title: "New booking", href: "/bookings/new", shortcut: "B", icon: CalendarCheck },
  { title: "New invoice", href: "/invoices/new", shortcut: "I", icon: FileText },
  { title: "New quotation", href: "/quotations/new", shortcut: "Q", icon: FileText },
];

// ============================================================
// Page index — every key destination, with keywords/synonyms so typing
// "trial balance", "attendance", "payroll", "pto" jumps straight there.
// Matched instantly client-side (no network round-trip).
// ============================================================

type PageEntry = { label: string; href: string; keywords: string };

const PAGE_INDEX: PageEntry[] = [
  // Core
  { label: "Dashboard", href: "/dashboard", keywords: "home overview kpis" },
  { label: "Contacts", href: "/contacts", keywords: "customers people clients" },
  { label: "Leads", href: "/leads", keywords: "enquiries prospects sales crm" },
  { label: "SLA War-Room", href: "/leads/war-room", keywords: "sla breach escalation speed to lead overdue response" },
  { label: "Missed Calls", href: "/leads/missed-calls", keywords: "rescue telephony inbound call abandoned" },
  { label: "Cooling Leads", href: "/leads/cooling", keywords: "stale going cold dormant decay re-engage" },
  { label: "Sales Pipeline", href: "/pipeline", keywords: "deals stages kanban funnel" },
  { label: "Quotations", href: "/quotations", keywords: "quotes pricing estimate proposal" },
  { label: "Quotation Builder", href: "/quotations/new", keywords: "new quote calculator pricing hall food" },
  { label: "Bookings", href: "/bookings", keywords: "events reservations confirmed" },
  { label: "Calendar", href: "/calendar", keywords: "schedule events month" },
  { label: "Slot Availability", href: "/availability", keywords: "venue slots calendar afternoon evening full day" },
  { label: "Sell-Down Board", href: "/availability/sell-down", keywords: "empty date low occupancy fill inventory peak slots leads" },
  { label: "Site Visits", href: "/site-visits", keywords: "venue tour walkthrough visit booking appointment" },
  { label: "Invoices", href: "/invoices", keywords: "billing receivables ar" },
  { label: "Payments", href: "/payments", keywords: "receipts collections razorpay" },
  { label: "Contracts", href: "/contracts", keywords: "agreements signed" },
  { label: "Tasks", href: "/tasks", keywords: "todo work assignments ops" },
  { label: "Approvals", href: "/approvals", keywords: "maker checker sign off pending" },
  { label: "Web Inquiries", href: "/inquiries", keywords: "website form leads inbound" },
  { label: "Reports", href: "/reports", keywords: "exports summaries" },
  { label: "Analytics", href: "/analytics", keywords: "metrics charts insights" },
  { label: "Vendors", href: "/vendors", keywords: "suppliers partners catering decor" },
  { label: "Packages", href: "/pricing", keywords: "event packages tiers menu pricing" },
  { label: "Campaigns", href: "/campaigns", keywords: "marketing email blast promotions" },
  { label: "WhatsApp", href: "/whatsapp", keywords: "messages chat templates" },
  { label: "WhatsApp Console", href: "/whatsapp/console", keywords: "messages chat copilot session window reply" },
  { label: "Catalog Funnel", href: "/whatsapp/catalog", keywords: "whatsapp catalog interactive funnel auto reply" },
  { label: "Reviews", href: "/reviews", keywords: "ratings feedback reputation" },
  { label: "Surveys", href: "/surveys", keywords: "feedback nps forms" },
  { label: "Commissions", href: "/commissions", keywords: "payouts sales incentive" },
  { label: "Payouts", href: "/payouts", keywords: "vendor commissions disbursement" },
  { label: "Referrals", href: "/referrals", keywords: "affiliate partner" },
  { label: "Referral Partners", href: "/referrals/partners", keywords: "partner portal referral payout flywheel" },
  { label: "Corporate Accounts", href: "/accounts", keywords: "corporate farming b2b key accounts company re-engage" },
  { label: "Win-back", href: "/marketing/winback", keywords: "marketing recover lost lead abandoned quote re-engage" },
  { label: "Brochures", href: "/marketing/brochures", keywords: "marketing digital brochure catalog pdf share" },
  // Performance / motivation
  { label: "Performance", href: "/performance", keywords: "scorecard goals" },
  { label: "Velos", href: "/performance/velos", keywords: "points rewards leaderboard gamification streak" },
  { label: "KRA Scorecards", href: "/performance/kra", keywords: "kpi targets monthly scoring" },
  // BD CRM
  { label: "BD Leads", href: "/bd/leads", keywords: "acquisition business development properties" },
  { label: "BD Deals", href: "/bd/deals", keywords: "acquisition pipeline contracts" },
  { label: "BD Properties", href: "/bd/properties", keywords: "acquisition halls venues" },
  { label: "Hall Owners", href: "/owners", keywords: "b2b property owners landlords" },
  // Projects
  { label: "Projects", href: "/projects", keywords: "renovation capex fit-out handover" },
  { label: "Projects Portfolio", href: "/projects/portfolio", keywords: "all projects dashboard" },
  // Finance
  { label: "Finance", href: "/finance", keywords: "accounting gl ledger money" },
  { label: "Trial Balance", href: "/finance/trial-balance", keywords: "accounting tb gl report" },
  { label: "Profit & Loss", href: "/finance/pnl", keywords: "income statement p&l revenue expense" },
  { label: "Balance Sheet", href: "/finance/balance-sheet", keywords: "assets liabilities equity" },
  { label: "Budgets", href: "/finance/budgets", keywords: "planning variance" },
  { label: "Assets", href: "/finance/assets", keywords: "fixed assets depreciation" },
  { label: "Payroll", href: "/finance/payroll", keywords: "salary wages staff pay" },
  { label: "Bank Reconciliation", href: "/finance/bank", keywords: "statement reconcile matching" },
  // People / HR
  { label: "People Directory", href: "/people", keywords: "hr employees staff team directory" },
  { label: "Leave", href: "/people/leave", keywords: "hr time off pto holiday vacation" },
  { label: "Attendance", href: "/people/attendance", keywords: "hr muster check-in geo clock" },
  { label: "Documents", href: "/people/documents", keywords: "hr files policies acknowledge" },
  { label: "Onboarding", href: "/people/onboarding", keywords: "hr new joiner clearance" },
  { label: "Org Chart", href: "/people/org", keywords: "hr hierarchy reporting structure" },
  { label: "Recruitment", href: "/recruit", keywords: "ats hiring candidates jobs" },
  // Ops
  { label: "Support", href: "/support", keywords: "tickets helpdesk sla" },
  { label: "Kitchen / F&B", href: "/kitchen", keywords: "food beverage menu catering" },
  { label: "Function Sheet (BEO)", href: "/beo", keywords: "banquet event order ops" },
  { label: "Logistics", href: "/logistics", keywords: "dispatch inventory transport" },
  { label: "Procurement", href: "/procurement", keywords: "purchase orders buying" },
  // System
  { label: "Settings", href: "/settings", keywords: "preferences configuration admin" },
  { label: "Users", href: "/settings/users", keywords: "team members accounts admin" },
  { label: "Roles & Permissions", href: "/settings/roles", keywords: "rbac access control admin" },
  { label: "Workflows", href: "/settings/workflows", keywords: "automation triggers rules" },
  { label: "Smart Routing", href: "/settings/routing", keywords: "lead routing smart assignment rep match load balance" },
  { label: "Rep Availability", href: "/settings/rep-availability", keywords: "rep availability online offline load board" },
  { label: "WhatsApp Auto-Catalog", href: "/settings/whatsapp-catalog", keywords: "whatsapp catalog funnel config auto reply" },
  { label: "Venues", href: "/settings/venues", keywords: "halls properties locations" },
  { label: "Notifications", href: "/notifications", keywords: "alerts inbox" },
];

function matchPages(query: string): PageEntry[] {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  const scored = PAGE_INDEX.map((p) => {
    const hay = `${p.label} ${p.keywords} ${p.href}`.toLowerCase();
    const label = p.label.toLowerCase();
    const all = tokens.every((t) => hay.includes(t));
    if (!all) return null;
    // Rank: label starts with the whole query > label contains it > keyword-only match
    const q = query.trim().toLowerCase();
    let score = 10;
    if (label.startsWith(q)) score = 100;
    else if (label.includes(q)) score = 70;
    else if (tokens.every((t) => label.includes(t))) score = 50;
    return { p, score };
  }).filter(Boolean) as { p: PageEntry; score: number }[];
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 7).map((s) => s.p);
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  contact: Users,
  lead: UserPlus,
  booking: CalendarCheck,
  invoice: FileText,
  task: CheckSquare,
  quote: FileText,
  contract: FileText,
  vendor: Users,
  package: FileText,
  campaign: BarChart3,
  bd_lead: UserPlus,
  bd_deal: Kanban,
  bd_property: Building2,
  bd_owner: Users,
};

const TYPE_LABELS: Record<string, string> = {
  contact: "Contacts",
  lead: "Leads",
  booking: "Bookings",
  invoice: "Invoices",
  task: "Tasks",
  quote: "Quotes",
  contract: "Contracts",
  vendor: "Vendors",
  package: "Packages",
  campaign: "Campaigns",
  bd_lead: "BD Leads",
  bd_deal: "BD Deals",
  bd_property: "BD Properties",
  bd_owner: "Hall Owners",
};

// Stable display order so groups don't jump around between renders.
const TYPE_ORDER = [
  "contact", "lead", "booking", "quote", "invoice", "contract", "task",
  "vendor", "package", "campaign", "bd_lead", "bd_deal", "bd_property", "bd_owner",
];

// ============================================================
// Recents — persisted in localStorage so the palette feels personal
// ============================================================

interface RecentEntry {
  title: string;
  subtitle: string;
  href: string;
  type: string;
  visitedAt: number;
}

const RECENTS_KEY = "veloria.cmdk.recents";
const RECENTS_MAX = 6;

function loadRecents(): RecentEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, RECENTS_MAX);
  } catch {
    return [];
  }
}

function saveRecent(entry: Omit<RecentEntry, "visitedAt">) {
  if (typeof window === "undefined") return;
  try {
    const list = loadRecents();
    const filtered = list.filter((r) => r.href !== entry.href);
    const next = [{ ...entry, visitedAt: Date.now() }, ...filtered].slice(
      0,
      RECENTS_MAX
    );
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    // Ignore quota errors — recents are best-effort
  }
}

// ============================================================
// CommandPalette
// ============================================================

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [recents, setRecents] = React.useState<RecentEntry[]>([]);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mount guard to prevent Radix ID hydration mismatch
  React.useEffect(() => setMounted(true), []);

  // Refresh recents whenever the palette opens
  React.useEffect(() => {
    if (open) setRecents(loadRecents());
  }, [open]);

  // Keyboard shortcut ⌘K / Ctrl+K
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  // Reset state when dialog closes
  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setIsSearching(false);
    }
  }, [open]);

  // Debounced server search for records
  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const q = query;
    debounceRef.current = setTimeout(async () => {
      const response = await globalSearch(q);
      // Guard against out-of-order responses overwriting a newer query
      if (response.success) {
        setResults(response.data);
      }
      setIsSearching(false);
    }, 220);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function navigateTo(
    href: string,
    payload?: { title: string; subtitle: string; type: string }
  ) {
    if (payload) {
      saveRecent({ ...payload, href });
    }
    onOpenChange(false);
    router.push(href);
  }

  // Instant page/navigation matches (client-side, no network)
  const pageMatches = React.useMemo(
    () => (query.trim().length >= 1 ? matchPages(query) : []),
    [query]
  );

  // Group + order search results by type
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    (acc[r.type] ??= []).push(r);
    return acc;
  }, {});
  const orderedTypes = TYPE_ORDER.filter((t) => grouped[t]?.length);

  const hasResults = results.length > 0;
  const showLanding = query.trim().length < 1;
  const querying = query.trim().length >= 1;
  const nothingFound =
    querying && !isSearching && !hasResults && pageMatches.length === 0;

  // Don't render on server to prevent Radix UI ID hydration mismatch
  if (!mounted) return null;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} shouldFilter={false}>
      <CommandInput
        placeholder="Search anything — people, bookings, invoices, or jump to a page…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {/* Empty state */}
        {nothingFound && (
          <CommandEmpty>
            No matches for “{query.trim()}”. Try a name, phone, number, or page.
          </CommandEmpty>
        )}

        {/* Landing view (no query) */}
        {showLanding && (
          <>
            {/* Recents */}
            {recents.length > 0 && (
              <>
                <CommandGroup heading="Recently visited">
                  {recents.map((r) => {
                    const Icon = TYPE_ICONS[r.type] ?? Clock;
                    return (
                      <CommandItem
                        key={r.href}
                        value={`recent-${r.href}`}
                        onSelect={() =>
                          navigateTo(r.href, {
                            title: r.title,
                            subtitle: r.subtitle,
                            type: r.type,
                          })
                        }
                      >
                        <Icon className="mr-2 size-3.5 text-muted-foreground" />
                        <div className="flex flex-col">
                          <span className="text-[13px]">{r.title}</span>
                          {r.subtitle && (
                            <span className="text-[11.5px] text-muted-foreground">
                              {r.subtitle}
                            </span>
                          )}
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {/* Quick actions */}
            <CommandGroup heading="Quick actions">
              {QUICK_ACTIONS.map((a) => (
                <CommandItem
                  key={a.href}
                  value={`action-${a.title}`}
                  onSelect={() => navigateTo(a.href)}
                >
                  <Plus className="mr-2 size-3.5 text-muted-foreground" />
                  <span className="text-[13px]">{a.title}</span>
                  <span className="ml-auto inline-flex items-center gap-0.5">
                    <kbd className="rounded border border-border bg-muted px-1 text-[10px] font-mono text-muted-foreground">
                      ⇧
                    </kbd>
                    <kbd className="rounded border border-border bg-muted px-1 text-[10px] font-mono text-muted-foreground">
                      {a.shortcut}
                    </kbd>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandSeparator />

            {/* Navigation */}
            <CommandGroup heading="Jump to">
              {QUICK_NAV.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={item.href}
                    value={`nav-${item.title}`}
                    onSelect={() => navigateTo(item.href)}
                  >
                    <Icon className="mr-2 size-3.5 text-muted-foreground" />
                    <span className="text-[13px]">{item.title}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>

            <CommandSeparator />

            {/* Hint */}
            <div className="px-3 py-2 text-[11px] text-muted-foreground/70">
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="size-3" />
                Tip: search a full name, phone number, booking/invoice number, or a page like “attendance” or “trial balance”.
              </span>
            </div>
          </>
        )}

        {/* ===== Query view ===== */}
        {querying && (
          <>
            {/* Page / navigation matches — instant */}
            {pageMatches.length > 0 && (
              <CommandGroup heading="Go to page">
                {pageMatches.map((p) => (
                  <CommandItem
                    key={`page-${p.href}`}
                    value={`page-${p.href}`}
                    onSelect={() => navigateTo(p.href)}
                  >
                    <ArrowUpRight className="mr-2 size-3.5 text-muted-foreground" />
                    <span className="text-[13px]">{p.label}</span>
                    <CornerDownLeft className="ml-auto size-3 text-muted-foreground/50" />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Loading indicator for record search */}
            {isSearching && !hasResults && (
              <div className="flex items-center justify-center py-6 text-[13px] text-muted-foreground">
                <Loader2 className="mr-2 size-4 animate-spin" />
                Searching records…
              </div>
            )}

            {/* Record results grouped by type, relevance-ordered */}
            {orderedTypes.map((type, index) => {
              const items = grouped[type];
              const Icon = TYPE_ICONS[type] ?? Search;
              const label = TYPE_LABELS[type] ?? type;
              return (
                <React.Fragment key={type}>
                  {(index > 0 || pageMatches.length > 0) && <CommandSeparator />}
                  <CommandGroup heading={label}>
                    {items.map((item) => (
                      <CommandItem
                        key={`${item.type}-${item.id}`}
                        value={`${item.type}-${item.id}`}
                        onSelect={() =>
                          navigateTo(item.href, {
                            title: item.title,
                            subtitle: item.subtitle,
                            type: item.type,
                          })
                        }
                      >
                        <Icon className="mr-2 size-3.5 text-muted-foreground" />
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate text-[13px]">{item.title}</span>
                          <span className="truncate text-[11.5px] text-muted-foreground">
                            {item.subtitle}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </React.Fragment>
              );
            })}
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
