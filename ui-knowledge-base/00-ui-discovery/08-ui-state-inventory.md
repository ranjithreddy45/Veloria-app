# Phase 00: UI State Inventory

## 1. System UI States
- **Loading State**: Rendered via Next.js `loading.tsx` and custom `<Skeleton />` loaders during data fetch.
- **Empty State**: Custom empty state components rendering empty box illustration, descriptive text, and primary CTA button.
- **Error State**: Rendered via Next.js `error.tsx` boundary with retry trigger.
- **Read-Only Lock State**: Form fields disabled (`disabled={isLocked}`) with lock icon banner when entity is locked.
- **Submitting State**: Action buttons show spinning loader (`<Loader2 className="animate-spin" />`) and disabled state during Server Action execution.
