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
// Quick navigation entries
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
  bd_lead: "BD Leads",
  bd_deal: "BD Deals",
  bd_property: "BD Properties",
  bd_owner: "Hall Owners",
};

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

  // Debounced search
  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      const response = await globalSearch(query);
      if (response.success) {
        setResults(response.data);
      }
      setIsSearching(false);
    }, 300);

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

  // Group search results by type
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.type]) acc[r.type] = [];
    acc[r.type].push(r);
    return acc;
  }, {});

  const hasResults = results.length > 0;
  const showLanding = query.trim().length < 2;

  // Don't render on server to prevent Radix UI ID hydration mismatch
  if (!mounted) return null;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search or jump to… (try a name, lead title, or booking number)"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {/* Loading state */}
        {isSearching && (
          <div className="flex items-center justify-center py-6 text-[13px] text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" />
            Searching…
          </div>
        )}

        {/* Empty state */}
        {!isSearching && !showLanding && !hasResults && (
          <CommandEmpty>No results found.</CommandEmpty>
        )}

        {/* Landing view (no query) */}
        {showLanding && !isSearching && (
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
                        value={`recent-${r.title}-${r.subtitle}`}
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
              {QUICK_ACTIONS.map((a) => {
                const Icon = a.icon;
                return (
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
                    <Icon className="hidden" aria-hidden />
                  </CommandItem>
                );
              })}
            </CommandGroup>

            <CommandSeparator />

            {/* Navigation */}
            <CommandGroup heading="Jump to">
              {QUICK_NAV.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={item.href}
                    value={item.title}
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
              <span className="inline-flex items-center gap-1">
                <Sparkles className="size-3" />
                Tip: type a name, phone, or booking number to jump directly.
              </span>
            </div>
          </>
        )}

        {/* Search results grouped by type */}
        {!isSearching &&
          Object.entries(grouped).map(([type, items], index) => {
            const Icon = TYPE_ICONS[type] ?? Search;
            const label = TYPE_LABELS[type] ?? type;
            return (
              <React.Fragment key={type}>
                {index > 0 && <CommandSeparator />}
                <CommandGroup heading={label}>
                  {items.map((item) => (
                    <CommandItem
                      key={`${item.type}-${item.id}`}
                      value={`${item.title} ${item.subtitle}`}
                      onSelect={() =>
                        navigateTo(item.href, {
                          title: item.title,
                          subtitle: item.subtitle,
                          type: item.type,
                        })
                      }
                    >
                      <Icon className="mr-2 size-3.5 text-muted-foreground" />
                      <div className="flex flex-col">
                        <span className="text-[13px]">{item.title}</span>
                        <span className="text-[11.5px] text-muted-foreground">
                          {item.subtitle}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </React.Fragment>
            );
          })}
      </CommandList>
    </CommandDialog>
  );
}
