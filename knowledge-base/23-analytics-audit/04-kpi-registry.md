# 04 Master KPI Registry

`CODE VERIFIED`

## Key Performance Indicators Registry (`KPI-001` to `KPI-040`)

| KPI ID | KPI Name | Domain | Primary Source Model | Calculation Formula | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `KPI-001` | **Gross Revenue** | Finance | `Invoice` | `SUM(Invoice.totalAmount WHERE status != CANCELLED)` | `SOURCE VERIFIED` |
| `KPI-002` | **Accounts Receivable (AR)**| Finance | `Invoice` | `SUM(Invoice.totalAmount - Invoice.amountPaid WHERE status = UNPAID/PARTIAL)` | `SOURCE VERIFIED` |
| `KPI-003` | **Accounts Payable (AP)** | Finance | `VendorBill` | `SUM(VendorBill.totalAmount - VendorBill.amountPaid WHERE status = APPROVED)` | `SOURCE VERIFIED` |
| `KPI-004` | **Booked Event Revenue** | Sales | `Booking` | `SUM(Booking.totalAmount WHERE status IN [CONFIRMED, COMPLETED])` | `SOURCE VERIFIED` |
| `KPI-005` | **Lead Conversion Rate** | Sales | `Lead`, `Booking` | `(Count(Bookings) / Count(Leads)) * 100` | `CALCULATION VERIFIED` |
| `KPI-006` | **Sales SLA Compliance %** | Sales | `Lead` | `(Count(Leads contacted <= SLA) / Count(Leads)) * 100` | `CALCULATION VERIFIED` |
| `KPI-007` | **Return on Ad Spend (ROAS)**| Marketing | `MarketingCampaign`, `Booking` | `SUM(BookedRevenue) / SUM(CampaignSpend)` | `CALCULATION VERIFIED` |
| `KPI-008` | **Cost Per Lead (CPL)** | Marketing | `MarketingCampaign`, `Lead` | `SUM(CampaignSpend) / Count(LeadsAttributed)` | `CALCULATION VERIFIED` |
| `KPI-009` | **Customer Acquisition Cost**| Marketing | `MarketingCampaign`, `Booking` | `SUM(CampaignSpend) / Count(BookingsAttributed)` | `CALCULATION VERIFIED` |
| `KPI-010` | **Total Active Headcount** | HR | `Employee` | `Count(Employee WHERE status = ACTIVE)` | `SOURCE VERIFIED` |
| `KPI-011` | **Monthly Attrition Rate** | HR | `Employee` | `(ExitedEmployeesInMonth / AverageHeadcount) * 100` | `CALCULATION VERIFIED` |
| `KPI-012` | **Monthly Attendance %** | Attendance | `AttendanceRecord` | `(PresentDays / TotalWorkingDays) * 100` | `CALCULATION VERIFIED` |
| `KPI-013` | **Gross Monthly Payroll Cost**| Payroll | `HrPayrollRun` | `SUM(HrPayrollRun.totalGross)` | `SOURCE VERIFIED` |
| `KPI-014` | **Statutory PF Liability** | Payroll | `HrPayslip` | `SUM(HrPayslip.pfEmployee + HrPayslip.pfEmployer)` | `SOURCE VERIFIED` |
| `KPI-015` | **Venue Occupancy Rate %** | Operations | `Booking`, `BlackoutDate` | `(BookedDays / AvailableDaysInMonth) * 100` | `CALCULATION VERIFIED` |
