# 05 Enums and State Machines

`SCHEMA VERIFIED`

## Implemented Enums
- `WhatsAppMessageStatus`: `SENT`, `DELIVERED`, `READ`, `FAILED`
- `CommunicationType`: `NOTE`, `CALL`, `EMAIL`, `SMS`, `MEETING`, `WHATSAPP`
- `CommunicationDirection`: `INBOUND`, `OUTBOUND`
- `EmailTrackingEventType`: `OPEN`, `CLICK`

## Outbound Message State Machine
```
Draft / Trigger -> SENT -> DELIVERED -> READ
                     |
                     +---> FAILED (stamps failureReason)
```
