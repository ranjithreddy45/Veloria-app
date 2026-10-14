import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { homeForRole } from "@/lib/roles";

export default async function RootPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/sign-in");
  }

  // Route based on role (customers, vendors and venue owners have their own portals)
  redirect(homeForRole(session.user.role));
}
