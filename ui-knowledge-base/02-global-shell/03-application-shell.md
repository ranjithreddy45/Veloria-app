# Phase 02: Application Shell Structure

## 1. Primary Internal Shell
The internal application shell (`src/app/(dashboard)/layout.tsx`) wraps 450+ dashboard screens:
- **`SidebarProvider`**: Manages global sidebar state (`workspace-ground` class).
- **`AppSidebar`**: Renders brand logo, pins bar, collapsible navigation tree, and user menu footer.
- **`SidebarInset`**: Main content area.
- **`AppHeader`**: Renders sidebar trigger, breadcrumbs, venue selector, notifications, command palette trigger, and account chips.
- **Main Viewport Container**: `flex-1 space-y-4 p-8 pt-6` responsive main content area.
