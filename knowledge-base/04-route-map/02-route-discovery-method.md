# Route Discovery Methodology

## Overview

This document outlines the exact, reproducible methodology used to discover, parse, normalize, and categorize every route endpoint in the Veloria Grand codebase.

---

## Discovery Process

1. **Recursive Filesystem Walk**: Scanned `src/app/**` for all instances of `page.tsx`, `page.ts`, `route.ts`, and `route.js`.
2. **Next.js App Router Normalization**:
   - Stripped route groups wrapped in parentheses (e.g. `(dashboard)`, `(auth)`).
   - Resolved dynamic parameters enclosed in brackets (e.g. `[id]`, `[quoteToken]`).
   - Mapped `src/app/page.tsx` to root URL `/`.
3. **Classification**: Segmented routes into 12 functional categories based on directory placement and access requirements.
4. **Endpoint Identification**: Assigned unique, immutable route identifiers (`ROUTE-0001` through `ROUTE-0593`) for machine-readable cross-referencing.

---

## Audit Reproducibility Command

```bash
python3 -c "
import os
app_dir = 'src/app'
pages = sum(1 for root, _, files in os.walk(app_dir) for f in files if f.startswith('page.'))
apis = sum(1 for root, _, files in os.walk(app_dir) for f in files if f.startswith('route.'))
print(f'Pages: {pages}, APIs: {apis}, Total: {pages + apis}')
"
```
