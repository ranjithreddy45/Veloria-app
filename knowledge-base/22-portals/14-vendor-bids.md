# 14 Vendor Bid Submission & Quotations (`/vendor-portal/bids`)

`CODE VERIFIED`

## Bid Management Workflow (`VendorBid` Model)

- **RFPs / Tender Invitations**: Procurement posts a bidding request for specific event services (e.g. 500pax Floral Decor for Grand Ballroom).
- **Bid Submission**: Vendor inputs itemized pricing, inclusions, and terms via `/vendor-portal/bids`.
- **Bid Statuses**: `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `ACCEPTED`, `REJECTED`.
- **Selection**: Upon internal procurement approval (`acceptVendorBid()`), system automatically generates a binding `WorkOrder` and updates `VendorBid.status = 'ACCEPTED'`.
