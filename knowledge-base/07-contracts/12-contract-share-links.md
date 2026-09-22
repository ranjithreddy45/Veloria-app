# Tokenized Share Links & Security

## Overview

Generates unguessable cryptographic URL tokens (`/sign/[token]`) for remote client signature requests.

---

## Security Controls

- **Token Generation**: Uses `crypto.randomBytes` or `cuid()` to generate unguessable URL tokens.
- **Expiration**: `expiresAt` timestamp automatically invalidates old links.
- **Document Locking**: Once `isLocked = true`, the tokenized URL displays the completed, signed contract view only.
