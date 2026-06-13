"use client";

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
  List,
  Calendar,
  CheckSquare,
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
  Phone,
  PhoneCall,
  Webhook,
  Building2,
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
  List,
  Calendar,
  CheckSquare,
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
  Phone,
  PhoneCall,
  Webhook,
  Building2,
};

function getIcon(iconName: string): LucideIcon {
  return iconMap[iconName] || LayoutDashboard;
}

// ============================================================
// Collapsible group labels
// ============================================================

const GROUP_LABELS: Record<string, string> = {
  "/contacts": "Sales CRM",
  "/bookings": "Bookings",
  "/invoices": "Finance",
};

// ============================================================
// Role display map
// ============================================================

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  SALES_EXEC: "Sales Executive",
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
}: {
  item: NavItem;
  isActive: boolean;
}) {
  const Icon = getIcon(item.icon);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        tooltip={item.title}
        className={cn(
          "h-8 rounded-md text-[13px] font-medium text-sidebar-foreground/80 transition-colors duration-150",
          "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          isActive &&
            "sidebar-active-accent bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent"
        )}
      >
        <Link href={item.href}>
          <Icon className={cn("size-4 transition-colors", isActive ? "text-sidebar-primary" : "text-sidebar-foreground/55")} strokeWidth={isActive ? 2.25 : 1.85} />
          <span className={cn(isActive && "tracking-[-0.005em]")}>{item.title}</span>
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
}: {
  item: NavItem;
  pathname: string;
}) {
  const Icon = getIcon(item.icon);
  const isGroupActive = pathname.startsWith(item.href);
  const groupLabel = GROUP_LABELS[item.href];

  return (
    <>
      {groupLabel && (
        <SidebarGroupLabel className="mt-3 mb-0.5 px-2 text-[10.5px] font-medium uppercase tracking-[0.08em] text-sidebar-foreground/40">
          {groupLabel}
        </SidebarGroupLabel>
      )}
      <Collapsible defaultOpen={isGroupActive} className="group/collapsible">
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton
              tooltip={item.title}
              className={cn(
                "h-8 rounded-md text-[13px] font-medium text-sidebar-foreground/80 transition-colors duration-150",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                isGroupActive &&
                  "text-sidebar-accent-foreground"
              )}
            >
              <Icon className={cn("size-4 transition-colors", isGroupActive ? "text-sidebar-primary" : "text-sidebar-foreground/55")} strokeWidth={isGroupActive ? 2.25 : 1.85} />
              <span className={cn(isGroupActive && "tracking-[-0.005em]")}>{item.title}</span>
              <ChevronRight className="ml-auto size-3.5 text-sidebar-foreground/40 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub className="border-sidebar-border/60">
              {item.children?.map((child) => {
                const ChildIcon = getIcon(child.icon);
                const isChildActive = pathname === child.href;
                return (
                  <SidebarMenuSubItem key={child.href}>
                    <SidebarMenuSubButton
                      asChild
                      isActive={isChildActive}
                      className={cn(
                        "h-7 rounded-md text-[12.5px] text-sidebar-foreground/70 transition-colors",
                        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                        isChildActive && "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      )}
                    >
                      <Link href={child.href}>
                        <ChildIcon className={cn("size-3.5", isChildActive ? "text-sidebar-primary" : "text-sidebar-foreground/50")} />
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
    </>
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
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      {/* Header with logo */}
      <SidebarHeader className="px-3 py-3.5">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
        >
          <div className="logo-chip flex size-7 shrink-0 items-center justify-center rounded-md text-primary-foreground">
            <Gem className="size-3.5" strokeWidth={2.5} />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-[13.5px] font-semibold tracking-[-0.012em] text-sidebar-accent-foreground">
              Veloria Grand
            </span>
            <span className="text-[10.5px] font-medium tracking-wide text-sidebar-foreground/45">
              Venue Management
            </span>
          </div>
        </Link>
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredNavigation.map((item) => {
                if (item.children && item.children.length > 0) {
                  return (
                    <SidebarCollapsibleItem
                      key={item.href}
                      item={item}
                      pathname={pathname}
                    />
                  );
                }

                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <SidebarNavItem
                    key={item.href}
                    item={item}
                    isActive={isActive}
                  />
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer with user info */}
      <SidebarFooter className="border-t border-sidebar-border p-2">
        <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-sidebar-accent group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0">
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
            className="shrink-0 rounded p-1 text-sidebar-foreground/40 transition-colors hover:bg-background hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-data-[collapsible=icon]:hidden"
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
