# 32 - Booking Documents & PDF Generation

---

## 📄 Document Generation & Storage

- **PDF Documents**:
  - BEO Function Sheets: Rendered dynamically via PDF export components (`@react-pdf/renderer`) for printing and kitchen handoff.
  - Tax Invoices: Rendered via PDF actions and accessible via `/api/guest/invoice/[invoiceId]`.
  - Payment Receipts: Downloadable via `/api/guest/receipt/[paymentId]`.
- **Cloud Storage**: Signed PDFs and attached layout floorplans are stored on S3 / Cloud Storage buckets (`BookingDocument` model).
