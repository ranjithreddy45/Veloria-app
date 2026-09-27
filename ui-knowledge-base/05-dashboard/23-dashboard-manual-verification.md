# DASHBOARD MANUAL VERIFICATION CHECKLIST

## 1. Manual Verification Items

Static analysis has verified the exact code architecture. Runtime browser verification is required for the following interactive items:

| Check ID | Verification Item | Target Behavior | Priority |
|---|---|---|---|
| **MAN-DASH-01** | Live Activity Polling | Verify activity stream updates automatically without full page reload | High |
| **MAN-DASH-02** | Welcome Tour Modal | Confirm modal pops up once for new user and never nags after dismissal | High |
| **MAN-DASH-03** | Role Lens Switching | Login as `SALES` vs `FINANCE` vs `OPS` and verify distinct KPI cards | High |
| **MAN-DASH-04** | Degraded State Fallback | Simulate network drop and verify degraded warning banner appears | Medium |
| **MAN-DASH-05** | Mobile Layout Stacking | Verify 12-column grid collapses cleanly into 1 column on mobile screens | High |
