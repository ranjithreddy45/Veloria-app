# Quotation Route & Navigation Map

## Overview

Mapping internal dashboard routes, public quote portals, API endpoints, and navigation links.

---

## Route Census

| Route Path | Filesystem Location | Category | Purpose | Access Control |
|---|---|---|---|---|
| `/quotations` | `src/app/(dashboard)/quotations/page.tsx` | Internal Dashboard | Master quotation list & status filters | `quotations:read` |
| `/quotations/new` | `src/app/(dashboard)/quotations/new/page.tsx` | Internal Dashboard | Quotation & Tier builder | `quotations:create` |
| `/quotations/[id]` | `src/app/(dashboard)/quotations/[id]/page.tsx` | Internal Dashboard | Quotation detail, versioning & PDF | `quotations:read` |
| `/pricing` | `src/app/(dashboard)/pricing/page.tsx` | Internal Dashboard | Dynamic yield rules & rate plans | `pricing:manage` |
| `/pricing/demand` | `src/app/(dashboard)/pricing/demand/page.tsx` | Internal Dashboard | Peak dates & hot dates manager | `pricing:manage` |
| `/pricing/yield` | `src/app/(dashboard)/pricing/yield/page.tsx` | Internal Dashboard | Yield simulator & rule editor | `pricing:manage` |
| `/q/[token]` | `src/app/(public)/q/[token]/page.tsx` | Public Viewer | Public quote proposal portal | Public (Tokenized) |
| `/api/quotations/[id]/pdf` | `src/app/api/quotations/[id]/pdf/route.ts` | API Endpoint | PDF document generator | Session / Token |
| `/api/cron/quote-nudge` | `src/app/api/cron/quote-nudge/route.ts` | Cron API | Automated silent nudge cron | `CRON_SECRET` |
