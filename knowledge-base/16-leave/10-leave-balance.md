# 10 Leave Balance Calculation & Equations

## Balance Equations

$$\text{Available Balance} = \text{entitled} + \text{carriedForward} - \text{used} - \text{pending}$$

- On `applyLeave`: `pending` increases by requested days.
- On `decideLeave` (APPROVED): `pending` decreases, `used` increases by requested days.
- On `decideLeave` (REJECTED): `pending` decreases by requested days.
