# Dynamic Route Patterns

## Overview

Dynamic routes use square bracket parameters (e.g. `[id]`, `[token]`) to capture URL parameters.

---

## Dynamic Parameter Catalog

| Pattern | Example URL | Purpose | Scoping / Validation |
|---|---|---|---|
| `[id]` | `/leads/lead_123` | Entity primary key lookup | Database ID lookup |
| `[quoteToken]` | `/q/tok_99182` | Public quotation viewer token | Token expiry & hash lookup |
| `[contractToken]`| `/sign/tok_7712` | Public e-sign contract token | Token verification |
| `[token]` | `/guest/rsvp/tok_112` | Guest invitation RSVP token | Invitation token match |
