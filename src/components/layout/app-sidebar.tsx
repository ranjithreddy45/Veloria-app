"use client";

import React, { Fragment, useCallback } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { signOutSafely } from "@/lib/client-auth";
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
  Smartphone,
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
  Repeat,
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
  PlugZap,
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
  BookOpen,
  UserCheck,
  CheckCircle2,
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
import { toast } from "sonner";
import { MAX_PINS, flattenPinnable, resolvePins } from "@/lib/workspace/pins";
import { useWorkspacePins } from "@/lib/workspace/use-workspace-pins";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BrandLogo } from "@/components/layout/brand-logo";
import { Skeleton } from "@/components/ui/skeleton";

// ============================================================
// Icon map: maps string icon names from nav config to components
// ============================================================

const iconMap: Record<string, LucideIcon> = {
  BookOpen,
  UserCheck,
  CheckCircle2,
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
  Repeat,
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
  PlugZap,
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

// Rendered through createElement rather than `const Icon = getIcon(name)` +
// <Icon/>: a capitalised local picked at render time reads to React's compiler
// lint as "component created during render" (react-hooks/static-components).
// The map lookup returns a stable module-level component, so nothing remounts.
function NavIcon({ name, ...props }: { name: string } & React.ComponentProps<LucideIcon>) {
  return React.createElement(iconMap[name] || LayoutDashboard, props);
}

// ============================================================
// Mobile drawer behaviour
// ============================================================

// Below `md` the sidebar is a Radix Sheet. Radix has no idea the Next router
// moved, so without closing it by hand the drawer stays open on top of the page
// you just navigated to — the single most annoying thing about navigating this
// app on a phone. That close now lives in AppSidebar's `handleNavigate`, next
// to the optimistic-active update, so every nav link gets both from one
// callback. (Pin stars deliberately do NOT call it: pinning is not navigating.)

// Touch-sized nav rows. The global `pointer: coarse` rule in globals.css lifts
// buttons and [role=button] to 44px, but these rows render as plain <a> via
// `asChild` — anchors only get a 32px floor there — so the sizes are set here.
// Mobile-first: unprefixed value applies on phones, `md:` restores the tight
// desktop density, so this cannot regress the desktop sidebar.
const NAV_ROW_TOUCH = "h-11 text-copy md:h-9 md:text-body";
const NAV_SUBROW_TOUCH = "h-10 text-body md:h-8 md:text-detail";

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
  // Support is an OPS module (shipped with BEO/Kitchen/Procurement/Logistics)
  // and sits after the ops group in the nav order. Labelling it Sales & CRM
  // made the "Sales & CRM" band header render a SECOND time further down.
  "/support": "Delivery & Ops",
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

// (Apple restraint) The per-section colour maps — SECTION_DOT rainbow dots and
// the ClickUp-style SECTION_TILE icon chips — are retired: the sidebar is
// monochrome, with colour reserved for the active item.

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
  MARKETING: "Marketing",
  LEGAL: "Legal",
};

// ============================================================
// Pin toggle (personal workspace)
// ============================================================

/** What a row needs to know to draw its star. `reveal: "always"` keeps a
 *  pinned row's filled star on screen in the main list, so you can see at a
 *  glance what is already pinned; inside the pinned group every row is pinned,
 *  so there the star goes back to hover-reveal to keep the group quiet. */
type PinControl = {
  pinned: boolean;
  reveal: "hover" | "always";
  onToggle: () => void;
};

/**
 * The star is a SIBLING of the nav link, never a child: a <button> inside an
 * <a> is invalid HTML, and in practice the click also navigates. Top-level rows
 * use shadcn's SidebarMenuAction slot (which also makes the link reserve right
 * padding). Sub-rows use a plain button on purpose — SidebarMenuAction's
 * `data-sidebar=menu-action` marker would be seen by the PARENT group's
 * `group-has-…:pr-8` rule and shove its chevron 24px to the left.
 *
 * Sizing is keyed on pointer type, not breakpoint: a fine pointer gets a 28px
 * hover-revealed star; a coarse pointer (phones in the sheet, but also tablets
 * wide enough to get the desktop sidebar) has no hover, so the star is always
 * visible and a full 44px target.
 */
function PinToggle({
  title,
  control,
  sub = false,
}: {
  title: string;
  control: PinControl;
  sub?: boolean;
}) {
  const { pinned, reveal, onToggle } = control;
  const label = `${pinned ? "Unpin" : "Pin"} ${title}`;
  const className = cn(
    "top-1/2! right-0.5 aspect-auto size-7 -translate-y-1/2 rounded-lg transition-[opacity,color] duration-150 after:hidden [&>svg]:size-3.5",
    "pointer-coarse:right-0 pointer-coarse:size-11!",
    "hover:bg-transparent hover:text-sidebar-foreground focus-visible:opacity-100",
    pinned ? "text-sidebar-foreground/60" : "text-sidebar-foreground/40",
    reveal === "hover" &&
      cn(
        "opacity-0 pointer-coarse:opacity-100",
        sub
          ? "group-hover/menu-sub-item:opacity-100 group-focus-within/menu-sub-item:opacity-100"
          : "group-hover/menu-item:opacity-100 group-focus-within/menu-item:opacity-100"
      ),
    sub &&
      "absolute flex items-center justify-center p-0 outline-hidden ring-sidebar-ring focus-visible:ring-2 [&>svg]:shrink-0"
  );
  const props = {
    type: "button" as const,
    "aria-pressed": pinned,
    "aria-label": label,
    title: label,
    onClick: onToggle,
    className,
  };
  const star = <Star className={cn(pinned && "fill-current")} strokeWidth={2} />;
  return sub ? <button {...props}>{star}</button> : <SidebarMenuAction {...props}>{star}</SidebarMenuAction>;
}

// ============================================================
// Sidebar Nav Item (no children)
// ============================================================

function SidebarNavItem({
  item,
  isActive,
  onNavigate,
  pin,
}: {
  item: NavItem;
  isActive: boolean;
  onNavigate: (href: string) => void;
  pin?: PinControl;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        tooltip={item.title}
        className={cn(
          "group/nav relative overflow-hidden rounded-xl px-2 font-medium text-sidebar-foreground/80 transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] active:scale-[0.98]",
          NAV_ROW_TOUCH,
          "hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
          "group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!p-0",
          // Keep the label clear of the 44px touch star (the slot's own pr-8
          // only clears the 28px mouse-sized one).
          pin && "pointer-coarse:pr-11!",
          isActive &&
            "data-[active=true]:bg-primary/[0.11] data-[active=true]:font-semibold data-[active=true]:text-primary shadow-[inset_0_0_0_1px_oklch(0.45_0.11_352/0.16)] data-[active=true]:hover:bg-primary/[0.14] data-[active=true]:hover:text-primary"
        )}
      >
        <Link href={item.href} onClick={() => onNavigate(item.href)}>
          <span
            className={cn(
              "flex size-6 shrink-0 items-center justify-center transition-colors duration-200",
              "group-data-[collapsible=icon]:absolute group-data-[collapsible=icon]:left-1/2 group-data-[collapsible=icon]:top-1/2 group-data-[collapsible=icon]:-translate-x-1/2 group-data-[collapsible=icon]:-translate-y-1/2",
              isActive
                ? "text-primary"
                : "text-sidebar-foreground/55 group-hover/nav:text-sidebar-foreground"
            )}
          >
            <NavIcon name={item.icon} className="size-[18px]" strokeWidth={2} />
          </span>
          <span className={cn("group-data-[collapsible=icon]:hidden", isActive && "tracking-[-0.01em]")}>{item.title}</span>
        </Link>
      </SidebarMenuButton>
      {pin && <PinToggle title={item.title} control={pin} />}
    </SidebarMenuItem>
  );
}

// ============================================================
// Sidebar Collapsible Group (with children)
// ============================================================

function SidebarCollapsibleItem({
  item,
  pathname,
  onNavigate,
  pinFor,
}: {
  item: NavItem;
  pathname: string;
  onNavigate: (href: string) => void;
  pinFor: (item: NavItem) => PinControl;
}) {
  const isGroupActive = pathname.startsWith(item.href);
  const { state } = useSidebar();

  if (state === "collapsed") {
    return (
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              tooltip={item.title}
              className={cn(
                "group/nav rounded-xl px-2 font-medium text-sidebar-foreground/80 transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] active:scale-[0.98]",
                NAV_ROW_TOUCH,
                "hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                "group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!p-0",
                isGroupActive &&
                  "bg-primary/[0.06] font-semibold text-sidebar-accent-foreground shadow-[inset_0_0_0_1px_oklch(0.45_0.11_352/0.12)]"
              )}
            >
              <span className={cn(
                "flex size-6 shrink-0 items-center justify-center transition-colors duration-200",
                "group-data-[collapsible=icon]:absolute group-data-[collapsible=icon]:left-1/2 group-data-[collapsible=icon]:top-1/2 group-data-[collapsible=icon]:-translate-x-1/2 group-data-[collapsible=icon]:-translate-y-1/2",
                isGroupActive ? "text-primary" : "text-sidebar-foreground/55 group-hover/nav:text-sidebar-foreground"
              )}>
                <NavIcon name={item.icon} className="size-[18px]" strokeWidth={2} />
              </span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" sideOffset={12} className="w-48 rounded-xl border-sidebar-border/40 bg-sidebar text-sidebar-foreground">
            <DropdownMenuLabel className="font-semibold">{item.title}</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-sidebar-border/40" />
            {item.children?.map((child) => {
              const isChildActive = pathname === child.href;
              return (
                <DropdownMenuItem asChild key={child.href} className="cursor-pointer">
                  <Link href={child.href} onClick={() => onNavigate(child.href)} className="flex items-center gap-2">
                    <NavIcon name={child.icon} className={cn("size-4", isChildActive ? "text-primary" : "text-sidebar-foreground/50")} />
                    <span className={isChildActive ? "font-medium text-sidebar-foreground" : ""}>{child.title}</span>
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    );
  }

  return (
    <Collapsible defaultOpen={isGroupActive} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            tooltip={item.title}
            className={cn(
              "group/nav rounded-xl px-2 font-medium text-sidebar-foreground/80 transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] active:scale-[0.98]",
              NAV_ROW_TOUCH,
              "hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              "group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!p-0",
              isGroupActive &&
                "bg-primary/[0.06] font-semibold text-sidebar-accent-foreground shadow-[inset_0_0_0_1px_oklch(0.45_0.11_352/0.12)]"
            )}
          >
            <span className={cn(
              "flex size-6 shrink-0 items-center justify-center transition-colors duration-200",
              "group-data-[collapsible=icon]:absolute group-data-[collapsible=icon]:left-1/2 group-data-[collapsible=icon]:top-1/2 group-data-[collapsible=icon]:-translate-x-1/2 group-data-[collapsible=icon]:-translate-y-1/2",
              isGroupActive ? "text-primary" : "text-sidebar-foreground/55 group-hover/nav:text-sidebar-foreground"
            )}>
              <NavIcon name={item.icon} className="size-[18px]" strokeWidth={2} />
            </span>
            <span className={cn("group-data-[collapsible=icon]:hidden", isGroupActive && "tracking-[-0.01em]")}>{item.title}</span>
            <ChevronRight className="ml-auto size-3.5 text-sidebar-foreground/40 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 group-data-[collapsible=icon]:hidden" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub className="border-sidebar-border/40">
            {item.children?.map((child) => {
              const isChildActive = pathname === child.href;
              return (
                <SidebarMenuSubItem key={child.href}>
                  <SidebarMenuSubButton
                    asChild
                    isActive={isChildActive}
                    className={cn(
                      "rounded-lg text-sidebar-foreground/70 transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] active:scale-[0.98]",
                      NAV_SUBROW_TOUCH,
                      "hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                      "pr-8 pointer-coarse:pr-11",
                      isChildActive &&
                        "data-[active=true]:bg-primary/[0.11] data-[active=true]:font-semibold data-[active=true]:text-primary shadow-[inset_0_0_0_1px_oklch(0.45_0.11_352/0.16)] data-[active=true]:hover:bg-primary/[0.14] data-[active=true]:hover:text-primary"
                    )}
                  >
                    <Link href={child.href} onClick={() => onNavigate(child.href)}>
                      <NavIcon name={child.icon} className={cn("size-3.5", isChildActive ? "text-primary" : "text-sidebar-foreground/50")} />
                      <span>{child.title}</span>
                    </Link>
                  </SidebarMenuSubButton>
                  <PinToggle title={child.title} control={pinFor(child)} sub />
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
  const { isMobile, setOpenMobile } = useSidebar();
  const [optimisticPath, setOptimisticPath] = React.useState<string | null>(null);

  const handleNavigate = useCallback(
    (href: string) => {
      setOptimisticPath(href);
      if (isMobile) setOpenMobile(false);
    },
    [isMobile, setOpenMobile]
  );

  React.useEffect(() => {
    setOptimisticPath(null);
  }, [pathname]);

  const currentPath = optimisticPath ?? pathname;

  // Filter navigation based on user permissions
  const filteredNavigation = filterNavigationByPermissions(
    sidebarNavigation,
    permissions
  );

  // ---- Personal workspace: pins ------------------------------------------
  // Pins are stored as bare hrefs and are NEVER rendered directly. They are
  // resolved against `pinnable`, which is derived from the role-filtered nav
  // above — so a pin for a module this role can no longer open has nothing to
  // resolve to and silently drops out. The stored list is left alone, so the
  // pin comes back by itself if access does.
  const { pins, hydrated, toggle } = useWorkspacePins(user?.id);
  const pinnable = flattenPinnable(filteredNavigation);
  const allowedHrefs = new Set(pinnable.map((i) => i.href));
  const pinnedItems = resolvePins(pins, pinnable);
  const pinnedHrefs = new Set(pinnedItems.map((i) => i.href));

  const handleTogglePin = (item: NavItem) => {
    const res = toggle(item.href, allowedHrefs);
    if (res.ok) return;
    // Never fail silently: the star visibly did nothing, so say why.
    if (res.reason === "limit") {
      toast.info(`You can pin up to ${MAX_PINS} modules`, {
        description: `Unpin one to make room for ${item.title}.`,
      });
    } else {
      toast.error("Couldn't save your pin", {
        description: "This browser is blocking storage (private window?), so pins can't be remembered here.",
      });
    }
  };

  const pinFor = (item: NavItem): PinControl => ({
    pinned: pinnedHrefs.has(item.href),
    reveal: pinnedHrefs.has(item.href) ? "always" : "hover",
    onToggle: () => handleTogglePin(item),
  });

  if (isLoading) {
    return (
      <Sidebar collapsible="icon" variant="floating" className="border-r-0">
        <SidebarSkeleton />
      </Sidebar>
    );
  }

  return (
    <Sidebar collapsible="icon" variant="floating">
      {/* Header with logo. */}
      <SidebarHeader className="px-3 pb-3.5 pt-[calc(0.875rem+max(var(--sat),0px))]">
        <Link
          href="/dashboard"
          onClick={() => handleNavigate("/dashboard")}
          className="group/brand flex items-center gap-2.5 rounded-xl transition-all duration-200 hover:opacity-95 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {/* Collapsed (icon-only) sidebar — compact mark */}
          <div className="logo-chip ring-glow-brand hidden size-7 shrink-0 items-center justify-center rounded-lg text-primary-foreground transition-transform duration-200 group-hover/brand:scale-[1.04] group-data-[collapsible=icon]:flex">
            <Gem className="size-3.5" strokeWidth={2.5} />
          </div>
          {/* Expanded sidebar — full wordmark, falls back to mark + text */}
          <div className="flex items-center gap-2.5 group-data-[collapsible=icon]:hidden">
            <BrandLogo
              className="h-8 w-auto max-w-[180px] object-contain object-left"
              fallback={
                <>
                  <div className="logo-chip ring-glow-brand flex size-7 shrink-0 items-center justify-center rounded-lg text-primary-foreground transition-transform duration-200 group-hover/brand:scale-[1.04]">
                    <Gem className="size-3.5" strokeWidth={2.5} />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-editorial text-copy font-semibold tracking-[-0.01em] text-sidebar-foreground">
                      Veloria Grand
                    </span>
                    <span className="text-meta font-medium tracking-wide text-sidebar-foreground/45">
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

      {/* Navigation. */}
      <SidebarContent className="overscroll-contain px-2">
        <SidebarGroup className="px-0">
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Pinned by you. Rendered only once the client store has been
                  read (`hydrated`): pins live in localStorage, which the server
                  cannot see, so drawing anything earlier would either mismatch
                  on hydration or flash the empty hint at people who have pins. */}
              {hydrated && (
                <>
                  <SidebarGroupLabel className="mt-1 mb-1 px-2.5 text-meta font-semibold uppercase tracking-[0.06em] text-sidebar-foreground/45 group-data-[collapsible=icon]:hidden">
                    Pinned by you
                  </SidebarGroupLabel>
                  {pinnedItems.length === 0 ? (
                    // The feature is hover-revealed on desktop, so without this
                    // line nobody would ever discover it.
                    <li className="px-2.5 pb-1 text-meta leading-snug text-sidebar-foreground/45 group-data-[collapsible=icon]:hidden">
                      Star any module to keep it here.
                    </li>
                  ) : (
                    <>
                      {pinnedItems.map((item) => (
                        <SidebarNavItem
                          key={`pin:${item.href}`}
                          item={item}
                          isActive={currentPath === item.href || currentPath.startsWith(item.href + "/")}
                          onNavigate={handleNavigate}
                          pin={{ pinned: true, reveal: "hover", onToggle: () => handleTogglePin(item) }}
                        />
                      ))}
                      {/* Icon-only mode hides the labels, so a hairline is the
                          only thing separating pins from the full module list. */}
                      <li
                        aria-hidden
                        className="mx-2 my-1.5 hidden h-px bg-sidebar-border group-data-[collapsible=icon]:block"
                      />
                    </>
                  )}
                </>
              )}
              {(() => {
                const seenSections = new Set<string>();
                return filteredNavigation.map((item) => {
                  const section = SECTIONS[item.href];
                  const showHeader = !!section && !seenSections.has(section);
                  if (section) seenSections.add(section);

                  const node =
                    item.children && item.children.length > 0 ? (
                      <SidebarCollapsibleItem item={item} pathname={currentPath} onNavigate={handleNavigate} pinFor={pinFor} />
                    ) : (
                      <SidebarNavItem
                        item={item}
                        isActive={currentPath === item.href || currentPath.startsWith(item.href + "/")}
                        onNavigate={handleNavigate}
                        pin={pinFor(item)}
                      />
                    );

                  return (
                    <Fragment key={item.href}>
                      {showHeader && (
                        <SidebarGroupLabel className="mt-5 mb-1 px-2.5 text-meta font-semibold uppercase tracking-[0.06em] text-sidebar-foreground/45 group-data-[collapsible=icon]:hidden">
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

      {/* Footer with user info. Safe-area bottom: in PWA standalone mode this
          row otherwise sits under the iOS home indicator, making "Sign out"
          and the profile row effectively untappable. */}
      <SidebarFooter className="border-t border-sidebar-border p-2 pb-[calc(0.5rem+max(var(--sab),0px))]">
        {/* Install on phone — matters most for field staff, whose geo-fenced
            attendance check-in happens on mobile. */}
        <Link
          href="/get-app"
          onClick={() => handleNavigate("/get-app")}
          className="flex min-h-11 items-center gap-2.5 rounded-xl px-2.5 py-2 text-body font-medium text-sidebar-foreground/70 transition-colors duration-150 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0 md:min-h-0 md:text-detail"
          title="Get the app on your phone"
        >
          <Smartphone className="size-4 shrink-0" />
          <span className="truncate group-data-[collapsible=icon]:hidden">
            Get the app
          </span>
        </Link>
        <div className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors duration-150 hover:bg-sidebar-accent/70 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0">
          <Avatar size="sm">
            <AvatarImage src={user?.image || undefined} alt={user?.name || ""} />
            <AvatarFallback className="bg-primary text-meta font-medium text-primary-foreground">
              {user?.name
                ?.split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2) || "VG"}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-1 flex-col overflow-hidden group-data-[collapsible=icon]:hidden">
            <span className="truncate text-detail font-medium leading-tight text-sidebar-accent-foreground">
              {user?.name || "Guest"}
            </span>
            <span className="truncate text-meta leading-tight text-sidebar-foreground/55">
              {ROLE_LABELS[user?.role || ""] || "Unknown"}
            </span>
          </div>
          <button
            onClick={() => signOutSafely("/sign-in")}
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
