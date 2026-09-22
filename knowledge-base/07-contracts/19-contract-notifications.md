# Contract Notifications & Alerts

## Overview

Automated notifications dispatched upon contract creation, signature link delivery, view events, and completion.

---

## Notification Triggers

- **Signature Request Sent**: Client receives email & WhatsApp with `/sign/[token]` link.
- **Contract Viewed**: In-app alert notifies Sales Exec when client opens signature portal (`SignatureRequestStatus.VIEWED`).
- **Contract Signed**: Instant alert to Sales Exec, Legal, and Operations upon completion (`SIGNED`).
