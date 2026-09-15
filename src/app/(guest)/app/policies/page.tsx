import { redirect } from "next/navigation";

// Help lists every published policy, so the bare /app/policies address goes there.
export default function PoliciesIndexPage() {
  redirect("/app/help");
}
