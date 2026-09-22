# 41 Attendance to Finance & GL Dependency

## Downstream Financial Impact

Attendance does not post to GL directly. LOP days reduce net salary in `HrPayrollRun`, which then posts salary expense GL entries (`5060`).
