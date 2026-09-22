# 20 - Operational Task Assignment & Staffing

---

## 👥 Staff Shift Allocation (`StaffAssignment` & `Shift`)

- **Shift Management**: Shift allocations (`Shift` model) assign staff members (`StaffProfile`) to operational roles (e.g. Lead Steward, Valet Lead, Bar Captain).
- **Check-in Tracking**: Staff status tracks `SCHEDULED` -> `CHECKED_IN` -> `COMPLETED` / `ABSENT` via timestamp logs.
- **Hourly Overtime**: Calculates `hoursWorked` and `overtimeHours` for automated payroll sync.
