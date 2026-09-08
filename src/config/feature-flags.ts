// ============================================================
// Feature flags — soft-disabled features kept in the codebase.
// ------------------------------------------------------------
// Flip a flag to bring a feature back: navigation, command palette and the
// route guards all read from here, so re-enabling is a one-line change.
// ============================================================

/**
 * The lead-ops sub-modules (Speed-to-Lead, SLA War-Room, Missed Calls,
 * Cooling Leads). Disabled 2026-09 on request — "may be needed later, not
 * right now". Pages 404, nav + palette entries hide; all code stays intact.
 * Background automations (SLA reminder crons) are unaffected.
 */
export const LEAD_OPS_PAGES_ENABLED = false;

/**
 * BD deal page — Projection and Contract tabs. Removed from the deal page
 * 2026-09 on request (the contract lifecycle lives in BD → Contracts; the
 * pre-contract checks moved into the Negotiation tab). Code stays intact.
 */
export const DEAL_PROJECTION_TAB_ENABLED = false;
export const DEAL_CONTRACT_TAB_ENABLED = false;
