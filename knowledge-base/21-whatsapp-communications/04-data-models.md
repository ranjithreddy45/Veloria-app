# 04 Data Model Inventory

`SCHEMA VERIFIED`

## Core Models in `prisma/schema.prisma`
1. `WhatsAppConfig`: `id`, `provider` ("META" | "WEFLUX"), `accessToken`, `phoneNumberId`, `businessAccountId`, `appSecret`, `verifyToken`, `apiEndpoint`, `isActive`, `createdAt`, `updatedAt`.
2. `WhatsAppMessage`: `id`, `contactId`, `direction` (`INBOUND` | `OUTBOUND`), `content`, `templateName`, `status` (`SENT`, `DELIVERED`, `READ`, `FAILED`), `whatsappId`, `failureReason`, `sentAt`.
3. `WhatsAppInboundEvent`: `id`, `provider`, `rawBody`, `headers`, `url`, `signatureValid`, `parsedOk`, `parseError`, `summary`, `createdAt`, `updatedAt`.
4. `Communication`: `id`, `contactId`, `bookingId`, `type` (`NOTE`, `CALL`, `EMAIL`, `SMS`, `MEETING`, `WHATSAPP`), `direction`, `subject`, `content`, `metadata`, `sentiment`, `sentimentScore`, `sentimentAt`, `createdById`, `createdAt`.
5. `EmailTemplate`: `id`, `name`, `subject`, `htmlContent`, `category`, `isActive`, `createdAt`, `updatedAt`.
6. `EmailTrackingPixel`: `id`, `communicationId`, `createdAt`.
7. `EmailTrackingEvent`: `id`, `pixelId`, `type` (`OPEN` | `CLICK`), `url`, `ip`, `userAgent`, `createdAt`.
8. `CallLog`: `id`, `communicationId`, `durationSeconds`, `disposition`, `recordingUrl`.
9. `PrivacyConsentLedger`: `id`, `subjectType` (`CONTACT` | `CANDIDATE` | `GUEST`), `subjectId`, `email`, `phone`, `purpose`, `source`, `consentText`, `givenAt`.
