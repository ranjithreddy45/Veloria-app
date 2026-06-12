// ============================================================
// Contract authoring — default agreement template + merge.
// Pure (no IO): used by the authoring UI to seed the editable body and by
// the PDF route to render the document. Merge fields fill from the contract.
// ============================================================

export interface ContractMergeData {
  ownerName: string;
  propertyName: string;
  model?: string | null;
  baseFeePct?: number | string | null;
  incentivePct?: number | string | null;
  termYears?: number | null;
  contractValue?: number | string | null;
}

function pctOrBlank(v: number | string | null | undefined): string {
  return v == null || v === "" ? "____%" : `${v}%`;
}

/**
 * A professional venue-management agreement, merged with the deal terms.
 * Returns plain text with numbered clauses; the editor and PDF both render it.
 */
export function defaultManagementAgreement(d: ContractMergeData): string {
  const base = pctOrBlank(d.baseFeePct);
  const inc = pctOrBlank(d.incentivePct);
  const term = d.termYears != null ? `${d.termYears} (${d.termYears}) years` : "____ years";

  return `VENUE MANAGEMENT AGREEMENT

This Venue Management Agreement ("Agreement") is made between Veloria Grand ("Manager") and ${d.ownerName} ("Owner"), in respect of the venue known as "${d.propertyName}" ("Venue").

1. APPOINTMENT
The Owner appoints the Manager to operate, market and manage the Venue on the terms set out in this Agreement, and the Manager accepts such appointment.

2. TERM
This Agreement is valid for a term of ${term} from the Effective Date, renewable by mutual written consent, unless terminated earlier under Clause 8.

3. MANAGEMENT FEE
The Manager shall be entitled to a Base Management Fee of ${base} of gross revenue and an Incentive Fee of ${inc} of the Gross Operating Profit, computed and payable monthly within seven (7) working days of the month-end statement.

4. OWNER OBLIGATIONS
The Owner shall: (a) provide clear, marketable title and undisputed possession of the Venue; (b) maintain the building structure and statutory safety; and (c) obtain and keep current all licenses and approvals required to operate the Venue.

5. MANAGER OBLIGATIONS
The Manager shall operate the Venue to Veloria Grand standards, manage bookings, staffing, catering coordination, housekeeping and marketing, and furnish the Owner with a monthly revenue and expense statement.

6. RENOVATION
Where the Manager reasonably recommends renovation to bring the Venue to brand standard, the scope, timeline and cost-sharing shall be agreed in writing before commencement.

7. EXCLUSIVITY
During the Term, the Owner shall not appoint any other operator or manager for the Venue, nor operate it independently in a manner that conflicts with this Agreement.

8. TERMINATION
Either party may terminate this Agreement on ninety (90) days' written notice. A material breach not cured within thirty (30) days of written notice entitles the non-defaulting party to terminate with immediate effect.

9. CONFIDENTIALITY
Each party shall keep confidential all commercial information disclosed under this Agreement and use it solely for the purposes hereof.

10. GOVERNING LAW & JURISDICTION
This Agreement is governed by the laws of India and subject to the exclusive jurisdiction of the courts at Bengaluru, Karnataka.

IN WITNESS WHEREOF, the parties have executed this Agreement as of the Effective Date.`;
}
