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
// Navigation Items for Quick Jump
// ============================================================

const QUICK_NAV = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Contacts", href: "/contacts", icon: Users },
  { title: "Leads", href: "/leads", icon: UserPlus },
  { title: "Sales Pipeline", href: "/pipeline", icon: Kanban },
  { title: "Bookings", href: "/bookings", icon: CalendarCheck },
  { title: "Tasks", href: "/tasks", icon: CheckSquare },
  { title: "Invoices", href: "/invoices", icon: FileText },
  { title: "Payments", href: "/payments", icon: IndianRupee },
  { title: "Reports", href: "/reports", icon: BarChart3 },
  { title: "Settings", href: "/settings", icon: Settings },
];

const TYPE_ICONS: Record<string, React.ElementType> = {
  contact: Users,
  lead: UserPlus,
  booking: CalendarCheck,
  invoice: FileText,
  task: CheckSquare,
};

const TYPE_LABELS: Record<string, string> = {
  contact: "Contacts",
  lead: "Leads",
  booking: "Bookings",
  invoice: "Invoices",
  task: "Tasks",
};

// ============================================================
// CommandPalette Component
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
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mount guard to prevent Radix ID hydration mismatch
  React.useEffect(() => setMounted(true), []);

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

  function handleSelect(href: string) {
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
  const showQuickNav = query.trim().length < 2;

  // Don't render on server to prevent Radix UI ID hydration mismatch
  if (!mounted) return null;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search contacts, leads, bookings..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {/* Loading state */}
        {isSearching && (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" />
            Searching...
          </div>
        )}

        {/* Empty state */}
        {!isSearching && !showQuickNav && !hasResults && (
          <CommandEmpty>No results found.</CommandEmpty>
        )}

        {/* Quick navigation (shown when no query) */}
        {showQuickNav && !isSearching && (
          <CommandGroup heading="Quick Navigation">
            {QUICK_NAV.map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem
                  key={item.href}
                  value={item.title}
                  onSelect={() => handleSelect(item.href)}
                >
                  <Icon className="mr-2 size-4 text-muted-foreground" />
                  <span>{item.title}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
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
                      onSelect={() => handleSelect(item.href)}
                    >
                      <Icon className="mr-2 size-4 text-muted-foreground" />
                      <div className="flex flex-col">
                        <span className="text-sm">{item.title}</span>
                        <span className="text-xs text-muted-foreground">
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
