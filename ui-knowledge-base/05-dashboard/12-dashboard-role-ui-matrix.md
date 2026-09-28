# DASHBOARD ROLE UI MATRIX

## 1. Role-Specific Dashboard Surface Customization

The dashboard UI adjusts visible KPI cards, attention feed items, side cards, and quick actions based on the active user's assigned RBAC role lens.

---

## 2. Role Visibility Matrix

| Role | Lens | Primary KPI 1 | Primary KPI 2 | Side Card Component | Priority Feed Items |
|---|---|---|---|---|---|
| `ADMIN` | `owner` | Cash Collected MTD | Booked Revenue MTD | Executive Revenue Summary | All System SLA & Approvals |
| `GENERAL_MANAGER` | `owner` | Cash Collected MTD | Booked Revenue MTD | Executive Revenue Summary | Operational & SLA Alerts |
| `SALES` | `sales` | Booked Revenue MTD | Active Quotes Opened | Quote Views & Conversions | Overdue Follow-ups, SLA Breaches |
| `OPS` | `ops` | Today's Events | Tomorrow's Covers | Today's Event Schedule | Unapproved BEOs, Staffing Gaps |
| `KITCHEN` | `ops` | Today's Covers | Tomorrow's Covers | Kitchen Preparation Plan | Special Dietary & Cover Alerts |
| `FINANCE` | `finance` | Cash Collected MTD | Overdue Receivables | Receivables & Payment Proofs | Unverified Proofs, Refund Requests |
| `HR` | `staff` | Active Staff | Today's Attendance | Upcoming Staff Birthdays | Leave Requests Pending |
