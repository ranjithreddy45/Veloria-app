# 20 - Vendor Setup & Teardown Tracking

---

## ⏰ On-Site Time Tracking

`OperationVendorAssignment` records precise event-day timeline commitments:
- `arrivalTime`: Expected vendor arrival at venue.
- `setupTime`: Deadline for setup completion prior to guest arrival.
- `teardownTime`: Mandated post-event clearing deadline.

---

## 🔔 Automated Reminders

The `/api/cron/vendor-reminders` cron job scans upcoming event assignments 24 hours prior to setup and dispatches WhatsApp/Email setup reminders to vendors.
