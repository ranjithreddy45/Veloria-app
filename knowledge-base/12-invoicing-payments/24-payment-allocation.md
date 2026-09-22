# 24 - Payment Allocation Engine

---

## 📅 Milestone Installment Allocation (`allocatePaidAmountToInstallments`)

When an invoice receives a payment, `allocatePaidAmountToInstallments()` distributes cumulative `paidAmount` across linked `Installment` rows:
- **Order**: Sorted oldest due date first (`orderBy: { dueDate: "asc" }`).
- **Full Coverage**: Installments covered by `paidAmount` flip to `status = COMPLETED`.
- **Partial Coverage**: Remaining installments stay `PENDING`.
