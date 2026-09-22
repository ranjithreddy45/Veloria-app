# 61 BD Static Test Matrix

`CODE VERIFIED`

| Test Case | Inputs / Scenario | Expected Outcome | Verification Status |
|---|---|---|---|
| Lead Conversion | Convert QUALIFIED `AcqLead` | Creates `AcqDeal` in `PROSPECT` stage | `CODE VERIFIED` |
| Deal Win | Transition `AcqDeal` to `WON` | Calls `ensureDealProperty()`, creates property & onboarding project | `CODE VERIFIED` |
| Contract Signing | Sign `AcqContract` | Status `SIGNED`, invokes `ensureDealProperty()` | `CODE VERIFIED` |
| Property Publish | Set `AcqProperty.status = PUBLISHED` | Invokes `ensureVenueForProperty()`, creates bookable `Venue` | `CODE VERIFIED` |
| Projection Calculation | Enter revenue, expense, rent | Computes EBITDA, payback months, and ROI % | `CODE VERIFIED` |
| SLA Cron | Run `/api/cron/acq-sla` | Detects overdue deals, logs SLA escalation alerts | `CODE VERIFIED` |
