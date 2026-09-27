# DASHBOARD CHART FORENSICS

## 1. Chart Inventory

Charts on Veloria Grand dashboards are built using Recharts / SVG visualizers.

---

## 2. Detailed Chart Inventory

### CHART-0501: Weekly Cash Flow Trend Chart
- **Screen**: `/dashboard` (Side Card under `finance` / `owner` lens)
- **Component**: `SideCard` / Recharts Bar Chart
- **Chart Type**: Bar Chart (Weekly daily breakdown)
- **X-Axis**: Days of current week (Mon - Sun)
- **Y-Axis**: Amount in INR (`₹`)
- **Data Query**: `bucketWeek()` aggregating daily completed payments from `prisma.payment`.

### CHART-0502: Weekly Revenue Booked Trend Chart
- **Screen**: `/dashboard` (Side Card under `sales` lens)
- **Component**: `SideCard` / Recharts Line Chart
- **Chart Type**: Line Chart
- **X-Axis**: Days of current week
- **Y-Axis**: Revenue in INR (`₹`)
- **Data Query**: `bucketWeek()` aggregating `booking.totalAmount` created per day.

### CHART-0503: Lead Attribution Source Pie Chart
- **Screen**: `/analytics`
- **Component**: Recharts Pie Chart
- **Dataset**: Lead counts aggregated by `lead.source` (Website, WhatsApp, Referral, Direct).
