"use client";

import { Fragment } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Users,
  Contact,
  Network,
  UserPlus,
  Kanban,
  CalendarCheck,
  CalendarClock,
  CalendarHeart,
  Clock,
  List,
  Calendar,
  CheckSquare,
  Scale,
  Landmark,
  Briefcase,
  IndianRupee,
  FileText,
  CreditCard,
  Settings,
  LogOut,
  ChevronRight,
  Gem,
  BarChart3,
  MapPin,
  History,
  Activity,
  Route,
  Zap,
  Target,
  Workflow,
  ListOrdered,
  Receipt,
  ShieldCheck,
  MailOpen,
  FileInput,
  TrendingUp,
  Package,
  Megaphone,
  FolderOpen,
  Image,
  Cog,
  Gift,
  UtensilsCrossed,
  DollarSign,
  Warehouse,
  Truck,
  Send,
  Star,
  Trophy,
  Medal,
  Gauge,
  Sparkles,
  LineChart,
  Calculator,
  Swords,
  ClipboardList,
  Inbox,
  Copy,
  Store,
  Boxes,
  UserCog,
  FileCheck,
  Banknote,
  Percent,
  Shield,
  FileSignature,
  Mail,
  Plug,
  AlertTriangle,
  AlertOctagon,
  Bell,
  Award,
  MessageCircle,
  MessageSquare,
  Phone,
  PhoneCall,
  Webhook,
  Building2,
  Siren,
  PhoneMissed,
  Snowflake,
  MessagesSquare,
  Handshake,
  FileImage,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePermissions } from "@/hooks/use-permissions";
import {
  sidebarNavigation,
  filterNavigationByPermissions,
  type NavItem,
} from "@/config/navigation";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BrandLogo } from "@/components/layout/brand-logo";
import { Skeleton } from "@/components/ui/skeleton";

// ============================================================
// Icon map: maps string icon names from nav config to components
// ============================================================

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
  Contact,
  Network,
  UserPlus,
  Kanban,
  CalendarCheck,
  CalendarClock,
  CalendarHeart,
  Clock,
  List,
  Calendar,
  CheckSquare,
  Scale,
  Landmark,
  Briefcase,
  IndianRupee,
  FileText,
  CreditCard,
  Settings,
  BarChart3,
  MapPin,
  History,
  Activity,
  Route,
  Zap,
  Target,
  Workflow,
  ListOrdered,
  Receipt,
  ShieldCheck,
  MailOpen,
  FileInput,
  TrendingUp,
  Package,
  Megaphone,
  FolderOpen,
  Image,
  Cog,
  Gift,
  UtensilsCrossed,
  DollarSign,
  Warehouse,
  Truck,
  Send,
  Star,
  Trophy,
  Medal,
  Gauge,
  Sparkles,
  LineChart,
  Calculator,
  Swords,
  ClipboardList,
  Inbox,
  Copy,
  Store,
  Boxes,
  UserCog,
  FileCheck,
  Banknote,
  Percent,
  Shield,
  FileSignature,
  Mail,
  Plug,
  AlertTriangle,
  AlertOctagon,
  Bell,
  Award,
  MessageCircle,
  MessageSquare,
  Phone,
  PhoneCall,
  Webhook,
  Building2,
  Siren,
  PhoneMissed,
  Snowflake,
  MessagesSquare,
  Handshake,
  FileImage,
};

function getIcon(iconName: string): LucideIcon {
  return iconMap[iconName] || LayoutDashboard;
}

// ============================================================
// Collapsible group labels
// ============================================================

// Section bands — keyed by each TOP-LEVEL nav href. A band header renders the
// first time a section appears as we walk the nav in order, so related modules
// sit under a clear label and nothing reads as "nested" under its neighbour.
const SECTIONS: Record<string, string> = {
  "/bd/dashboard": "Sales & CRM",
  "/contacts": "Sales & CRM",
  "/crm/cadences": "Sales & CRM",
  "/bookings": "Sales & CRM",
  "/projects": "Delivery & Ops",
  "/tasks": "Delivery & Ops",
  "/beo": "Delivery & Ops",
  "/procurement": "Delivery & Ops",
  "/support": "Sales & CRM",
  "/recruitment": "People",
  "/people": "People",
  "/people/attendance": "People",
  "/people/performance": "People",
  "/people/analytics": "People",
  "/packages": "Catalog",
  // Finance split into 4 banded sub-modules (like People).
  "/finance": "Finance",
  "/finance/command-center": "Finance",
  "/invoices": "Finance",
  "/payouts": "Finance",
  "/campaigns": "Marketing & Insights",
  "/reports": "Marketing & Insights",
  "/documents": "Workspace",
  "/gallery": "Workspace",
  "/settings": "System",
};

// A signature color per section — gives the whole app a colorful, navigable
// identity (each band reads at a glance, and it makes coming back to check
// progress feel lively rather than monochrome).
const SECTION_DOT: Record<string, string> = {
  "Sales & CRM": "bg-blue-500",
  "Delivery & Ops": "bg-amber-500",
  "People": "bg-violet-500",
  "Finance": "bg-emerald-500",
  "Catalog": "bg-teal-500",
  "Marketing & Insights": "bg-pink-500",
  "Workspace": "bg-cyan-500",
  "System": "bg-slate-400",
};

// ClickUp-style colored icon tiles — each nav item's icon sits in a rounded
// chip tinted with its section's signature hue, so the whole sidebar reads as a
// colorful, scannable workspace rather than a monochrome list. (Full class
// strings so Tailwind keeps them at build time.) The active item drops the tint
// for a translucent white tile on the violet gradient row.
const DEFAULT_TILE = "bg-muted text-muted-foreground";
const SECTION_TILE: Record<string, string> = {
  "Sales & CRM": "bg-blue-500/12 text-blue-600 dark:bg-blue-400/15 dark:text-blue-300",
  "Delivery & Ops": "bg-amber-500/15 text-amber-600 dark:bg-amber-400/15 dark:text-amber-300",
  "People": "bg-violet-500/12 text-violet-600 dark:bg-violet-400/15 dark:text-violet-300",
  "Finance": "bg-emerald-500/12 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-300",
  "Catalog": "bg-teal-500/12 text-teal-600 dark:bg-teal-400/15 dark:text-teal-300",
  "Marketing & Insights": "bg-pink-500/12 text-pink-600 dark:bg-pink-400/15 dark:text-pink-300",
  "Workspace": "bg-cyan-500/12 text-cyan-600 dark:bg-cyan-400/15 dark:text-cyan-300",
  "System": "bg-slate-500/12 text-slate-600 dark:bg-slate-400/15 dark:text-slate-300",
};

// ============================================================
// Role display map
// ============================================================

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  SALES_EXEC: "Sales Executive",
  SALES_HEAD: "Sales Head",
  EVENT_COORDINATOR: "Coordinator",
  FINANCE: "Finance",
  STAFF: "Staff",
  CLIENT: "Client",
  BD_EXECUTIVE: "BD Executive",
  BD_HEAD: "BD Head",
  OPERATIONS: "Operations",
  LEGAL: "Legal",
};

// ============================================================
// Sidebar Nav Item (no children)
// ============================================================

function SidebarNavItem({
  item,
  isActive,
  tileClass,
}: {
  item: NavItem;
  isActive: boolean;
  tileClass: string;
}) {
  const Icon = getIcon(item.icon);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        tooltip={item.title}
        className={cn(
          "group/nav relative h-9 overflow-hidden rounded-xl px-2 text-[13px] font-medium text-sidebar-foreground/80 transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] active:scale-[0.98]",
          "hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
          "group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0!",
          isActive &&
            "sheen-sweep bg-gradient-to-b from-primary to-[color-mix(in_oklab,var(--primary)_90%,black_10%)] font-semibold text-primary-foreground shadow-[inset_0_1px_0_oklch(1_0_0/0.28),0_2px_8px_oklch(0.4_0.24_293/0.32)] hover:text-primary-foreground hover:from-primary hover:to-[color-mix(in_oklab,var(--primary)_90%,black_10%)]"
        )}
      >
        <Link href={item.href}>
          <span
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-[7px] transition-colors duration-200",
              isActive ? "bg-white/20 text-primary-foreground" : tileClass
            )}
          >
            <Icon className="size-3.5" strokeWidth={isActive ? 2.4 : 2} />
          </span>
          <span className={cn(isActive && "tracking-[-0.01em]")}>{item.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

// ============================================================
// Sidebar Collapsible Group (with children)
// ============================================================

function SidebarCollapsibleItem({
  item,
  pathname,
  tileClass,
}: {
  item: NavItem;
  pathname: string;
  tileClass: string;
}) {
  const Icon = getIcon(item.icon);
  const isGroupActive = pathname.startsWith(item.href);

  return (
      <Collapsible defaultOpen={isGroupActive} className="group/collapsible">
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton
              tooltip={item.title}
              className={cn(
                "group/nav h-9 rounded-xl px-2 text-[13px] font-medium text-sidebar-foreground/80 transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] active:scale-[0.98]",
                "hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                "group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0!",
                isGroupActive &&
                  "bg-primary/[0.07] font-semibold text-sidebar-accent-foreground shadow-[inset_0_0_0_1px_oklch(0.55_0.25_293/0.14)]"
              )}
            >
              <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-[7px] transition-colors duration-200", tileClass)}>
                <Icon className="size-3.5" strokeWidth={isGroupActive ? 2.4 : 2} />
              </span>
              <span className={cn(isGroupActive && "tracking-[-0.01em]")}>{item.title}</span>
              <ChevronRight className="ml-auto size-3.5 text-sidebar-foreground/40 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub className="border-sidebar-border/40">
              {item.children?.map((child) => {
                const ChildIcon = getIcon(child.icon);
                const isChildActive = pathname === child.href;
                return (
                  <SidebarMenuSubItem key={child.href}>
                    <SidebarMenuSubButton
                      asChild
                      isActive={isChildActive}
                      className={cn(
                        "h-8 rounded-lg text-[12.5px] text-sidebar-foreground/70 transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] active:scale-[0.98]",
                        "hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                        isChildActive && "bg-primary/[0.11] font-semibold text-primary shadow-[inset_0_0_0_1px_oklch(0.55_0.25_293/0.16)] hover:bg-primary/[0.14] hover:text-primary"
                      )}
                    >
                      <Link href={child.href}>
                        <ChildIcon className={cn("size-3.5", isChildActive ? "text-primary" : "text-sidebar-foreground/50")} />
                        <span>{child.title}</span>
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                );
              })}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
  );
}

// ============================================================
// Sidebar Loading Skeleton
// ============================================================

function SidebarSkeleton() {
  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <Skeleton className="size-8 rounded-lg bg-sidebar-accent" />
        <Skeleton className="h-5 w-28 bg-sidebar-accent" />
      </div>
      <div className="flex flex-col gap-2 mt-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full rounded-md bg-sidebar-accent" />
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Main AppSidebar Component
// ============================================================

export function AppSidebar() {
  const pathname = usePathname();
  const { user, isLoading } = useCurrentUser();
  const { permissions } = usePermissions();

  // Filter navigation based on user permissions
  const filteredNavigation = filterNavigationByPermissions(
    sidebarNavigation,
    permissions
  );

  if (isLoading) {
    return (
      <Sidebar collapsible="icon" className="border-r-0">
        <SidebarSkeleton />
      </Sidebar>
    );
  }

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-material-sidebar">
      {/* Header with logo */}
      <SidebarHeader className="px-3 py-3.5">
        <Link
          href="/dashboard"
          className="group/brand flex items-center gap-2.5 rounded-xl transition-all duration-200 hover:opacity-95 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {/* Collapsed (icon-only) sidebar — compact mark */}
          <div className="logo-chip ring-glow-violet hidden size-7 shrink-0 items-center justify-center rounded-lg text-primary-foreground transition-transform duration-200 group-hover/brand:scale-[1.04] group-data-[collapsible=icon]:flex">
            <Gem className="size-3.5" strokeWidth={2.5} />
          </div>
          {/* Expanded sidebar — full wordmark, falls back to mark + text */}
          <div className="flex items-center gap-2.5 group-data-[collapsible=icon]:hidden">
            <BrandLogo
              className="h-8 w-auto max-w-[180px] object-contain object-left"
              fallback={
                <>
                  <div className="logo-chip ring-glow-violet flex size-7 shrink-0 items-center justify-center rounded-lg text-primary-foreground transition-transform duration-200 group-hover/brand:scale-[1.04]">
                    <Gem className="size-3.5" strokeWidth={2.5} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[13.5px] font-semibold tracking-[-0.014em] text-ink-gradient">
                      Veloria Grand
                    </span>
                    <span className="text-[10.5px] font-medium tracking-wide text-sidebar-foreground/45">
                      Venue Management
                    </span>
                  </div>
                </>
              }
            />
          </div>
        </Link>
        <div className="divider-fade mt-3 group-data-[collapsible=icon]:hidden" />
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {(() => {
                let prevSection: string | undefined;
                return filteredNavigation.map((item) => {
                  const section = SECTIONS[item.href];
                  const showHeader = !!section && section !== prevSection;
                  // Each item's icon-tile hue follows the section it belongs to
                  // (items that don't start a section inherit the running one).
                  const effectiveSection = section ?? prevSection;
                  const tileClass = (effectiveSection && SECTION_TILE[effectiveSection]) || DEFAULT_TILE;
                  if (section) prevSection = section;

                  const node =
                    item.children && item.children.length > 0 ? (
                      <SidebarCollapsibleItem item={item} pathname={pathname} tileClass={tileClass} />
                    ) : (
                      <SidebarNavItem
                        item={item}
                        isActive={pathname === item.href || pathname.startsWith(item.href + "/")}
                        tileClass={tileClass}
                      />
                    );

                  return (
                    <Fragment key={item.href}>
                      {showHeader && (
                        <SidebarGroupLabel className="mt-4 mb-1 flex items-center gap-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-sidebar-foreground/40">
                          <span className={cn("size-1.5 rounded-full", SECTION_DOT[section] ?? "bg-muted-foreground/40")} />
                          {section}
                        </SidebarGroupLabel>
                      )}
                      {node}
                    </Fragment>
                  );
                });
              })()}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer with user info */}
      <SidebarFooter className="border-t border-sidebar-border p-2">
        <div className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors duration-150 hover:bg-sidebar-accent/70 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0">
          <Avatar size="sm">
            <AvatarImage src={user?.image || undefined} alt={user?.name || ""} />
            <AvatarFallback className="bg-primary text-[10px] font-medium text-primary-foreground">
              {user?.name
                ?.split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2) || "VG"}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-1 flex-col overflow-hidden group-data-[collapsible=icon]:hidden">
            <span className="truncate text-[12.5px] font-medium leading-tight text-sidebar-accent-foreground">
              {user?.name || "Guest"}
            </span>
            <span className="truncate text-[11px] leading-tight text-sidebar-foreground/55">
              {ROLE_LABELS[user?.role || ""] || "Unknown"}
            </span>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/sign-in" })}
            className="shrink-0 rounded-lg p-1.5 text-sidebar-foreground/40 transition-all duration-150 hover:bg-background hover:text-sidebar-accent-foreground active:scale-[0.94] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 group-data-[collapsible=icon]:hidden"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="size-3.5" />
          </button>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
