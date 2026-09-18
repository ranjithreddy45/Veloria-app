import { requireGuest } from "@/lib/guest-session";
import { getShareScreen } from "@/actions/guest-collaborators.actions";
import { Screen, ScreenHeader, EmptyNote } from "../../../_components/ui";
import { ShareClient } from "./_components/share-client";

export const metadata = { title: "Share with family — Veloria Grand" };
export const dynamic = "force-dynamic";

export default async function SharePage({ searchParams }: { searchParams: Promise<{ b?: string }> }) {
  const { b } = await searchParams;
  await requireGuest(typeof b === "string" && b ? `/app/event/share?b=${encodeURIComponent(b)}` : "/app/event/share");
  const data = await getShareScreen(typeof b === "string" ? b : undefined);
  if (!data) {
    return (
      <Screen className="gap-4">
        <ScreenHeader title="Share with family" backHref="/app/event" />
        <EmptyNote>No booking linked yet.</EmptyNote>
      </Screen>
    );
  }
  return <ShareClient initial={data} />;
}
