# 27 Failure Modes and Resiliency

`CODE VERIFIED`

- Webhook Retries: `externalId` deduplication prevents duplicate lead creation on webhook retries.
- Unhandled Exception Isolation: `after()` background execution ensures lead capture succeeds even if enrichment tail fails.
