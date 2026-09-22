# 15 - BEO PDF & Print Document Generation

---

## 🖨️ Document Rendering Engine

- **PDF Renderer**: Renders BEO function sheets using `@react-pdf/renderer` or server-side HTML-to-PDF converters.
- **Print View (`/beo/[id]`)**: Standardized print layout optimized for A4 banquet office printouts and kitchen pass clipboards.
- **Cloud Storage**: Rendered PDF snapshots are stored in AWS S3 buckets (`BookingDocument` model) for permanent audit compliance.
