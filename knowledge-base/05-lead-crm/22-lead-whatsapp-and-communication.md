# WhatsApp & Communication Integration

## Overview

Meta WhatsApp Cloud API integration for automated welcome messages, catalog sharing, and direct messaging.

---

## Key Mechanisms

- **Auto-Welcome Config**: Configured via `/settings/integrations/lead-capture` (`AutoWelcomeConfig` model).
- **Template Messaging**: Automated WhatsApp message dispatched upon lead capture.
- **WhatsApp Catalog Session**: `WhatsAppCatalogSession` model tracks interactive venue brochure views by clients.
