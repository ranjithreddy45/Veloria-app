# Lead Integrations

## Overview

Third-party service integrations connected to the Lead CRM module.

---

## Service Integrations

1. **Meta / Facebook Lead Ads**: Configured via `/settings/integrations/lead-capture` (`FacebookConfig` model) & `/api/webhooks/facebook-leads`.
2. **Google Ads**: UTM parameter parsing and campaign attribution via `GoogleConfig` & `LeadAttribution` model.
3. **WhatsApp Cloud API**: Auto-welcome templates and interactive catalog links via `WhatsAppConfig` & `WhatsAppCatalogSession`.
4. **OpenAI**: Automated lead score generation and sentiment analysis (`src/lib/ai/lead-scoring.ts`).
