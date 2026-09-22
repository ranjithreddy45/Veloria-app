# 05 Recruitment API Map

`CODE VERIFIED`

## Public APIs & Webhooks
- Public application intake is handled directly via Next.js Server Action `applyToRole` in `src/actions/recruit-public.actions.ts` called from the `/careers/[id]` page component.
- Resume uploads accept HTTPS links or Base64 PDF/Image data URLs capped at ~1.6 MB (`RESUME_MAX_LEN = 2,200,000`), validated using `isSafeReceiptUrl` from `src/lib/sales/receipt.ts`.
- No separate standalone `/api/recruitment/*` REST endpoints exist; all operations utilize Server Actions with type-safe client-server invocation.
