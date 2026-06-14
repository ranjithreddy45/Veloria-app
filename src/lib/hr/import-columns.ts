// Columns the employee importer accepts (header names, case-insensitive,
// spaces/underscores ignored). Plain module (no "use server") so it can be
// imported by both the server action and the client importer component.
export const IMPORT_COLUMNS = [
  "firstName", "lastName", "workEmail", "personalEmail", "phone",
  "legalEntity", "businessVertical", "department", "designation",
  "employmentType", "dateOfJoining", "workLocation", "reportingManagerCode", "status",
] as const;
