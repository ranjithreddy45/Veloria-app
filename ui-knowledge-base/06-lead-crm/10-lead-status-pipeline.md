# LEAD STATUS & PIPELINE FORENSICS

## 1. Status Lifecycle Pipeline

Veloria Grand leads progress through a 6-stage lifecycle pipeline.

```
NEW ──► CONTACTED ──► QUALIFIED ──► PROPOSAL_SENT ──► WON (Converted)
                                                  └──► LOST (Archived)
```

---

## 2. Status Transition Rules

| Current Status | Target Status | Required Conditions | Trigger Action |
|---|---|---|---|
| `NEW` | `CONTACTED` | First outbound communication (Call/WhatsApp) logged | `updateLeadStatus()` |
| `CONTACTED` | `QUALIFIED` | Guest count, date, and budget verified | `updateLeadStatus()` |
| `QUALIFIED` | `PROPOSAL_SENT` | Formal Quotation created & dispatched | Auto-updated on Quote creation |
| `PROPOSAL_SENT` | `WON` | Contract signed or booking deposit received | Auto-updated on Booking confirm |
| Any Status | `LOST` | Disqualification reason recorded | `updateLeadStatus()` |
