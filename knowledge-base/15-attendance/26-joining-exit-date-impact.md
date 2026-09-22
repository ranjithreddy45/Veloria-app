# 26 Mid-Month Joining & Exit Impact

## Tax Annualization Impact

Mid-year joiners pass `taxMonthsInFy(emp.dateOfJoining, run.fy)` to `computePayslip` so annual TDS projections are annualized over actual months worked rather than a full 12 months.
