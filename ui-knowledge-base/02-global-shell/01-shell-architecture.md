# Phase 02: Shell Architecture Overview

## 1. Executive Summary
The Veloria Grand application shell provides the outer visual frame, responsive navigation system, layout containers, and global providers surrounding every screen. It encompasses the root layout (`src/app/layout.tsx`), internal dashboard shell (`src/app/(dashboard)/layout.tsx`), header bar (`AppHeader`), collateral navigation (`AppSidebar`), and global overlays (`CommandPalette`, `Toaster`).

## 2. Shell Layout Hierarchy
```mermaid
graph TD
    ROOT[Root Layout: src/app/layout.tsx] --> PROVIDERS[Providers: Auth, Theme, Toaster]
    PROVIDERS --> ROUTE_LAYOUT{Route Scope Layout}
    ROUTE_LAYOUT -->|Internal Dashboard| DASH_SHELL[Dashboard Shell: src/app/(dashboard)/layout.tsx]
    ROUTE_LAYOUT -->|Print / PDF| PRINT_SHELL[Print Layout: src/app/(print)/layout.tsx]
    ROUTE_LAYOUT -->|Auth / Sign In| AUTH_SHELL[Auth Layout: src/app/(auth)/layout.tsx]
    ROUTE_LAYOUT -->|Public Tokens| PUBLIC_SHELL[Public Token Layout: /q/*, /sign/*, /pay/*]

    DASH_SHELL --> SIDEBAR[AppSidebar: src/components/layout/app-sidebar.tsx]
    DASH_SHELL --> INSET[SidebarInset]
    INSET --> HEADER[AppHeader: src/components/layout/app-header.tsx]
    INSET --> PAGE[Page Component]
```
