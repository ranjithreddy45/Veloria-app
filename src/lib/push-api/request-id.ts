import { randomBytes } from "crypto";

// ============================================================
// Request ids: "req_" + a ULID (26 Crockford base32 characters).
//
// The first ten characters encode the millisecond timestamp, so ids sort by
// arrival time in logs and in PushApiRequestLog; the remaining sixteen are
// 80 random bits, so two requests in the same millisecond never collide.
// ============================================================

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function newRequestId(now: number = Date.now()): string {
  let time = "";
  let t = now;
  for (let i = 0; i < 10; i++) {
    time = CROCKFORD[t % 32] + time;
    t = Math.floor(t / 32);
  }
  const bytes = randomBytes(10);
  let rand = "";
  // 80 bits → 16 base32 characters, 5 bits at a time.
  let buffer = 0;
  let bits = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      rand += CROCKFORD[(buffer >> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return `req_${time}${rand}`;
}

export const REQUEST_ID_PATTERN = /^req_[0-9A-HJKMNP-TV-Z]{26}$/;
