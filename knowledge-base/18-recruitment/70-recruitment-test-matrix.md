# 70 Recruitment Static Test Matrix

`CODE VERIFIED`

| Test Case | Inputs / Scenario | Expected Outcome | Verification Status |
|---|---|---|---|
| Public Apply | Valid inputs on `/careers/[id]` | Creates `RecCandidate` + `RecApplication` + DPDP consent | `CODE VERIFIED` |
| Duplicate Apply | Apply same email to same role | Returns "already applied" error (`P2002` constraint) | `CODE VERIFIED` |
| Invalid Resume | Upload javascript: URL or > 2.2MB blob | Rejected by `validateResumeUrl()` | `CODE VERIFIED` |
| Excessive CTC | Create offer with CTC > 50M | Rejected by `MAX_CTC` cap check | `CODE VERIFIED` |
| Invalid Offer Transition | Change `ACCEPTED` offer to `SENT` | Blocked by `OFFER_TRANSITIONS` guard | `CODE VERIFIED` |
| Unhired Conversion | Convert `NEW` stage candidate to Employee | Blocked by `isHired` check | `CODE VERIFIED` |
| Hired Conversion | Convert `HIRED` candidate to Employee | Creates `Employee` (`ONBOARDING`), appends notes | `CODE VERIFIED` |
| Conversion Idempotency | Re-click "Create employee" button | Returns existing `employeeId` (`created: false`) | `CODE VERIFIED` |
