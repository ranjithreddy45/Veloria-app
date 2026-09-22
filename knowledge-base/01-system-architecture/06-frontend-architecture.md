# CHUNK 01-06 — FRONTEND ARCHITECTURE

- **Status**: `CODE VERIFIED`
- **Module**: System Architecture
- **Target Path**: `knowledge-base/01-system-architecture/06-frontend-architecture.md`

---

## 📌 Frontend Component Hierarchy & Paradigms

Veloria Grand uses a hybrid architecture combining **React Server Components (RSC)** for data fetching and **React Client Components (RCC)** for interactive UI state.

### Component Layering Overview

```
[Next.js App Router Page (RSC)]  <-- Direct Prisma / DB Data Fetching (0 KB JS Bundle)
      │
      ├──> [Layout Header & Sidebar (RCC)]  <-- Navigation State, Role Badge, Theme Toggle
      │
      ├──> [Data Table Component (RCC)]      <-- @tanstack/react-table, Search, Filter, Sort
      │
      ├──> [Kanban Pipeline Board (RCC)]    <-- @dnd-kit/core Drag-and-Drop Stage Transitions
      │
      └──> [Form Dialog / Modal (RCC)]       <-- react-hook-form + zodResolver + Server Actions
```

---

## 📝 Form Handling & Validation Engine

Forms use `react-hook-form` paired with `@hookform/resolvers/zod` to achieve strict client-and-server validation synchronization:

1. **Schema Definition**: Shared Zod schema defined in `src/schemas/*` (e.g., `reimbursementClaimSchema` in `src/schemas/hr.schema.ts`).
2. **Form Initialization**: `useForm<ReimbursementClaimInput>({ resolver: zodResolver(reimbursementClaimSchema) })`.
3. **Client-Side Validation**: Evaluated on submit or blur. Inline field errors render before network requests are initiated.
4. **Server Action Submission**: Valid data is passed to the Server Action (`createReimbursementClaim()`).
5. **Server Validation**: The Server Action re-evaluates the payload against `reimbursementClaimSchema.parse(payload)`.
6. **Toast Feedback**: Results emit feedback via `sonner` (`toast.success()` / `toast.error()`).

---

## 📊 Reusable UI Libraries & Primitives

- **Shadcn UI & Radix Primitives**: Unstyled, accessible component primitives (`radix-ui`) customized with Tailwind CSS styles (`src/components/ui/`). Includes `Dialog`, `DropdownMenu`, `Popover`, `Select`, `Tabs`, `Accordion`, `Tooltip`.
- **Kanban Board (`@dnd-kit/core`, `@dnd-kit/sortable`)**: Powers the interactive lead sales pipeline (`src/app/(dashboard)/pipeline/page.tsx`), enabling drag-and-drop lead stage transitions.
- **Charts (`recharts`)**: Renders executive revenue analytics, lead conversion funnels, and attendance trend graphs (`src/app/(dashboard)/dashboard/page.tsx`).
- **Icons (`lucide-react`)**: Universal vector icons (`lucide-react`) used across navigation bars, buttons, and status indicators.
