// Self-service mount of the Security page for every staff role. /settings/* is
// settings:read-gated in middleware, so the canonical page lives there for
// admins and is re-exported here (same component, same actions) for everyone
// else — including HR_MANAGER, one of the roles that must enrol.
export { default, metadata } from "@/app/(dashboard)/settings/security/page";
