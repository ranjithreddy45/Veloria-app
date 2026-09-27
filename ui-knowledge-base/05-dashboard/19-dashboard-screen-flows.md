# DASHBOARD SCREEN FLOWS

## 1. Supported User Flows

### FLOW-0501: SLA Breach Resolution Flow
```
[1] User views /dashboard Attention Feed
        │
        ▼
[2] Identifies "SLA Breached Lead: Rahul Sharma"
        │
        ▼
[3] Clicks "Respond Now" button
        │
        ▼
[4] Navigates to /leads/[id] detail page
        │
        ▼
[5] Sends WhatsApp message or logs call
        │
        ▼
[6] System clears SLA breach flag & updates dashboard Attention Feed
```

---

### FLOW-0502: Payment Verification Flow
```
[1] Finance Manager opens /dashboard
        │
        ▼
[2] Side Card shows "1 Payment Proof Pending Verification"
        │
        ▼
[3] Clicks "Verify Proof"
        │
        ▼
[4] Modal opens displaying receipt image & invoice details
        │
        ▼
[5] Clicks "Approve Payment"
        │
        ▼
[6] Payment status updated to COMPLETED; Cash Collected KPI increases dynamically
```
