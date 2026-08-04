import { describe, it, expect } from "vitest";
import { mintEnrichToken, readEnrichToken } from "./enquiry-enrich-token";

// This token is the ONLY thing standing between a public endpoint and
// "overwrite any lead you can name", so every rejection path is pinned.

describe("enrich token", () => {
  it("round-trips the lead it authorises", () => {
    expect(readEnrichToken(mintEnrichToken("lead_abc"))).toBe("lead_abc");
  });

  it("authorises exactly ONE lead, not a family of them", () => {
    const t = mintEnrichToken("lead_abc");
    // Swapping the id invalidates the signature — you cannot take a token you
    // legitimately hold and point it at someone else's lead.
    expect(readEnrichToken(t.replace("lead_abc", "lead_xyz"))).toBeNull();
  });

  it("rejects a forged signature", () => {
    const exp = Date.now() + 60_000;
    expect(readEnrichToken(`lead_abc.${exp}.${"0".repeat(32)}`)).toBeNull();
  });

  it("rejects a token past its expiry", () => {
    // Minted 40 minutes ago against a 30-minute TTL: a token found later in a
    // log or a proxy cache is inert.
    expect(readEnrichToken(mintEnrichToken("lead_abc", Date.now() - 40 * 60_000))).toBeNull();
  });

  it("accepts one still inside its window", () => {
    expect(readEnrichToken(mintEnrichToken("lead_abc", Date.now() - 60_000))).toBe("lead_abc");
  });

  it("rejects malformed input without throwing", () => {
    // A public endpoint must not 500 on junk — that is both a DoS and an
    // information leak about which shapes got further than others.
    for (const bad of [null, undefined, "", "a", "a.b", "a.b.c", 42, {}, [], "x".repeat(500)]) {
      expect(readEnrichToken(bad)).toBeNull();
    }
  });

  it("rejects a non-numeric expiry", () => {
    expect(readEnrichToken("lead_abc.notanumber.abc")).toBeNull();
  });

  it("gives every failure the same answer", () => {
    // Same null for expired, forged and malformed: the endpoint should never
    // tell an attacker WHICH part of their guess was closest.
    const results = [
      readEnrichToken("lead_abc.1.deadbeef"),
      readEnrichToken(mintEnrichToken("x", Date.now() - 10 ** 7)),
      readEnrichToken("garbage"),
    ];
    expect(new Set(results)).toEqual(new Set([null]));
  });
});
