# 09 Marketing to CRM Handoff

`CODE VERIFIED`

```
Marketing Touchpoint (Ad Click / Webform / Referral)
  |
  +---> captureLeadFromExternal()
           |
           +---> 1. Contact Deduplication (find or create Contact)
           +---> 2. DPDP Privacy Consent (recordConsent)
           +---> 3. Attribution Linkage (attachAttributionToLead -> LeadAttribution & MarketingCampaign)
           +---> 4. AI Lead Scoring (calculateLeadScore)
           +---> 5. Auto-Assignment (evaluateAssignmentRules)
           +---> 6. SLA Setup (leadSlaDeadline)
           +---> 7. Auto Welcome (sendWhatsApp)
           |
           v
       Lead CRM (Status: NEW / UNASSIGNED -> Sales Pipeline)
```
