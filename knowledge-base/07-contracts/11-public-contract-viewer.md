# Public Contract Signature Portal

## Overview

Public e-signature portal (`/sign/[token]`) enabling clients to review contract text, view terms, and execute digital signatures without account login.

---

## Portal Components (`src/app/(public)/sign/[token]/`)

- `page.tsx`: Resolves token, verifies `expiresAt` and `isLocked` state.
- `sign-pad.tsx`: Interactive signature canvas pad supporting draw and type modes.
