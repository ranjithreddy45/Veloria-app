# Complete Contract Feature Index

## Overview

Authoritative feature catalog for all contract capabilities with immutable feature identifiers.

---

## Feature Catalog

| Feature ID | Feature Name | Primary Route | Primary Action / API | Primary Model | Status |
|---|---|---|---|---|---|
| `CONTRACT-001` | Contract Creation & Template Render | `/contracts/new` | `createContract()` | `Contract` | CODE VERIFIED |
| `CONTRACT-002` | Legal Template Manager | `/settings/contract-templates` | `saveContractTemplate()` | `ContractTemplate` | CODE VERIFIED |
| `CONTRACT-003` | Tokenized E-Sign Share Link | `/contracts/[id]` | `sendSignatureRequest()` | `SignatureRequest` | CODE VERIFIED |
| `CONTRACT-004` | Public E-Sign Signing Portal | `/sign/[token]` | Page Handler | `SignatureRequest` | CODE VERIFIED |
| `CONTRACT-005` | Canvas Signature Pad | `/sign/[token]` | `sign-pad.tsx` | `SignatureRequest` | CODE VERIFIED |
| `CONTRACT-006` | Document Locking | Internal | `submitSignature()` | `SignatureRequest` (`isLocked`) | CODE VERIFIED |
| `CONTRACT-007` | Client Portal Contract Review | `/portal/contracts` | Page Handler | `Contract` | CODE VERIFIED |
| `CONTRACT-008` | Property Acquisition Contracts | `/bd/contracts` | `createAcqContract()` | `AcqContract` | CODE VERIFIED |
| `CONTRACT-009` | Acquisition Contract Versioning | `/bd/contracts/[id]` | Version Handler | `AcqContractVersion` | CODE VERIFIED |
| `CONTRACT-010` | Unsigned Contract Reminder Cron | `/api/cron/contract-reminders` | Cron Handler | `SignatureRequest` | CODE VERIFIED |
| `CONTRACT-011` | Contract PDF Export | `/api/bd/contracts/[id]/pdf` | Route Handler | `AcqContract` | CODE VERIFIED |
