# Navigation Architecture

## 1. Executive Summary
The Veloria Grand application employs a **Sidebar-First Navigation Architecture**. The sidebar is the primary user-facing structural map of the entire enterprise system, serving as the shell for navigation, role-based module discovery, personal workspace shortcut pinning, and quick access to operational workflows.

## 2. Core Architectural Components
- **Sidebar Component**: `src/components/layout/app-sidebar.tsx` (`AppSidebar`).
- **Sidebar Provider & Primitive**: `src/components/ui/sidebar.tsx` (`SidebarProvider`, `Sidebar`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuSub`).
- **Navigation Configuration**: `src/config/navigation.ts` (`sidebarNavigation`, `filterNavigationByPermissions`).
- **Workspace Pins Manager**: `src/lib/workspace/pins.ts` (`flattenPinnable`, `resolvePins`, `MAX_PINS = 6`) and `src/lib/workspace/use-workspace-pins.ts`.
- **Feature Flag Integration**: `src/config/feature-flags.ts` (`LEAD_OPS_PAGES_ENABLED`).
- **Layout Container**: `src/app/(dashboard)/layout.tsx`.

## 3. Navigation State & Dynamic Capabilities
1. **Role-Based Permission Filtering**: Evaluates user permissions dynamically via `filterNavigationByPermissions()` using `usePermissions()`.
2. **Active State Highlighting**: Evaluates current URL path using `usePathname()` and highlights active items with the `.sidebar-active-accent` CSS utility.
3. **Collapsible Section Tree**: Multi-level accordion/collapsible menus built on Radix Collapsible primitives.
4. **Workspace Pins Bar**: Users can pin up to 6 favorite navigation targets to a dedicated quick-access bar at the top of the sidebar.
5. **Responsive Drawer**: Collapses into a mobile slide-out Sheet drawer on smaller screens (`<md`).
