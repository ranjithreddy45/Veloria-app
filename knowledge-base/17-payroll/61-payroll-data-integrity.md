# 61 Database Integrity & Transaction Bounds

## Transaction Bounds

`computePayrollRun` and `postPayrollRun` run inside atomic Prisma transactions to prevent partial calculations or orphan GL entries.
