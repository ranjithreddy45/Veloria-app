// ============================================================
// The co-host invite — ONE wording, used by the WhatsApp send (server) and by
// "Share link" on the share screen (client), so a family member reads the same
// message whichever way it reaches them. Plain module, no imports.
// ============================================================

export interface CollaboratorInviteTextInput {
  recipientName: string;
  hostName: string;
  eventName: string;
  /** Already formatted for people, e.g. "Sat, 12 Dec 2026". */
  eventDate: string;
  role: "CO_HOST" | "VIEWER";
  /** The number they must sign in with — the invite only unlocks for that number. */
  phoneDisplay: string;
  url: string;
}

export function collaboratorInviteText(p: CollaboratorInviteTextInput): string {
  const what =
    p.role === "CO_HOST"
      ? "You can help with the guest list and the planning checklist."
      : "You can follow the plan, the guest list and the checklist.";
  return [
    `Hi ${p.recipientName},`,
    "",
    `${p.hostName} has shared *${p.eventName}* (${p.eventDate}) with you on the Veloria Grand app.`,
    what,
    "",
    `Open ${p.url} and sign in with your WhatsApp number ${p.phoneDisplay}.`,
  ].join("\n");
}

/** The guest app's sign-in screen, returning straight to the shared event. */
export function welcomeUrl(bookingId: string, base?: string): string {
  const root = (base || process.env.NEXT_PUBLIC_APP_URL || "https://veloriagrand.com").replace(/\/+$/, "");
  return `${root}/app/welcome?next=${encodeURIComponent(`/app/event?b=${bookingId}`)}`;
}
