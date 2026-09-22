# Contract Integrations

## Overview

Third-party service integrations connected to the Contracts module.

---

## Integrations

1. **Meta WhatsApp Cloud API**: Delivers tokenized contract signing links (`/sign/[token]`).
2. **Resend Email API**: Sends HTML contract delivery emails (`src/lib/email-templates/contract-sent.ts`).
3. **Puppeteer / PDF Engine**: Generates server-side PDF agreement documents (`/api/bd/contracts/[id]/pdf`).
