# 26 E-Invoicing & IRN Generation

## Implementation Status

- **Database Model**: `FinEInvoice` (`CODE VERIFIED`). Stores `irn`, `ackNo`, `ackDate`, `signedQrCode`, and `status`.
- **Adapter Engine**: `src/lib/finance/einvoice-adapter.ts` (`PARTIALLY IMPLEMENTED`). Provides mock sandbox IRN generation for testing.
- **Production Status**: `REQUIRES MANUAL VERIFICATION` for live NIC / IRP API credentials.
