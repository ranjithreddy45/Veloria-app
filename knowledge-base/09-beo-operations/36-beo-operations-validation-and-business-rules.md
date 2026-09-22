# 36 - BEO & Operations Validation & Business Rules

---

## 🛑 Validation Safeguards

```
CODE VERIFIED BUSINESS RULES:
1. Lock Safeguard: A `LOCKED` BEO cannot be edited via `updateBeo` without Admin role override.
2. Headcount Source Mandate: Updating BEO covers enforces explicit tagging (`CONTRACTED`, `RSVP_CONFIRMED`, `MANUAL`) via `src/lib/guests/headcount.ts`.
3. Task Proof Mandate: Tasks with `requiresProof == true` block moving status to `COMPLETED` until a `TaskProof` is uploaded.
4. Incident Resolution Rule: Resolving an incident (`resolveBeoIncident`) requires providing resolution notes.
5. Work Order Signature: Vendor work orders (`WorkOrder`) must be signed before advance payments can be released (`releaseAdvance`).
```
