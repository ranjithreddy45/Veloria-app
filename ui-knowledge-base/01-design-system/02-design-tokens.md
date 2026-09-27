# Phase 01: Design Tokens

## 1. Master CSS Variables (`src/app/globals.css`)

| Token ID | Token Name | CSS Variable | Light Value (OKLCH) | Dark Value (OKLCH) | Usage / Scope |
|---|---|---|---|---|---|
| TOKEN-0001 | Background | `--background` | `oklch(0.99 0 0)` | `oklch(0.16 0.003 286)` | App base canvas |
| TOKEN-0002 | Foreground | `--foreground` | `oklch(0.235 0.005 286)` | `oklch(0.965 0.002 286)` | Default text |
| TOKEN-0003 | Card | `--card` | `oklch(0.99 0 0)` | `oklch(0.185 0.003 286)` | Card background |
| TOKEN-0004 | Card Foreground | `--card-foreground` | `oklch(0.235 0.005 286)` | `oklch(0.965 0.002 286)` | Card text |
| TOKEN-0005 | Primary | `--primary` | `oklch(0.45 0.11 352)` | `oklch(0.66 0.13 352)` | Buttons & CTAs |
| TOKEN-0006 | Primary Foreground | `--primary-foreground` | `oklch(0.99 0 0)` | `oklch(0.16 0.003 286)` | CTA text |
| TOKEN-0007 | Sidebar | `--sidebar` | `oklch(0.978 0.0015 286)` | `oklch(0.185 0.003 286)` | App sidebar fill |
| TOKEN-0008 | Sidebar Accent | `--sidebar-accent` | `oklch(0.93 0.012 352)` | `oklch(0.27 0.016 352)` | Sidebar hover fill |
| TOKEN-0009 | Border | `--border` | `oklch(0.91 0.002 286)` | `oklch(1 0 0 / 12%)` | Structural borders |
| TOKEN-0010 | Radius | `--radius` | `0.625rem` (10px) | `0.625rem` (10px) | Border rounding |
