// ============================================================
// E-signature adapter — provider-agnostic.
// Mirrors the existing telephony/WhatsApp adapter pattern: the flow is fully
// wired, and the real provider call activates the moment credentials are set.
// Until then it returns a setup hint so nothing breaks (the manual
// "upload signed PDF" path remains the fallback).
//
// To go live: set ESIGN_PROVIDER (zoho|leegality|digio) + ESIGN_API_KEY
// (and provider base URL if needed), then implement the marked fetch block.
// ============================================================

export type EsignProvider = "zoho" | "leegality" | "digio";

export interface EsignRequest {
  contractId: string;
  title: string;
  signerName: string;
  signerEmail?: string | null;
  signerPhone?: string | null;
  documentUrl?: string | null;
}

export interface EsignResult {
  configured: boolean;
  success: boolean;
  requestId?: string;
  provider?: EsignProvider;
  error?: string;
}

export function esignConfigured(): boolean {
  return !!process.env.ESIGN_API_KEY && !!process.env.ESIGN_PROVIDER;
}

/**
 * Send a contract for e-signature via the configured provider. Returns
 * `configured:false` with a friendly hint when no provider key is set.
 */
export async function sendForSignature(req: EsignRequest): Promise<EsignResult> {
  const provider = process.env.ESIGN_PROVIDER as EsignProvider | undefined;
  const apiKey = process.env.ESIGN_API_KEY;

  if (!provider || !apiKey) {
    return {
      configured: false,
      success: false,
      error:
        "E-signature isn't connected yet. Add ESIGN_PROVIDER + ESIGN_API_KEY (e.g. Zoho Sign / Leegality / Digio) to enable in-app signing. For now, upload the signed PDF manually.",
    };
  }

  try {
    // ---- Provider call (implement once the account/key exists) ----
    // Each provider differs; e.g. Zoho Sign: POST /api/v1/requests with the
    // document + recipient; Leegality/Digio: POST their sign-request endpoint.
    // const res = await fetch(`${process.env.ESIGN_BASE_URL}/...`, {
    //   method: "POST",
    //   headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    //   body: JSON.stringify({ ...map req to provider shape... }),
    // });
    // const data = await res.json();
    // return { configured: true, success: res.ok, requestId: data.id, provider };

    // Until the provider block is implemented, report configured-but-pending.
    return {
      configured: true,
      success: false,
      provider,
      error: `Provider "${provider}" is configured but the request mapping isn't implemented yet.`,
    };
  } catch (e) {
    return {
      configured: true,
      success: false,
      provider,
      error: e instanceof Error ? e.message : "E-sign request failed",
    };
  }
}
