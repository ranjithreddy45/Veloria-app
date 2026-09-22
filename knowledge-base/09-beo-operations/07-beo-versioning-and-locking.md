# 07 - BEO Versioning & Locking Rules

---

## 🔒 Locking Mechanics (`setBeoStatus('LOCKED')`)

- **Strict Read-Only Guard**: When `Beo.status === "LOCKED"`, `updateBeo(id, patch)` returns `{ success: false, error: "This function sheet is locked and read-only." }`. ALL patch field updates are blocked.
- **State Machine Terminal Enforcement**: `OPS_TRANSITIONS.beo["LOCKED"]` is defined as `[]`. Once locked, `setBeoStatus` returns error `"Can't move from LOCKED to ..."` for any target status.
- **Lock Timing**: Operational guidelines recommend locking 24-48h prior to event; however, this timing is an operational recommendation and is NOT an application-enforced code rule.
