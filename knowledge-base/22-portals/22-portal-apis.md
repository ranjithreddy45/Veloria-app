# 22 Portal API Endpoints Inventory

`CODE VERIFIED`

## Complete Inventory of Portal-Facing API Routes

| Endpoint | Method | Auth Level | Data Scope / Inputs | Target Resource | Output |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/payments/create-order` | POST | Token / Public | `{ invoiceId, amount }` | Razorpay Order API | `{ orderId, amount, currency }` |
| `/api/payments/verify` | POST | Token / Public | `{ razorpayOrderId, paymentId, signature }` | `Payment` Table | `{ status: 'SUCCESS', paymentId }` |
| `/api/payments/webhook` | POST | Webhook Signature | Razorpay Signature Header | `Payment`, `Invoice` | `HTTP 200 OK` |
| `/api/guest/invoice/[id]` | GET | NextAuth / Token | `invoiceId` | `Invoice` PDF | PDF Stream |
| `/api/guest/calendar/[id]` | GET | Public Token | `bookingId` | iCal Feed | `.ics` Calendar File |
| `/api/webforms/[slug]` | POST | Rate Limited | Form JSON Payload | `Lead`, `Contact` | `{ success: true, leadId }` |
| `/api/widget/inquiry` | POST | CORS Allowed | Inquiry Details | `Lead` | `{ success: true }` |
| `/api/documents/[id]` | GET | NextAuth / Token | `documentId` | AWS S3 Bucket | Presigned S3 Redirect URL |
