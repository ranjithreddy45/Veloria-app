# 49 Background Verification (BGV)

`CODE VERIFIED`

- Implemented via `RecBgvCheck` model and `src/actions/recruit-bgv.actions.ts`.
- Check Types: `IDENTITY`, `EDUCATION`, `EMPLOYMENT`, `CRIMINAL`, `ADDRESS`, `REFERENCE`.
- Statuses: `PENDING`, `IN_PROGRESS`, `CLEARED`, `FLAGGED`, `FAILED`.
- Features: Assign vendor, add remarks, upload proof attachment URL (`isSafeReceiptUrl`), stamp `completedAt` on terminal state.
