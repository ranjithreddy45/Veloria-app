import { redirect } from "next/navigation";
import { auth } from "@/../auth";

export interface GuestUser {
  id: string;
  name: string | null;
  email: string | null;
}

/** The signed-in guest, or null. Any role may use the guest app. */
export async function getGuestUser(): Promise<GuestUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return { id: session.user.id, name: session.user.name ?? null, email: session.user.email ?? null };
}

/** Gate for Plan/Account screens — sends to the Welcome screen and back. */
export async function requireGuest(next: string): Promise<GuestUser> {
  const user = await getGuestUser();
  if (!user) redirect(`/app/welcome?next=${encodeURIComponent(next)}`);
  return user;
}
