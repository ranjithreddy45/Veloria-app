# 12 Delivery Status & Retries

`CODE VERIFIED`

- Inbound Webhook handles status updates from Meta (`statuses` array in payload).
- Updates `WhatsAppMessage.status`: `SENT` -> `DELIVERED` -> `READ` or `FAILED`.
- If status is `FAILED`, `failureReason` text is persisted.
