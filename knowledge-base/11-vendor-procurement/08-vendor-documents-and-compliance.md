# 08 - Vendor Documents & Compliance

---

## 📄 Compliance Document Management

Vendor compliance and identity documents are stored as structured JSON blobs in `prisma.vendor.documents`:

```json
{
  "gstCertificate": "https://s3.amazonaws.com/veloria-docs/vendors/v123/gst.pdf",
  "panCard": "https://s3.amazonaws.com/veloria-docs/vendors/v123/pan.pdf",
  "fssaiLicense": "https://s3.amazonaws.com/veloria-docs/vendors/v123/fssai.pdf",
  "bankProof": "https://s3.amazonaws.com/veloria-docs/vendors/v123/cheque.pdf"
}
```

---

## 🔐 Tax & Legal Information

- **GSTIN**: 15-character GST identification number validated via `vendorSchema` (`z.string().max(15)`).
- **Bank Details**: Stored in `prisma.vendor.bankDetails` (`accountNumber`, `accountName`, `ifscCode`, `bankName`). Used for payout generation.
