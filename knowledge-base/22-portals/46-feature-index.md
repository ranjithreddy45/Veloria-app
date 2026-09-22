# 46 Master Portal Feature Index

`CODE VERIFIED`

| Feature ID | Portal | Feature Name | Route | Primary Action | Data Model | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `POR-001` | Client Portal | Client Dashboard | `/portal` | `getClientDashboardData` | `Contact`, `Booking` | `IMPLEMENTED` |
| `POR-002` | Client Portal | Booking Control Center | `/portal/bookings/[id]`| `getPortalBookingDetails` | `Booking` | `IMPLEMENTED` |
| `POR-003` | Client Portal | Invoices & Receipts | `/portal/invoices` | `getClientInvoices` | `Invoice`, `Payment` | `IMPLEMENTED` |
| `POR-004` | Client Portal | Digital Contracts | `/portal/contracts` | `getClientContracts` | `Contract` | `IMPLEMENTED` |
| `POR-005` | Client Portal | Document Vault | `/portal/documents` | `getPortalDocuments` | `Document` | `IMPLEMENTED` |
| `POR-006` | Client Portal | Guest List & RSVP | `/portal/guests` | `managePortalGuestList` | `GuestList` | `IMPLEMENTED` |
| `POR-007` | Vendor Portal | Vendor Dashboard | `/vendor-portal` | `getVendorDashboardOverview`| `Vendor` | `IMPLEMENTED` |
| `POR-008` | Vendor Portal | Work Orders | `/vendor-portal/events` | `getVendorAssignedEvents` | `WorkOrder` | `IMPLEMENTED` |
| `POR-009` | Vendor Portal | RFP Bidding | `/vendor-portal/bids` | `submitVendorBid` | `VendorBid` | `IMPLEMENTED` |
| `POR-010` | Vendor Portal | Payouts & Bills | `/vendor-portal/payouts`| `getVendorPayoutHistory` | `VendorBill`, `Payout`| `IMPLEMENTED` |
