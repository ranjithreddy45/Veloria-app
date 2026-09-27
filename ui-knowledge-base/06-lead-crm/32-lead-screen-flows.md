# LEAD SCREEN FLOWS

## 1. End-to-End User Flow (`FLOW-0601`: Enquiry to Quote)
1. Sales Rep opens `/leads` and sees new SLA-alerted lead.
2. Clicks lead row navigating to `/leads/[leadId]`.
3. Reviews AI score card & clicks `"Schedule Site Visit"`.
4. Conducts visit, updates status to `QUALIFIED`.
5. Clicks `"Create Quotation"` on `LeadQuickActions`.
6. System opens `/quotations/new` pre-filled with lead parameters.
