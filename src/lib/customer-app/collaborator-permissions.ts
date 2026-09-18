// ============================================================
// Shared bookings: who may do what — ONE pure rule.
//
// A host can share one booking with family or a planner. Each share is a
// BookingCollaborator row (role CO_HOST | VIEWER, status INVITED | ACTIVE |
// REVOKED). getHostScope() reports the ACTIVE rows bound to the signed-in login
// as `collaboratorRoles`; a booking absent from that map is the customer's own.
// Every customer-app feature asks this module what the caller may do:
//
//   The booking's own customer    everything
//   CO_HOST (ACTIVE)              view the event, run of show, checklist, guest
//                                 list and live screen; manage the guest list;
//                                 add and tick their own checklist to-dos;
//                                 send concierge messages
//   VIEWER (ACTIVE)               view those same screens only
//   Collaborators NEVER           see payments, invoices, receipts, documents,
//                                 contracts or quotations; request packages or
//                                 menus; place holds; rate or review; use
//                                 rewards; see or manage co-hosts
//   INVITED / REVOKED / unknown   nothing (fail closed)
//   Team preview                  every view, no writes
//
// Only the booking's own customer invites or revokes co-hosts.
//
// Plain module: no "use server", no imports. Safe in client components (to
// hide what a role can't use) and in server actions (to refuse it). The server
// check is the one that counts.
// ============================================================

export const COLLABORATOR_ROLES = ["CO_HOST", "VIEWER"] as const;
export type CollaboratorRole = (typeof COLLABORATOR_ROLES)[number];

export const COLLABORATOR_STATUSES = ["INVITED", "ACTIVE", "REVOKED"] as const;
export type CollaboratorStatus = (typeof COLLABORATOR_STATUSES)[number];

/** Screens both roles may view. */
export const COLLABORATOR_VIEW_ACTIONS = ["event:view", "runOfShow:view", "checklist:view", "guests:view", "live:view"] as const;

/** What a co-host may change, on top of viewing. */
export const CO_HOST_ACTIONS = ["guests:manage", "todos:manage", "concierge:message"] as const;

/** The booking's own customer only — never a collaborator, whatever their role. */
export const OWNER_ONLY_ACTIONS = [
  "payments:view",
  "invoices:view",
  "receipts:view",
  "documents:view",
  "contracts:view",
  "quotations:view",
  "packages:request",
  "menu:request",
  "holds:place",
  "reviews:submit",
  "rewards:use",
  "collaborators:view",
  "collaborators:manage",
] as const;

export const BOOKING_ACTIONS = [...COLLABORATOR_VIEW_ACTIONS, ...CO_HOST_ACTIONS, ...OWNER_ONLY_ACTIONS] as const;
export type BookingAction = (typeof BOOKING_ACTIONS)[number];

const VIEW_SET: ReadonlySet<string> = new Set(COLLABORATOR_VIEW_ACTIONS);
const CO_HOST_SET: ReadonlySet<string> = new Set(CO_HOST_ACTIONS);

export function isCollaboratorRole(value: unknown): value is CollaboratorRole {
  return typeof value === "string" && (COLLABORATOR_ROLES as readonly string[]).includes(value);
}

export function isCollaboratorStatus(value: unknown): value is CollaboratorStatus {
  return typeof value === "string" && (COLLABORATOR_STATUSES as readonly string[]).includes(value);
}

/**
 * May an ACTIVE collaborator with this role do this? Use it with
 * getHostScope().collaboratorRoles, which only ever lists ACTIVE rows.
 * Roles are matched exactly; anything unrecognised is refused.
 */
export function canCollaborator(role: string | null | undefined, action: BookingAction): boolean {
  if (role === "CO_HOST") return VIEW_SET.has(action) || CO_HOST_SET.has(action);
  if (role === "VIEWER") return VIEW_SET.has(action);
  return false;
}

/** Everything a BookingCollaborator row allows, from its role and status. Only ACTIVE grants anything. */
export function collaboratorActions(role: string | null | undefined, status: string | null | undefined): BookingAction[] {
  if (status !== "ACTIVE") return [];
  return BOOKING_ACTIONS.filter((a) => canCollaborator(role, a));
}

export type BookingAccess =
  | { kind: "OWNER" }
  | { kind: "PREVIEW" }
  | { kind: "COLLABORATOR"; role: string | null | undefined; status: string | null | undefined };

/** Everything the caller may do on one booking, whoever they are to it. */
export function bookingAccessActions(access: BookingAccess | null | undefined): BookingAction[] {
  if (!access) return [];
  if (access.kind === "OWNER") return [...BOOKING_ACTIONS];
  if (access.kind === "PREVIEW") return BOOKING_ACTIONS.filter((a) => a.endsWith(":view"));
  if (access.kind === "COLLABORATOR") return collaboratorActions(access.role, access.status);
  return [];
}

export function canDo(actions: readonly string[] | null | undefined, action: BookingAction): boolean {
  return !!actions && actions.includes(action);
}

/**
 * The same rule over a getHostScope() result. The booking must be in the
 * scope; then a preview may only view, a booking in `collaboratorRoles` follows
 * its role, and any other booking in scope is the customer's own.
 */
export function hostScopeCan(
  scope:
    | {
        preview?: boolean;
        booking?: { id: string } | null;
        bookings?: readonly { id: string }[];
        collaboratorRoles?: Readonly<Record<string, string>>;
      }
    | null
    | undefined,
  bookingId: string,
  action: BookingAction
): boolean {
  if (!scope || !bookingId) return false;
  const inScope = scope.booking?.id === bookingId || !!scope.bookings?.some((b) => b.id === bookingId);
  if (!inScope) return false;
  if (scope.preview) return action.endsWith(":view");
  const role = scope.collaboratorRoles?.[bookingId];
  return role === undefined ? true : canCollaborator(role, action);
}

/**
 * What each role can do, in the host's words — shown where they choose a role.
 * The role's name itself comes from COLLABORATOR_ROLE_LABEL in status-labels.ts.
 */
export const COLLABORATOR_ROLE_DESCRIPTION: Record<CollaboratorRole, string> = {
  CO_HOST:
    "Can see the event, run of show, checklist and guest list, add and invite guests, add their own to-dos and message your coordinator. Payments and documents stay private to you.",
  VIEWER:
    "Can see the event, run of show, checklist and guest list, but can't change anything. Payments and documents stay private to you.",
};
