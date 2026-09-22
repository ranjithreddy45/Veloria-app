# Quotation Email & WhatsApp Dispatch

## Overview

Multi-channel proposal delivery using email templates (`src/lib/email-templates/quote-sent.ts`) and Meta WhatsApp Cloud API messages.

---

## Delivery Mechanisms

- **Email**: Dispatches HTML email containing proposal summary, PDF attachment link, and `/q/[token]` button.
- **WhatsApp**: Dispatches template message with interactive `/q/[token]` link and venue brochure catalog (`WhatsAppCatalogSession`).
