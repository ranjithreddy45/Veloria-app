# Phase 02: Global Providers

| Provider ID | Provider Name | Source File | Scope | Purpose |
|---|---|---|---|---|
| PROVIDER-0001 | `SessionProvider` | NextAuth | Root Layout | Supplies NextAuth session context to all hooks |
| PROVIDER-0002 | `ThemeProvider` | `next-themes` | Root Layout | Manages light/dark mode CSS variables (`.dark`) |
| PROVIDER-0003 | `Toaster` | `sonner` | Root Layout | Mounts global toast notification container |
| PROVIDER-0004 | `SidebarProvider` | `sidebar.tsx` | Dashboard Shell | Controls sidebar collapse/expand & mobile drawer state |
| PROVIDER-0005 | `TooltipProvider` | `@radix-ui` | Root Layout | Manages tooltip hover delays globally |
