"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Search, User, Settings, LogOut, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { NotificationPopover } from "@/components/layout/notification-popover";
import { CommandPalette } from "@/components/layout/command-palette";
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
    <header className="topbar-glass sticky top-0 z-30 flex min-h-12 shrink-0 items-center gap-3 border-b border-border px-4 pt-[env(safe-area-inset-top)]">
      {/* Mobile sidebar trigger */}
      <SidebarTrigger className="-ml-1 size-7 text-muted-foreground" />

      <Separator orientation="vertical" className="mr-1 h-4" />

      {/* Breadcrumbs */}
      <Breadcrumb className="hidden md:flex">
        <BreadcrumbList>
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
        {/* Search trigger — opens command palette */}
        <Button
          variant="outline"
          className="relative hidden h-8 w-64 justify-start rounded-md border-border bg-background pl-9 text-[13px] font-normal text-muted-foreground hover:bg-muted/60 lg:flex"
          onClick={() => setCommandOpen(true)}
        >
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          Search...
          <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-sans text-[10px] font-medium text-muted-foreground sm:flex">
            <span>⌘</span>K
          </kbd>
        </Button>

        {/* Search icon for mobile */}
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground lg:hidden"
          onClick={() => setCommandOpen(true)}
        >
          <Search className="size-4" />
        </Button>

        {/* Command palette */}
        <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />

        {/* Theme toggle */}
        {mounted && (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground"
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

        {/* Notifications */}
        <NotificationPopover />

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                "relative h-9 gap-2 px-2 transition-all duration-200",
                "hover:bg-accent"
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
              className="cursor-pointer text-red-600 focus:text-red-600"
              onClick={() => signOut({ callbackUrl: "/sign-in" })}
            >
              <LogOut className="mr-2 size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
