import { redirect } from "next/navigation";
import { auth } from "@/../auth";

export interface GuestUser {
  id: string;
  name: string | null;
  /** A real address only. Logins created from a WhatsApp number get a
   *  non-deliverable "…@customer.invalid" address, which is never shown. */
  email: string | null;
}

/** Reserved non-deliverable address (RFC 2606 `.invalid`) — never show it to a customer. */
function shownEmail(email: string | null | undefined): string | null {
  const e = email?.trim();
  return e && !/\.invalid$/i.test(e) ? e : null;
}

/** The signed-in guest, or null. Any role may use the guest app. */
export async function getGuestUser(): Promise<GuestUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return { id: session.user.id, name: session.user.name ?? null, email: shownEmail(session.user.email) };
}

/** Gate for Plan/Account screens — sends to the Welcome screen and back. */
export async function requireGuest(next: string): Promise<GuestUser> {
  const user = await getGuestUser();
  if (!user) redirect(`/app/welcome?next=${encodeURIComponent(next)}`);
  return user;
}
