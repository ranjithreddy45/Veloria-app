# DASHBOARD REFRESH, CACHE & REVALIDATION

## 1. Revalidation Architecture

Dashboard data revalidation ensures real-time accuracy across team members.

---

## 2. Trigger & Revalidation Matrix

| Data Segment | Fetch Mechanism | Refresh Trigger / Frequency | Revalidation Method |
|---|---|---|---|
| **Home Facts (`getHomeView`)** | Server Component Data Fetch | Route navigation or manual page reload | Next.js Server Action / RSC Revalidation |
| **Activity Feed (`ActivityFeed`)** | Client Fetch (`useSWR` / `useEffect`) | Auto-polling every 30 seconds | `router.refresh()` or SWR refetch |
| **Velos Score Header** | Server Action (`getVelosHeaderSummary`) | Triggered on page mount | Parallel RSC Promise fetch |
| **Onboarding Progress** | Server Action (`getOnboardingProgress`) | Triggered on step completion | `revalidatePath("/dashboard")` |
