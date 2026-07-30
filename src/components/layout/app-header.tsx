"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { signOut } from "next-auth/react";
import {
  Search,
  User,
  Settings,
  LogOut,
  Sun,
  Moon,
  CircleHelp,
  BookOpen,
  Sparkles,
  Plus,
  UserPlus,
  FileText,
  CalendarCheck,
  Users,
} from "lucide-react";
import { useTheme } from "next-themes";
import { NotificationPopover } from "@/components/layout/notification-popover";
import { CommandPalette } from "@/components/layout/command-palette";
import { VelosChip } from "@/components/layout/velos-chip";
import { PendingApprovalsChip } from "@/components/layout/pending-approvals-chip";
import { WhatsNew } from "@/components/layout/whats-new";
import { VersionBadge } from "@/components/layout/version-badge";
import { AvailabilityToggle } from "@/components/availability/availability-toggle";
import { useCurrentUser } from "@/hooks/use-current-user";
import { cn } from "@/lib/utils";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
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
  contacts: "Contacts",
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
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  return (
    <header className="topbar-glass sticky top-0 z-30 flex min-h-14 shrink-0 items-center gap-3 border-b border-border/70 px-4 pt-[env(safe-area-inset-top)]">
      {/* Mobile sidebar trigger */}
      <SidebarTrigger className="-ml-1 size-8 rounded-full text-muted-foreground transition-all duration-200 hover:bg-accent hover:text-foreground active:scale-[0.94]" />

      <Separator orientation="vertical" className="mr-1 h-4 bg-border/60" />

      {/* Breadcrumbs */}
      <Breadcrumb className="hidden md:flex">
        <BreadcrumbList className="text-[12.5px] text-muted-foreground">
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={crumb.href}>
              {index > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {crumb.isLast ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={crumb.href}>{crumb.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      {/* Spacer */}
      <div className="ml-auto flex items-center gap-2">
        {/* Quick create — visible shortcut to the most common "new X" forms,
            so staff (esp. on mobile) don't need to hunt for create buttons. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              className="h-9 gap-1.5 rounded-full px-3 shadow-sm"
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

        {/* Search trigger — opens command palette */}
        <Button
          variant="outline"
          className="group/search relative hidden h-9 w-64 justify-start rounded-full border-border/70 bg-muted/40 pl-9 text-[13px] font-normal text-muted-foreground shadow-none transition-all duration-200 hover:border-primary/30 hover:bg-muted/70 hover:shadow-[0_0_0_3px_oklch(0.45_0.11_162/0.08)] lg:flex"
          onClick={() => setCommandOpen(true)}
        >
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground transition-colors group-hover/search:text-primary" />
          Search...
          <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-0.5 rounded-md border border-border bg-background/60 px-1.5 font-sans text-[10px] font-medium text-muted-foreground sm:flex">
            <span>⌘</span>K
          </kbd>
        </Button>

        {/* Search icon for mobile */}
        <Button
          variant="ghost"
          size="icon"
          className="size-9 rounded-full text-muted-foreground transition-all duration-200 hover:bg-accent hover:text-foreground active:scale-[0.94] lg:hidden"
          onClick={() => setCommandOpen(true)}
        >
          <Search className="size-4" />
        </Button>

        {/* Command palette */}
        <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />

        {/* Self-serve availability toggle — flips the user's own rep availability
            and keeps lastSeenAt fresh via heartbeat (smart-routing). */}
        <AvailabilityToggle />

        {/* Pending approvals — items awaiting THIS user's action (self-scoped,
            permission-aware). Renders only when there is something to approve. */}
        <PendingApprovalsChip />

        {/* Velos engagement chip — live points + rank, celebrates on earn */}
        <VelosChip />

        {/* Theme toggle */}
        {mounted && (
          <Button
            variant="ghost"
            size="icon"
            className="size-9 rounded-full text-muted-foreground transition-all duration-200 hover:bg-accent hover:text-foreground active:scale-[0.94]"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? (
              <Sun className="size-4" />
            ) : (
              <Moon className="size-4" />
            )}
          </Button>
        )}

        {/* Help & Guidance launcher — always available to every user, ungated */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-9 rounded-full text-muted-foreground transition-all duration-200 hover:bg-accent hover:text-foreground active:scale-[0.94]"
              title="Help & guidance"
            >
              <CircleHelp className="size-4" />
              <span className="sr-only">Help & guidance</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-60" align="end" sideOffset={8}>
            <DropdownMenuLabel>Help & guidance</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href="/playbook" className="cursor-pointer">
                  <BookOpen className="mr-2 size-4" />
                  Guided Playbook
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard" className="cursor-pointer">
                  <Sparkles className="mr-2 size-4" />
                  Getting started
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                onSelect={() => setCommandOpen(true)}
              >
                <Search className="mr-2 size-4" />
                Search & shortcuts
                <kbd className="pointer-events-none ml-auto flex h-5 select-none items-center gap-0.5 rounded-md border border-border bg-background/60 px-1.5 font-sans text-[10px] font-medium text-muted-foreground">
                  <span>⌘</span>K
                </kbd>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              Need help? Ask your admin.
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* What's new — recent releases; unread dot until first opened */}
        <WhatsNew />

        {/* Notifications */}
        <NotificationPopover />

        <Separator orientation="vertical" className="mx-1 h-6 bg-border/60" />

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                "relative h-9 gap-2 rounded-full px-1.5 pr-3 transition-all duration-200 active:scale-[0.97]",
                "hover:bg-accent hover:shadow-[0_0_0_3px_oklch(0.45_0.11_162/0.08)]"
              )}
            >
              <Avatar size="sm">
                <AvatarImage
                  src={user?.image || undefined}
                  alt={user?.name || ""}
                />
                <AvatarFallback className="bg-primary text-[10px] text-primary-foreground">
                  {user?.name
                    ?.split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2) || "VG"}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium text-foreground sm:inline-block">
                {user?.name?.split(" ")[0] || "User"}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" sideOffset={8}>
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
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-destructive focus:text-destructive"
              onClick={() => signOut({ callbackUrl: "/sign-in" })}
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
