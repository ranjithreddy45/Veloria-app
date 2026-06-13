// ============================================================
// E-signature adapter — provider abstracted behind an interface so
// the actual vendor (DocuSign, Zoho Sign, Leegality…) is swappable.
// Default is a no-op provider that records the request as pending.
// ============================================================

export interface ESignSendInput {
  documentId: string;
  documentTitle: string;
  fileUrl: string | null;
  signerName: string;
  signerEmail: string;
}

export interface ESignSendResult {
  externalId: string;
  provider: string;
}

export interface ESignProvider {
  readonly name: string;
  send(input: ESignSendInput): Promise<ESignSendResult>;
}

// No-op provider: no external call. Used until a real provider is configured.
class NoopESignProvider implements ESignProvider {
  readonly name = "noop";
  async send(input: ESignSendInput): Promise<ESignSendResult> {
    // A real adapter would create an envelope with the vendor and return its id.
    return { externalId: `noop-${input.documentId}`, provider: this.name };
  }
}

let provider: ESignProvider | null = null;

/** Resolve the active e-sign provider. Swap here when a vendor is configured. */
export function getESignProvider(): ESignProvider {
  if (provider) return provider;
  // Future: switch on process.env.ESIGN_PROVIDER to return a real adapter.
  provider = new NoopESignProvider();
  return provider;
}
