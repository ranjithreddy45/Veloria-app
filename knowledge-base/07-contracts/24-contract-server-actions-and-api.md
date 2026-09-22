# Server Actions & API Inventory

## Overview

Complete reference for backend Server Actions and API endpoints powering the contract module.

---

## Server Actions (`src/actions/`)

- `createContract()` (`contract.actions.ts`): Creates a new contract record and replaces template placeholders.
- `sendSignatureRequest()` (`contract.actions.ts`): Generates `/sign/[token]` share link and dispatches email/WhatsApp.
- `submitSignature()` (`contract.actions.ts` & `src/lib/esign.ts`): Captures signature image/text, logs IP/UA, and locks document (`isLocked = true`).
- `createAcqContract()` (`acq-contract.actions.ts`): Creates property acquisition contract (`VG-CON-YYYY-NNN`).

---

## API Endpoints (`src/app/api/`)

- `GET /api/bd/contracts/[id]/pdf`: Renders downloadable PDF contract.
- `GET /api/cron/contract-reminders`: Executes automated contract reminder cron.
