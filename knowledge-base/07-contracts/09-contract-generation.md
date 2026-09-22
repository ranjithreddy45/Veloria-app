# Document Generation & PDF Export

## Overview

PDF document generation pipeline (`/api/bd/contracts/[id]/pdf/route.ts`) rendering downloadable PDF agreements.

---

## Technical Pipeline

- **Endpoint**: `GET /api/bd/contracts/[id]/pdf`.
- **Render Engine**: Renders HTML document body with CSS print styling and streams PDF response to browser.
