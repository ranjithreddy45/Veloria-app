# 21 - Vendor Event Execution

---

## 🎭 Event Execution Coordination

During live event execution, vendor performance is monitored via:
1. **Setup Verification**: `arrivalTime` and `setupTime` tracked on operational control dashboards (`/bookings/[bookingId]/control`).
2. **Execution Tasks**: `ExecutionTask` rows assigned to vendor categories (e.g. `DECOR`, `AV`, `CATERING`).
3. **Incident Reporting**: BEO incidents (`BeoIncident`) logged against vendor SLA failures with photo proof support.
