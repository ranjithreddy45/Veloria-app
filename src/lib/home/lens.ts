// ============================================================
// Which home a role lands on.
//
// A lens only decides what the home screen ASKS for and how it words things.
// It never grants access: every data block is separately gated in
// home.actions on the permission its own module already requires, so a role
// mapped to a lens it only partly fits simply gets fewer tiles.
// Pure: no database, no session.
// ============================================================

export type HomeLens = "owner" | "sales" | "ops" | "finance" | "staff";

const LENS_BY_ROLE: Record<string, HomeLens> = {
  SUPER_ADMIN: "owner",
  ADMIN: "owner",

  SALES_EXEC: "sales",
  SALES_HEAD: "sales",

  // Everyone who runs events on the day: coordinators, the ops desk, the ops
  // head and the property manager all start from "what is happening in the
  // halls today and tomorrow".
  EVENT_COORDINATOR: "ops",
  OPERATIONS: "ops",
  OPERATIONS_HEAD: "ops",
  PROPERTY_MANAGER: "ops",

  FINANCE: "finance",

  // AUDITOR reads the finance module but holds neither invoices:read nor
  // payments:read, so the finance lens would render empty for them. They, and
  // every team whose work lives in its own module (BD, Projects, Design,
  // Legal, Marketing, HR), get the general lens: their own tasks plus whatever
  // else their permissions allow.
};

/** The home lens for a role. Unknown and unlisted roles get the general lens. */
export function resolveLens(role: string | null | undefined): HomeLens {
  return (role && LENS_BY_ROLE[role]) || "staff";
}

/**
 * Whether lead / quote / hold figures are the whole team's or only the
 * signed-in rep's. Same rule as getSalesFollowupQueue (lead.actions): admins
 * and the sales head see the team, a rep sees their own.
 */
export function seesWholeTeam(role: string | null | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "ADMIN" || role === "SALES_HEAD";
}

export const LENS_LABEL: Record<HomeLens, string> = {
  owner: "Business overview",
  sales: "Sales",
  ops: "Events and kitchen",
  finance: "Finance",
  staff: "My work",
};
