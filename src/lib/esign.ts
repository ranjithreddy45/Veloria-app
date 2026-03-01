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
}) {
  console.log(
    `[ESIGN_PLACEHOLDER] E-sign requested for contract ${contractId} to ${signerEmail}`
  );
  return {
    success: true,
    message:
      "E-sign integration placeholder - will be connected to DocuSign/SignNow later",
  };
}
