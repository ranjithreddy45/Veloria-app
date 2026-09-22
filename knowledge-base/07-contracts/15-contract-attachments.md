# Contract Attachments & Scanned Documents

## Overview

Storage and management of scanned physical contracts (`AcqContract.signedContractUrl`) and PDF attachments.

---

## Attachment Handling

- **`AcqContract.signedContractUrl`**: Base64 or cloud URL storing uploaded manual contract scans.
- **`signedUploadedById`**: Foreign key tracking staff member who uploaded manual physical contract scan.
