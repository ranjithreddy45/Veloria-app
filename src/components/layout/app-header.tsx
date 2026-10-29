"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { signOutSafely } from "@/lib/client-auth";
import {
  Search,
  User,
  Settings,
  LogOut,
  Sun,
  Moon,
  BookOpen,
  Plus,
  UserPlus,
  FileText,
  CalendarCheck,
  Users,
  ShieldCheck,
} from "lucide-react";
import { useTheme } from "next-themes";
import { NotificationPopover } from "@/components/layout/notification-popover";
import { ActiveAlertsPopup } from "@/components/layout/active-alerts-popup";
import { CommandPalette } from "@/components/layout/command-palette";
import { VelosChip } from "@/components/layout/velos-chip";
import { PendingApprovalsChip } from "@/components/layout/pending-approvals-chip";
import { SoundMenuItems } from "@/components/layout/sound-settings";
import { VersionBadge } from "@/components/layout/version-badge";
import { AvailabilityToggle } from "@/components/availability/availability-toggle";
import { useCurrentUser } from "@/hooks/use-current-user";
import { cn } from "@/lib/utils";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ============================================================
// Breadcrumb helpers
// ============================================================

const ROUTE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  // The module is called "Enquiry" everywhere a user can see it — the sidebar
  // item, the page heading, the page <title>. The breadcrumb saying "Contacts"
  // was the only place still using the old internal name, so the same screen
  // appeared to have two different names depending on where you looked.
  contacts: "Enquiry",
  leads: "Leads",
  pipeline: "Sales Pipeline",
  bookings: "Bookings",
  calendar: "Calendar",
  tasks: "Tasks",
  invoices: "Invoices",
  payments: "Payments",
  notifications: "Notifications",
  reports: "Reports",
  settings: "Settings",
  users: "Users",
  "activity-log": "Activity Log",
  portal: "Portal",
  // BD / acquisition + engagement + module sections (no raw "Bd"/"Crm" slugs — T-202).
  bd: "BD CRM",
  crm: "Engagement",
  owners: "Hall Owners",
  deals: "Deals",
  properties: "Properties",
  followups: "Follow-ups",
  projects: "Projects",
  quotations: "Quotations",
  contracts: "Contracts",
  approvals: "Approvals",
  inquiries: "Web Inquiries",
  availability: "Slot Availability",
  commissions: "Commissions",
  payouts: "Payouts",
  referrals: "Referrals",
  performance: "Performance",
  loyalty: "Loyalty",
  reviews: "Reviews",
  surveys: "Surveys",
  vendors: "Vendors",
  analytics: "Analytics",
  signals: "Sales Signals",
  calls: "Call Log",
  cadences: "Cadences",
  "email-tracking": "Email Insights",
  whatsapp: "WhatsApp",
};

// Singular labels for a record-id segment, derived from its parent collection, so a
// breadcrumb shows "Lead" / "Deal" instead of a raw CUID (BD BUG-010 / Sales SCRM-008).
const RECORD_SINGULAR: Record<string, string> = {
  leads: "Lead", deals: "Deal", owners: "Owner", contacts: "Contact",
  quotations: "Quotation", contracts: "Contract", properties: "Property",
  inquiries: "Inquiry", bookings: "Booking", invoices: "Invoice",
  projects: "Project", quotes: "Quote", vendors: "Vendor", tasks: "Task",
};
// A database id segment: long alphanumeric containing a digit (CUIDs, etc.).
function isRecordIdSegment(s: string) {
  return /^[a-z0-9]{16,}$/i.test(s) && /\d/.test(s);
}

function generateBreadcrumbs(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  return segments.map((segment, index) => {
    let label: string;
    if (ROUTE_LABELS[segment]) {
      label = ROUTE_LABELS[segment];
    } else if (isRecordIdSegment(segment)) {
      const parent = segments[index - 1];
      label = (parent && RECORD_SINGULAR[parent]) || "Details";
    } else {
      label = segment.charAt(0).toUpperCase() + segment.slice(1);
    }
    return {
      label,
      href: "/" + segments.slice(0, index + 1).join("/"),
      isLast: index === segments.length - 1,
    };
  });
}

// ============================================================
// AppHeader Component
// ============================================================

export function AppHeader() {
  const pathname = usePathname();
  const { user } = useCurrentUser();
  const breadcrumbs = generateBreadcrumbs(pathname);
  const [commandOpen, setCommandOpen] = React.useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  return (
    // At 375px the eleven controls that live here used to add up to ~500px and
    // pushed the whole page into a sideways scroll. `min-w-0` + tighter mobile
    // gutters keep the bar inside the viewport; the cluster below decides what
    // actually survives at phone width.
    //
    // v3 (approved concept, 2026-10-29): flush with the canvas, one hairline
    // underneath, and only the controls people use while working. Theme, help
    // and sounds live in the menu under your initials.
    <header className="topbar-glass sticky top-0 z-30 flex min-h-14 w-full min-w-0 shrink-0 items-center gap-2 border-b border-border px-2 pt-[env(safe-area-inset-top)] sm:gap-2.5 sm:px-5">
      {/* Mobile sidebar trigger — the only way into the ~80-item nav on a
          phone, so it stays first at every width.
          min-w-11: the coarse-pointer rule in globals.css guarantees a 44px
          HEIGHT here but not the width (the icon isn't the button's only child,
          so that rule's min-width branch doesn't match), which would otherwise
          leave a 36px-wide sliver to hit. */}
      <SidebarTrigger className="size-9 min-w-11 shrink-0 rounded-[10px] text-muted-foreground transition-all duration-200 hover:bg-accent hover:text-foreground active:scale-[0.94] sm:-ml-1 sm:size-8 sm:min-w-0" />

      {/* Page Title & Breadcrumbs */}
      <div className="hidden min-w-0 flex-col justify-center md:flex">
        {breadcrumbs.length > 1 && (
          <div className="flex items-center gap-1 text-meta text-subtle-foreground">
            {breadcrumbs.slice(0, -1).map((crumb, index) => (
              <React.Fragment key={crumb.href}>
                {index > 0 && <span>/</span>}
                <Link href={crumb.href} className="hover:text-foreground transition-colors">
                  {crumb.label}
                </Link>
              </React.Fragment>
            ))}
          </div>
        )}
        <div className="text-sm font-semibold text-foreground leading-tight">
          {breadcrumbs[breadcrumbs.length - 1]?.label}
        </div>
      </div>

      {/* Spacer */}
      <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-2">
        {/* Search trigger — opens command palette */}
        <Button
          variant="outline"
          className="group/search relative hidden h-9 w-[min(340px,30vw)] justify-start rounded-[10px] border-border bg-card pl-9! text-body font-normal text-subtle-foreground shadow-none transition-colors duration-150 hover:border-input hover:bg-card md:flex"
          onClick={() => setCommandOpen(true)}
        >
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" />
          Search leads, bookings, people…
          <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-0.5 rounded-md border border-border bg-muted px-1.5 font-sans text-meta font-medium text-subtle-foreground sm:flex">
            <span>⌘</span>K
          </kbd>
        </Button>

        {/* Search icon for mobile — search is the fastest route to any of the
            ~80 modules on a phone, so it survives at every width. */}
        <Button
          variant="ghost"
          size="icon"
          className="size-9 shrink-0 rounded-[10px] text-muted-foreground transition-all duration-200 hover:bg-accent hover:text-foreground active:scale-[0.94] md:hidden"
          onClick={() => setCommandOpen(true)}
        >
          <Search className="size-4" />
        </Button>

        {/* Command palette */}
        <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />

        {/* Quick create — visible shortcut to the most common "new X" forms,
            so staff (esp. on mobile) don't need to hunt for create buttons. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              className="h-9 shrink-0 gap-1.5 rounded-[10px] px-3"
              title="Create new"
            >
              <Plus className="size-4" />
              <span className="hidden sm:inline">Create</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-52" align="end" sideOffset={8}>
            <DropdownMenuLabel>Create new</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href="/leads/new" className="cursor-pointer"><UserPlus className="mr-2 size-4" /> Enquiry / Lead</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/quotations/new" className="cursor-pointer"><FileText className="mr-2 size-4" /> Quotation</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/bookings/new" className="cursor-pointer"><CalendarCheck className="mr-2 size-4" /> Booking</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/contacts/new" className="cursor-pointer"><Users className="mr-2 size-4" /> Contact</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/invoices/new" className="cursor-pointer"><FileText className="mr-2 size-4" /> Invoice</Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Pending approvals — items awaiting THIS user's action (self-scoped,
            permission-aware). Renders only when there is something to approve,
            and it is an action queue, so it earns a slot even at 375px. */}
        <PendingApprovalsChip />

        {/* Availability and Velos stay in the bar (the availability chip also
            runs the routing heartbeat, so it is mounted at every width); below
            `sm` they collapse and have their own pages in the nav. */}
        <div className="hidden items-center gap-1 sm:flex">
          <AvailabilityToggle />
          <VelosChip />
        </div>

        {/* Must-act items for THIS user. Renders nothing when the list is
            empty, so it costs no header space on a clear day. */}
        <ActiveAlertsPopup />

        <NotificationPopover />

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "relative size-9 shrink-0 rounded-full transition-all duration-200 active:scale-[0.97]",
                "hover:bg-accent"
              )}
            >
              <Avatar size="sm">
                <AvatarImage
                  src={user?.image || undefined}
                  alt={user?.name || ""}
                />
                <AvatarFallback className="bg-primary text-meta text-primary-foreground">
                  {user?.name
                    ?.split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2) || "VG"}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-60" align="end" sideOffset={8}>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">
                  {user?.name || "Guest"}
                </p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user?.email || ""}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href="/notifications" className="cursor-pointer">
                  <User className="mr-2 size-4" />
                  Notifications
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings" className="cursor-pointer">
                  <Settings className="mr-2 size-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/me/security" className="cursor-pointer">
                  <ShieldCheck className="mr-2 size-4" />
                  Security &amp; 2FA
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>

            {/* Ambient controls (v3): theme, sounds and help live here at every
                width instead of in the top bar. */}
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {mounted && (
                <DropdownMenuItem
                  className="cursor-pointer"
                  onSelect={(e) => {
                    // Keep the menu open so the theme flip is visible in place.
                    e.preventDefault();
                    setTheme(resolvedTheme === "dark" ? "light" : "dark");
                  }}
                >
                  {resolvedTheme === "dark" ? (
                    <Sun className="mr-2 size-4" />
                  ) : (
                    <Moon className="mr-2 size-4" />
                  )}
                  {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
                </DropdownMenuItem>
              )}
              <SoundMenuItems />
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href="/playbook" className="cursor-pointer">
                  <BookOpen className="mr-2 size-4" />
                  Guided playbook
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" onSelect={() => setCommandOpen(true)}>
                <Search className="mr-2 size-4" />
                Search &amp; shortcuts
                <kbd className="pointer-events-none ml-auto flex h-5 select-none items-center gap-0.5 rounded-md border border-border bg-muted px-1.5 font-sans text-meta font-medium text-subtle-foreground">
                  <span>⌘</span>K
                </kbd>
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-destructive focus:text-destructive"
              onClick={() => signOutSafely("/sign-in")}
            >
              <LogOut className="mr-2 size-4" />
              Sign out
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {/* Version footer — build-time app version, muted */}
            <div className="flex items-center justify-center px-2 py-1.5">
              <VersionBadge />
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
