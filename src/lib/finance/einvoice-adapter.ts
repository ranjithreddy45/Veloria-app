// ============================================================
// Finance — E-Invoicing adapter (SWAPPABLE service).
//
// MOCK adapter — replace with real IRP/GSP integration (NIC e-invoice API)
// once GSTIN + API credentials are configured. The mock produces deterministic,
// e-invoice-shaped artifacts (IRN / AckNo / signed-QR payload) from the source
// invoice so the UI and data flow can be exercised end-to-end in a sandbox,
// without ever calling a live Invoice Registration Portal.
//
// To go live: implement the `EInvoiceAdapter` interface against the NIC IRP /
// your GSP, swap the exported `einvoiceAdapter` binding below, and keep the
// rest of the module (actions + page) unchanged.
// ============================================================

/** Minimal invoice shape the adapter needs to build an e-invoice request. */
export interface EInvoiceSource {
  invoiceNumber: string;
  totalAmount: number;
  gstin: string | null;
  placeOfSupply: string | null;
  issueDate: Date;
}

/** Result returned by a successful IRN generation. */
export interface EInvoiceResult {
  irn: string; // Invoice Reference Number — 64-char hash from the IRP
  ackNo: string; // Acknowledgement number
  ackDate: string; // ISO timestamp of acknowledgement
  qrData: string; // Signed-QR payload string (encoded by the IRP)
}

/** The contract a real IRP/GSP implementation must satisfy. */
export interface EInvoiceAdapter {
  /** Sandbox/live flag — surfaced in the UI so users know nothing is filed. */
  readonly mode: "sandbox" | "live";
  generateIrn(invoice: EInvoiceSource): Promise<EInvoiceResult>;
}

// ------------------------------------------------------------
// Deterministic, dependency-free hash (FNV-1a → hex), expanded to a fixed
// width. Deterministic so the same invoice always yields the same mock IRN,
// which makes the sandbox stable and idempotent.
// ------------------------------------------------------------
function fnv1aHex(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // >>> 0 keeps it unsigned; pad to 8 hex chars.
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** Expand a seed into a deterministic hex string of exactly `length` chars. */
function deterministicHex(seed: string, length: number): string {
  let out = "";
  let round = 0;
  while (out.length < length) {
    out += fnv1aHex(`${seed}#${round}`);
    round++;
  }
  return out.slice(0, length);
}

// ------------------------------------------------------------
// MOCK implementation. Swap this binding for a real one to go live.
// ------------------------------------------------------------
export const mockEInvoiceAdapter: EInvoiceAdapter = {
  mode: "sandbox",

  // MOCK — no network call. Real impl: POST to the IRP /invoice endpoint with a
  // signed payload and return the IRP-issued IRN/AckNo/signed-QR.
  async generateIrn(invoice: EInvoiceSource): Promise<EInvoiceResult> {
    const seed = `${invoice.invoiceNumber}|${invoice.gstin ?? "NA"}|${invoice.totalAmount.toFixed(2)}`;
    const irn = deterministicHex(seed, 64); // 64-char hex-ish, IRN-shaped
    // AckNo at the real IRP is a numeric token; derive a stable pseudo-number.
    const ackNo = (parseInt(deterministicHex(`ack|${seed}`, 8), 16) >>> 0)
      .toString()
      .padStart(15, "0")
      .slice(0, 15);
    const ackDate = new Date().toISOString();
    // The real signed-QR is a long base64 JWT from the IRP. Here we encode a
    // compact, human-debuggable payload string clearly marked SANDBOX.
    const qrPayload = {
      sandbox: true,
      sellerGstin: invoice.gstin ?? "UNREGISTERED",
      docNo: invoice.invoiceNumber,
      docDt: invoice.issueDate.toISOString().slice(0, 10),
      totInvVal: invoice.totalAmount,
      pos: invoice.placeOfSupply ?? "NA",
      irn,
      ackNo,
    };
    const qrData = `SANDBOX:${Buffer.from(JSON.stringify(qrPayload)).toString("base64")}`;
    return { irn, ackNo, ackDate, qrData };
  },
};

/**
 * Active adapter binding consumed by the server actions. Point this at a real
 * `EInvoiceAdapter` (NIC IRP / GSP) when credentials are configured — no other
 * file needs to change.
 */
export const einvoiceAdapter: EInvoiceAdapter = mockEInvoiceAdapter;
