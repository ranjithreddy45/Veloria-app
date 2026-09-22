# 09 Fuel Reimbursement & 50L Monthly Cap Audit

`CODE VERIFIED`

## Forensic Audit: 50 Liters Monthly Fuel Cap

The codebase contains an explicit, hardcoded monthly fuel cap check in `src/actions/hr-reimbursement.actions.ts`:

```typescript
if (category === "FUEL") {
  if (!input.fuelLiters || input.fuelLiters <= 0) {
    return { success: false, error: "Liters are required for fuel claims." };
  }

  const startOfMonth = new Date(claimDate.getFullYear(), claimDate.getMonth(), 1);
  const endOfMonth = new Date(claimDate.getFullYear(), claimDate.getMonth() + 1, 0, 23, 59, 59, 999);

  const existingFuelClaims = await prisma.hrReimbursementClaim.aggregate({
    _sum: { fuelLiters: true },
    where: {
      employeeId,
      category: "FUEL",
      status: { notIn: ["REJECTED", "WITHDRAWN"] },
      claimDate: { gte: startOfMonth, lte: endOfMonth },
    },
  });

  const currentSum = Number(existingFuelClaims._sum.fuelLiters || 0);
  const newLiters = Number(input.fuelLiters);

  if (currentSum + newLiters > 50) {
    return {
      success: false,
      error: `Monthly fuel limit of 50 liters exceeded. You have already claimed ${currentSum} liters this month.`,
    };
  }

  fuelLiters = new Prisma.Decimal(newLiters.toFixed(2));
}
```

### Finding
- **Status**: `IMPLEMENTED`
- **Scope**: Applied per employee per calendar month (`claimDate`). Excludes `REJECTED` and `WITHDRAWN` claims from cumulative count.
