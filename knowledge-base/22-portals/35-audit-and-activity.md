# 35 Audit Logging & Portal Trail

`CODE VERIFIED`

## Audit Trail Tracking

Every major portal event writes a permanent record to the system audit trail:
- `QuoteView`: Logs IP, User-Agent, and timestamp whenever `/q/[token]` is viewed.
- `SignatureRequest`: Logs IP, User-Agent, signature image URL, and timestamp upon signing.
- `Payment`: Logs Razorpay Order ID, Payment ID, Payment Method, and Webhook Payload.
- `VendorAssignment`: Logs confirmation timestamp and IP address.
