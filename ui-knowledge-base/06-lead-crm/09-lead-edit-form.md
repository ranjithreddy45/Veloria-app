# LEAD EDIT FORM FORENSICS (`FORM-0602`)

## 1. Form Mode Logic

The edit form reusing [lead-form.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/leads/_components/lead-form.tsx) operates in `"edit"` mode.

- **Route**: `/leads/[leadId]/edit`
- **Initial Values**: Pre-filled from Prisma query via Server Component `getLead(leadId)`.
- **Submission Action**: `updateLead(leadId, formData)`
- **Success Redirect**: Returns to `/leads/[leadId]` with Sonner toast notification `"Lead updated successfully"`.
