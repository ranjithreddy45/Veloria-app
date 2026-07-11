// ============================================================
// Indian-GAAP Chart of Accounts seed for a banquet/events business.
// code ranges: 1xxx assets · 2xxx liabilities · 3xxx equity ·
// 4xxx income · 5xxx expense. Control accounts flagged.
// ============================================================

export interface CoaSeed {
  code: string;
  name: string;
  type: "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";
  subtype?: string;
  isControl?: boolean;
  taxDefault?: string;
}

export const COA_TEMPLATE: CoaSeed[] = [
  // Assets
  { code: "1010", name: "Cash in Hand", type: "ASSET", subtype: "Cash" },
  { code: "1020", name: "Bank — Current Account", type: "ASSET", subtype: "Bank" },
  { code: "1100", name: "Accounts Receivable (Debtors)", type: "ASSET", subtype: "Receivable", isControl: true },
  { code: "1200", name: "GST Input Credit", type: "ASSET", subtype: "Tax" },
  { code: "1210", name: "TDS Receivable", type: "ASSET", subtype: "Tax" },
  { code: "1300", name: "Advances to Vendors", type: "ASSET", subtype: "Advance" },
  { code: "1310", name: "Advances / Loans to Employees", type: "ASSET", subtype: "Advance" },
  { code: "1500", name: "Fixed Assets — Venue Fit-out", type: "ASSET", subtype: "FixedAsset" },
  { code: "1590", name: "Accumulated Depreciation", type: "ASSET", subtype: "ContraAsset" },
  // Liabilities
  { code: "2010", name: "Accounts Payable (Creditors)", type: "LIABILITY", subtype: "Payable", isControl: true },
  { code: "2100", name: "GST Output Payable", type: "LIABILITY", subtype: "Tax" },
  { code: "2110", name: "TDS Payable", type: "LIABILITY", subtype: "Tax" },
  { code: "2120", name: "TCS Payable", type: "LIABILITY", subtype: "Tax" },
  { code: "2200", name: "PF Payable", type: "LIABILITY", subtype: "Payroll" },
  { code: "2210", name: "ESI Payable", type: "LIABILITY", subtype: "Payroll" },
  { code: "2220", name: "Professional Tax Payable", type: "LIABILITY", subtype: "Payroll" },
  { code: "2230", name: "Salaries Payable", type: "LIABILITY", subtype: "Payroll" },
  { code: "2300", name: "Customer Advances / Booking Deposits", type: "LIABILITY", subtype: "Advance", isControl: true },
  { code: "2400", name: "Owner Payouts Payable", type: "LIABILITY", subtype: "Payable" },
  // Equity
  { code: "3010", name: "Share Capital", type: "EQUITY", subtype: "Capital" },
  { code: "3100", name: "Retained Earnings", type: "EQUITY", subtype: "Reserve" },
  { code: "3900", name: "Opening Balance Equity", type: "EQUITY", subtype: "Suspense" },
  // Income
  { code: "4010", name: "Venue Rental Revenue", type: "INCOME", subtype: "Operating", taxDefault: "GST18" },
  { code: "4020", name: "Management Fee Income", type: "INCOME", subtype: "Operating", taxDefault: "GST18" },
  { code: "4030", name: "Catering Commission Income", type: "INCOME", subtype: "Operating", taxDefault: "GST18" },
  { code: "4040", name: "Décor Commission Income", type: "INCOME", subtype: "Operating", taxDefault: "GST18" },
  { code: "4050", name: "Add-on / Misc Event Income", type: "INCOME", subtype: "Operating", taxDefault: "GST18" },
  { code: "4900", name: "Other Income", type: "INCOME", subtype: "NonOperating" },
  // Expense
  { code: "5010", name: "Catering Cost", type: "EXPENSE", subtype: "DirectEvent" },
  { code: "5020", name: "Décor Cost", type: "EXPENSE", subtype: "DirectEvent" },
  { code: "5030", name: "Event Staffing Cost", type: "EXPENSE", subtype: "DirectEvent" },
  { code: "5040", name: "Entertainment / AV Cost", type: "EXPENSE", subtype: "DirectEvent" },
  { code: "5100", name: "Salaries & Wages", type: "EXPENSE", subtype: "Payroll" },
  { code: "5110", name: "Employer PF/ESI Contribution", type: "EXPENSE", subtype: "Payroll" },
  { code: "5200", name: "Rent", type: "EXPENSE", subtype: "Overhead" },
  { code: "5210", name: "Utilities (Power/Water)", type: "EXPENSE", subtype: "Overhead" },
  { code: "5220", name: "Repairs & Maintenance", type: "EXPENSE", subtype: "Overhead" },
  { code: "5230", name: "Supplies & Consumables (Procurement)", type: "EXPENSE", subtype: "Overhead" },
  { code: "5300", name: "Marketing & Advertising", type: "EXPENSE", subtype: "Overhead" },
  { code: "5400", name: "Bank Charges", type: "EXPENSE", subtype: "Finance" },
  { code: "5500", name: "Depreciation", type: "EXPENSE", subtype: "NonCash" },
  { code: "5900", name: "Miscellaneous Expense", type: "EXPENSE", subtype: "Overhead" },
];

// Common posting accounts referenced by sub-ledgers (by code).
export const FIN_ACCOUNT_CODES = {
  cash: "1010", bank: "1020", debtors: "1100", gstInput: "1200", tdsReceivable: "1210",
  creditors: "2010", gstOutput: "2100", tdsPayable: "2110", customerAdvances: "2300",
  ownerPayouts: "2400", salariesPayable: "2230", pfPayable: "2200", esiPayable: "2210",
  ptPayable: "2220", retained: "3100", openingEquity: "3900",
  venueRental: "4010", managementFee: "4020", cateringCommission: "4030", decorCommission: "4040",
  salaries: "5100", bankCharges: "5400", depreciation: "5500", procurementExpense: "5230",
} as const;
