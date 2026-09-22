# 28 Data Flows

`CODE VERIFIED`

```mermaid
flowchart TD
    AdClick[Ad Click / Campaign] --> LandingPage[Landing Page / Form]
    LandingPage --> CaptureAPI[captureLeadFromExternal API]
    CaptureAPI --> LeadDB[(Lead & LeadAttribution DB)]
    CaptureAPI --> ConsentDB[(PrivacyConsentLedger DB)]
    CaptureAPI --> WhatsAppMsg[WhatsApp Welcome Message]
    LeadDB --> SalesPipeline[Sales Qualification & Quotation]
    SalesPipeline --> WonBooking[Won Booking & Finance GL]
    WonBooking --> AttributionRollup[Attribution Rollup Cron]
    AttributionRollup --> ROASReport[ROAS & CAC Analytics]
```
