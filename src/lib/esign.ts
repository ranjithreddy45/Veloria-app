// ============================================================
// E-Sign Placeholder Module
// ============================================================
// This module provides a placeholder for e-signature integration.
// It will be replaced with a real provider (DocuSign, SignNow, etc.) later.

export async function requestSignature({
  contractId,
  signerEmail,
}: {
  contractId: string;
  signerEmail: string;
}): Promise<{ success: boolean; configured: boolean; message: string }> {
  // No external e-sign provider is wired yet. Be HONEST: report that nothing was
  // dispatched (success:false, configured:false) so callers don't tell staff a
  // signing request was sent. Signing works via the in-portal drawn-signature link.
  console.log(
    `[ESIGN] No provider configured — contract ${contractId} for ${signerEmail} will be signed via the portal link.`
  );
  return {
    success: false,
    configured: false,
    message: "E-sign provider not configured — the client signs via their secure portal link.",
  };
}
