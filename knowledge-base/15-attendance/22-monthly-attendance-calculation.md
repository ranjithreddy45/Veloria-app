# 22 Attendance Aggregation Algorithm

## Aggregation Formula

$$\text{lopDays} = \max(0, \text{workingDays} - \text{presentDays} - \text{leaveDays})$$

All values are rounded to 2 decimal places using `round2()`.
