# Phase 02: Global Layouts Inventory

## 1. Master Layouts Inventory

| Layout ID | Scope | Source File | Key Components Rendered | Auth / Role Requirements |
|---|---|---|---|---|
| SHELL-0001 | Root Layout | `src/app/layout.tsx` | HTML/Body, Fonts, ThemeProvider, Toaster | Public base |
| SHELL-0002 | Dashboard Shell | `src/app/(dashboard)/layout.tsx` | `SidebarProvider`, `AppSidebar`, `AppHeader`, `SidebarInset` | NextAuth Session |
| SHELL-0003 | Print / PDF Layout | `src/app/(print)/layout.tsx` | Bare unconstrained printable canvas | NextAuth / Token |
| SHELL-0004 | Authentication Layout | `src/app/(auth)/layout.tsx` | Centered sign-in card container | Public Unauthenticated |
| SHELL-0005 | Client Portal Shell | `src/app/portal/layout.tsx` | Client portal sidebar & header | Client Role Session |
| SHELL-0006 | Vendor Portal Shell | `src/app/vendor-portal/layout.tsx` | Vendor portal sidebar & header | Vendor Role Session |
| SHELL-0007 | Public Token Shell | `src/app/q/[token]/layout.tsx` | Standalone public link wrapper | Public Link Token |
