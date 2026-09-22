# 11 Attachments, Storage & Bill Access Controls

`CODE VERIFIED`

## Bill Attachment Storage Architecture

- Attachments stored in `HrClaimAttachment` table with `data` field holding object storage reference or base64 string.
- Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`.
- File names truncated to 180 chars (`f.fileName.slice(0, 180)`).
- **Approver Bill Access**: Level 1, Level 2, Level 3 (Finance), and Super Admins can view/download attachments via `getClaimAttachment(attachmentId)`.
