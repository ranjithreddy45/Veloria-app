# Contract Email & WhatsApp Messaging

## Overview

Multi-channel agreement delivery using email templates (`src/lib/email-templates/contract-sent.ts`) and Meta WhatsApp Cloud API.

---

## Messaging Mechanics

- **Email Template**: Sends HTML email containing event summary and call-to-action button linking to `/sign/[token]`.
- **WhatsApp Dispatch**: Dispatches automated template message with direct signing link.
