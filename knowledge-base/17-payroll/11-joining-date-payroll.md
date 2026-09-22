# 11 Mid-Month Joining Salary Calculation

## Joining Date Math

For employees joining mid-year, TDS annualization passes `taxMonthsInYear = taxMonthsInFy(emp.dateOfJoining, run.fy)` to `computePayslip`, preventing tax over-projection.
