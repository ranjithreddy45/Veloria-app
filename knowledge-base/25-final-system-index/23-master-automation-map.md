# Phase 23: Master Automation Map

| Automation Process | Trigger | Action Performed | Fallback / Manual | Status |
|---|---|---|---|---|
| Lead Assignment | Lead Creation | Round-robin / Rule-based assignment | Manual reassignment | AUTOMATIC |
| SLA Breach Tracking | Cron / Timer | SLA breach flag & escalation alert | Manual SLA override | AUTOMATIC |
| Soft Hold Expiration | Cron (`/api/cron/hold-expiration`) | Release venue hold token | Manual hold extension | AUTOMATIC |
| GL Journal Posting | Invoice / Payment Action | Balance double-entry GL journals | Manual journal entry | AUTOMATIC |
| WhatsApp Notification | Lead / Booking Event | Send Meta WhatsApp template | Manual message send | AUTOMATIC |
| Payroll Accrual | Final Day Cron | Calculate salary & LOP deductions | Manual HR review | AUTOMATIC |
| Inventory Alert | Stock Deduction | Reorder threshold notification | Manual PO generation | AUTOMATIC |
