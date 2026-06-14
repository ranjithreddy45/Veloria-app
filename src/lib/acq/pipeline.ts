// ============================================================
// Annual lease pipeline metric (BD audit O-8)
// ------------------------------------------------------------
// "Annual lease pipeline" used to sum minimumMonthlyGuarantee × 12 for every
// owner regardless of commercial model. Revenue-share and management-fee owners
// have no fixed monthly figure, so they silently contributed ₹0 — materially
// understating the real pipeline.
//
// The HallOwner schema only carries two money fields: `minimumMonthlyGuarantee`
// (Decimal) and `revenueSharePercent` (Decimal). There is NO projected/annual
// revenue or GMV base on the model, and no dedicated management-fee amount.
// Without a revenue base we cannot honestly annualize a revenue-share %, so we
// do NOT fabricate one. Instead, per model:
//   • FIXED_LEASE / HYBRID  → minimumMonthlyGuarantee × 12 (the lease/floor).
//   • REVENUE_SHARE         → if a minimum monthly guarantee (floor) is set,
//                             annualize that floor (× 12); otherwise the owner
//                             is not estimable → excluded from the headline sum
//                             and counted under `notAnnualized`.
//   • MANAGEMENT_FEE        → same rule: annualize the monthly guarantee floor
//                             if present, else exclude + count.
// `notAnnualized` is surfaced in the UI as "+N owners (not annualized)" so the
// metric is honest rather than silently understated.
//
// Plain lib (not a "use server" module) so it can export a sync helper.
// ============================================================

export type PipelineOwner = {
  contractStatus: string;
  commercialModel: string | null;
  minimumMonthlyGuarantee: number | string | null;
};

export function computeAnnualPipeline(owners: PipelineOwner[]): {
  total: number;
  notAnnualized: number;
} {
  let total = 0;
  let notAnnualized = 0;

  for (const o of owners) {
    if (o.contractStatus === "CHURNED") continue;

    // minimumMonthlyGuarantee is a Prisma Decimal — always Number() it.
    const monthlyFloor = Number(o.minimumMonthlyGuarantee ?? 0);
    const annualizedFloor = monthlyFloor * 12;

    switch (o.commercialModel) {
      case "FIXED_LEASE":
      case "HYBRID":
        // Lease / floor is the contractual annual contribution.
        total += annualizedFloor;
        break;
      case "REVENUE_SHARE":
      case "MANAGEMENT_FEE":
        // No revenue base on the model: annualize the guarantee floor if set,
        // otherwise this owner is not estimable — disclose, don't fake it.
        if (monthlyFloor > 0) total += annualizedFloor;
        else notAnnualized += 1;
        break;
      default:
        // Unknown / unset model: fall back to the floor if one exists.
        if (monthlyFloor > 0) total += annualizedFloor;
        break;
    }
  }

  return { total, notAnnualized };
}
