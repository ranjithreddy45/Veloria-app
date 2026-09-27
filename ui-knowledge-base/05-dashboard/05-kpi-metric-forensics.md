# KPI & METRIC FORENSICS

## 1. Metric Trace Methodology

Every KPI figure displayed on `/dashboard` is calculated server-side in `getHomeView()` ([home.actions.ts](file:///Users/fci/Documents/Veloria-app/src/actions/home.actions.ts)) and formatted by `buildKpis()` ([summary.ts](file:///Users/fci/Documents/Veloria-app/src/lib/home/summary.ts)).

---

## 2. Key Metric Traces

### METRIC-0501: Cash Collected This Month
- **UI Label**: `"Cash collected (MTD)"`
- **Target Audience**: `owner`, `finance` lenses
- **Source Trace**:
```
Prisma.payment.aggregate({
  where: {
    status: "COMPLETED",
    paidAt: { gte: monthStart, lt: monthEnd }
  },
  _sum: { amount: true }
})
```
- **Formatting**: Currency formatted in INR (`₹XX,XX,XXX`).

### METRIC-0502: Total Booked Value
- **UI Label**: `"Booked revenue (MTD)"`
- **Target Audience**: `owner`, `sales` lenses
- **Source Trace**:
```
Prisma.booking.aggregate({
  where: {
    status: { in: ["CONFIRMED", "COMPLETED"] },
    createdAt: { gte: monthStart, lt: monthEnd }
  },
  _sum: { totalAmount: true }
})
```
- **Formatting**: Currency formatted in INR (`₹XX,XX,XXX`).

### METRIC-0503: Active SLA Breaches
- **UI Label**: `"SLA Breaches"`
- **Target Audience**: `owner`, `sales` lenses
- **Source Trace**:
```
Prisma.lead.count({
  where: {
    status: "NEW",
    firstResponseBreachedAt: { not: null }
  }
})
```

### METRIC-0504: Overdue Receivables
- **UI Label**: `"Overdue Payments"`
- **Target Audience**: `finance`, `owner` lenses
- **Source Trace**:
```
Prisma.invoice.aggregate({
  where: {
    status: "OVERDUE",
    balanceDue: { gt: 0 }
  },
  _sum: { balanceDue: true }
})
```
