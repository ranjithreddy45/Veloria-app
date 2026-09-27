# LEAD CREATE FORM FORENSICS (`FORM-0601`)

## 1. Form Specifications

Implemented in [lead-form.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/leads/_components/lead-form.tsx).

- **Form ID**: `FORM-0601`
- **Route**: `/leads/new`
- **Validation Schema**: `leadSchema` ([lead.schema.ts](file:///Users/fci/Documents/Veloria-app/src/schemas/lead.schema.ts))
- **Submission Server Action**: `createLead(formData)`

---

## 2. Field Groups & Layout

1. **Contact Information Group**: Name (required), Email, Phone (required).
2. **Event Details Group**: Event Type (Wedding, Reception, Corporate, etc.), Event Date, Guest Count, Estimated Budget.
3. **Venue & Channel Group**: Preferred Venue Hall, Lead Source (Website, Referral, WhatsApp, Walk-in), Notes.
