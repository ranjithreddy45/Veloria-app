"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Users,
  Contact,
  UserPlus,
  Kanban,
  CalendarCheck,
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
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

// ============================================================
// Icon map: maps string icon names from nav config to components
// ============================================================

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
  Contact,
  UserPlus,
  Kanban,
  CalendarCheck,
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
};

function getIcon(iconName: string): LucideIcon {
  return iconMap[iconName] || LayoutDashboard;
}

// ============================================================
// Collapsible group labels
// ============================================================

const GROUP_LABELS: Record<string, string> = {
  "/contacts": "CRM",
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
          "transition-all duration-200",
          isActive &&
            "bg-sidebar-primary/15 text-sidebar-primary shadow-[inset_3px_0_0_0] shadow-sidebar-primary hover:bg-sidebar-primary/20 hover:text-sidebar-primary"
        )}
      >
        <Link href={item.href}>
          <Icon className="size-4" />
          <span>{item.title}</span>
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
        <SidebarGroupLabel className="mt-2 text-sidebar-foreground/40 uppercase text-[10px] font-semibold tracking-widest">
          {groupLabel}
        </SidebarGroupLabel>
      )}
      <Collapsible defaultOpen={isGroupActive} className="group/collapsible">
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton
              tooltip={item.title}
              className={cn(
                "transition-all duration-200",
                isGroupActive &&
                  "bg-sidebar-primary/15 text-sidebar-primary shadow-[inset_3px_0_0_0] shadow-sidebar-primary hover:bg-sidebar-primary/20 hover:text-sidebar-primary"
              )}
            >
              <Icon className="size-4" />
              <span>{item.title}</span>
              <ChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              {item.children?.map((child) => {
                const ChildIcon = getIcon(child.icon);
                const isChildActive = pathname === child.href;
                return (
                  <SidebarMenuSubItem key={child.href}>
                    <SidebarMenuSubButton
                      asChild
                      isActive={isChildActive}
                      className={cn(
                        "transition-all duration-200",
                        isChildActive && "text-sidebar-primary"
                      )}
                    >
                      <Link href={child.href}>
                        <ChildIcon className="size-3.5" />
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
    <Sidebar collapsible="icon" className="border-r-0">
      {/* Header with logo */}
      <SidebarHeader className="p-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 transition-opacity hover:opacity-80"
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-[oklch(0.55_0.22_300)] text-white shadow-md shadow-primary/25">
            <Gem className="size-4" />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-bold tracking-tight text-sidebar-foreground">
              Veloria Grand
            </span>
            <span className="text-[10px] text-sidebar-foreground/50">
              Venue Management
            </span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarSeparator className="bg-sidebar-border opacity-50" />

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

                const isActive = pathname === item.href;
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

      <SidebarSeparator className="bg-sidebar-border opacity-50" />

      {/* Footer with user info */}
      <SidebarFooter className="p-3">
        <div className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-sidebar-accent/50 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0">
          <Avatar size="default">
            <AvatarImage src={user?.image || undefined} alt={user?.name || ""} />
            <AvatarFallback className="bg-primary text-xs text-primary-foreground">
              {user?.name
                ?.split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2) || "VG"}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-1 flex-col overflow-hidden group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-medium text-sidebar-foreground">
              {user?.name || "Guest"}
            </span>
            <Badge
              variant="secondary"
              className="mt-0.5 w-fit bg-sidebar-accent px-1.5 py-0 text-[10px] text-sidebar-foreground/60"
            >
              {ROLE_LABELS[user?.role || ""] || "Unknown"}
            </Badge>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/sign-in" })}
            className="shrink-0 rounded-md p-1.5 text-sidebar-foreground/40 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground group-data-[collapsible=icon]:hidden"
            title="Sign out"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
