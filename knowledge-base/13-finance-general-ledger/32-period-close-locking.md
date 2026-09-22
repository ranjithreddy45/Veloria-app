# 32 Month-End & Period Closing Controls

## Period Closing Lifecycle

1. **`OPEN`**: Unrestricted posting allowed.
2. **`CLOSED`**: Postings blocked for normal users.
3. **`LOCKED`**: Hard lock. No server action or administrative override can post entries without explicitly changing state back to `OPEN`.
