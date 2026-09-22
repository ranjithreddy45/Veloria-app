# Tokenized Share Links & Security

## Overview

Share links (`QuoteShareLink` model) generate unguessable URL tokens (`/q/[token]`) for client proposals.

---

## Token Properties

- **`token`**: Unique cryptographic string.
- **`expiresAt`**: Expiration timestamp.
- **`viewCount`**: Monotonic counter of client page opens.
- **`firstViewedAt`** / **`lastViewedAt`**: View timestamps.
- **`aiCaption`**: AI-generated personalized proposal summary text.
