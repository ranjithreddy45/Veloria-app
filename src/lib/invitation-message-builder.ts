// ============================================================
// Invitation Message Builder
// ============================================================
// Builds rich WhatsApp invitation messages for event guests.

interface InvitationMessageParams {
  guestName: string;
  eventName: string;
  eventDate: string; // formatted date string
  eventTime?: string; // formatted time string
  venueName: string;
  hostName: string;
  rsvpLink: string;
  customMessage?: string;
}

/**
 * Build a rich WhatsApp invitation message.
 */
export function buildInvitationMessage(
  params: InvitationMessageParams
): string {
  const {
    guestName,
    eventName,
    eventDate,
    eventTime,
    venueName,
    hostName,
    rsvpLink,
    customMessage,
  } = params;

  const timeStr = eventTime ? ` at ${eventTime}` : "";

  const lines = [
    `✨ *You're Invited!* ✨`,
    ``,
    `Dear *${guestName}*,`,
    ``,
    `${hostName} warmly invites you to`,
    `🎉 *${eventName}*`,
    ``,
    `📅 *Date:* ${eventDate}${timeStr}`,
    `📍 *Venue:* ${venueName}`,
  ];

  if (customMessage) {
    lines.push(``, `💬 _${customMessage}_`);
  }

  lines.push(
    ``,
    `Please confirm your attendance:`,
    `👉 ${rsvpLink}`,
    ``,
    `We look forward to seeing you! 🌟`,
    ``,
    `— *${hostName}* via Veloria Grand`
  );

  return lines.join("\n");
}

/**
 * Build the RSVP URL from a token.
 */
export function buildRsvpUrl(token: string): string {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://veloriagrand.com";
  return `${baseUrl}/rsvp/${token}`;
}
