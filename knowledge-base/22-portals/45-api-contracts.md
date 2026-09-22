# 45 API Contract Specifications Index

`CODE VERIFIED`

## Key API Specifications

### POST `/api/payments/create-order`
- **Request Body**: `{ "invoiceId": "inv_10928", "amount": 50000 }`
- **Response**: `{ "orderId": "order_Rz99812", "amount": 50000, "currency": "INR" }`

### POST `/api/webforms/[slug]`
- **Request Body**: `{ "name": "Rahul Verma", "email": "rahul@example.com", "phone": "+919876543210", "eventDate": "2026-11-15" }`
- **Response**: `{ "success": true, "leadId": "ld_77182" }`
