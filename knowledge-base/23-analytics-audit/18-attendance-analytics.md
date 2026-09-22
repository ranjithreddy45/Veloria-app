# 18 Attendance & Time Tracking Analytics

`CODE VERIFIED`

## Muster Roll & Attendance Metrics (`src/actions/hr-report-attendance.actions.ts`)

- **Monthly Muster Sheet**: Detailed day-by-day matrix (`P`, `A`, `HD`, `WO`, `HO`, `PL`, `SL`, `LOP`).
- **Late Check-in / Early Exit Count**: Identifies employees breaching shift time buffers.
- **Attendance Rate %**: `(Total Present Days / Total Payable Working Days) * 100`.
- **Regularization Rate**: Track frequency of manual attendance correction requests.
