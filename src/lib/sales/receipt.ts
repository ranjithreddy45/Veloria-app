// Receipt-URL safety. A payment proof is customer-controlled, so it must NEVER
// be allowed to carry an executable scheme (javascript:, data:text/html, …)
// that could run when staff open it. We allow only base64 image/PDF data-URLs
// (what the upload UI produces) and, for staff-entered references, https links.

const DATA_IMG_PDF = /^data:(image\/(png|jpe?g|gif|webp)|application\/pdf);base64,[A-Za-z0-9+/=\r\n]+$/;
const HTTPS = /^https:\/\/[^\s"'<>]+$/i;

/** Customer-submitted proofs: only an image/PDF data-URL is acceptable. */
export function isSafeReceiptDataUrl(url: string): boolean {
  return !!url && DATA_IMG_PDF.test(url.trim());
}

/** Staff-entered references may also be an https link to a hosted receipt. */
export function isSafeReceiptUrl(url: string): boolean {
  const u = (url || "").trim();
  return DATA_IMG_PDF.test(u) || HTTPS.test(u);
}
