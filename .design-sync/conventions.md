# Veloria Design System — conventions

Veloria is an event-venue ERP (weddings, corporate events) with an
Apple-inspired, vibrant-but-premium look: SF Pro/system font stack, purple
primary with a gradient sheen, generous radii (`rounded-xl`/`rounded-2xl`),
soft layered shadows.

## Setup

No provider wrapper is required — components work standalone. Exceptions:
- `Sidebar` must be wrapped in `SidebarProvider` (throws without it).
- Toasts: render `<Toaster />` once, then call `toast(...)` from `sonner`.
- `Tooltip` includes its own provider; use `Tooltip > TooltipTrigger + TooltipContent` directly.

## Styling idiom: Tailwind utilities + design tokens

Style layout glue with Tailwind classes; never invent CSS class names and
never restyle component internals. The shipped stylesheet includes the
Veloria theme tokens and a curated utility set — stick to common utilities:

| Family | Examples |
|---|---|
| Layout | `flex flex-col grid grid-cols-{1..6} items-center justify-between gap-{1..12}` |
| Spacing | `p-{1..12} px-* py-* m-* mx-auto space-y-{1..8}` |
| Sizing | `w-full w-fit w-{8..96} max-w-{xs..6xl} h-full size-{3..16} min-w-0` |
| Type | `text-{xs..5xl} font-{medium,semibold,bold} font-display tracking-tight leading-tight truncate line-clamp-{1..3} tabular-nums` |
| Color (tokens) | `text-foreground text-muted-foreground text-primary bg-background bg-card bg-muted bg-primary/10 border-border` |
| Surface | `border rounded-{lg,xl,2xl,full} shadow-{xs,sm,premium} divide-y` |

Color ALWAYS goes through tokens (`bg-card`, `text-muted-foreground`,
`border-border`, chart colors `var(--chart-1)`…`var(--chart-5)`) — never raw
hex or Tailwind palette colors like `bg-blue-500`. Dark mode is automatic via
the `.dark` class when tokens are used.

## Component vocabulary

Components use shadcn-style compound families — compose the exported parts,
e.g. `Card > CardHeader(CardTitle, CardDescription, CardAction) + CardContent + CardFooter`;
`Select > SelectTrigger(SelectValue) + SelectContent(SelectGroup > SelectLabel, SelectItem)`.
Variants ride on props: `Button variant="default|secondary|outline|ghost|destructive|link" size="xs|sm|default|lg|icon"`,
`Badge variant`, etc. Icons come from `lucide-react` (auto-sized inside Button).
Signature Veloria pieces: `StatTile` (KPI tiles), `CountUp` (animated numbers),
`Donut` (ring chart), `ViewTabs`/`SegmentedControl` (view switching),
`EmptyState`, `KanbanBoard`.

## Where the truth lives

Read `styles.css` (`@import` closure carries the theme tokens under
`:root`/`.dark` and all utilities) and each component's `<Name>.d.ts` +
`<Name>.prompt.md` before using it.

## Idiomatic snippet

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter, Badge, Button } from "veloria-app";

<Card className="w-full max-w-md">
  <CardHeader>
    <CardTitle>Sharma × Reddy Wedding</CardTitle>
    <CardDescription>Grand Orchid Hall · 14 Nov 2026</CardDescription>
    <CardAction><Badge>Confirmed</Badge></CardAction>
  </CardHeader>
  <CardContent className="flex flex-col gap-2 text-sm">
    <div className="flex justify-between">
      <span className="text-muted-foreground">Quoted</span>
      <span className="font-medium tabular-nums">₹18,50,000</span>
    </div>
  </CardContent>
  <CardFooter className="gap-2">
    <Button size="sm">Record payment</Button>
    <Button size="sm" variant="outline">View BEO</Button>
  </CardFooter>
</Card>
```
