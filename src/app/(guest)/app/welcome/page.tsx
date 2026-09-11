import { redirect } from "next/navigation";
import Link from "next/link";
import { getGuestUser } from "@/lib/guest-session";
import { getStorefrontVenues } from "@/actions/storefront.actions";
import { getGuestPhotos } from "@/actions/guest-public.actions";
import { OtpSignIn } from "./_components/otp-sign-in";

export const metadata = { title: "Welcome — Veloria Grand" };
export const dynamic = "force-dynamic";

export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const dest = next && next.startsWith("/app") ? next : "/app";
  const user = await getGuestUser();
  if (user) redirect(dest);

  const [venues, photos] = await Promise.all([getStorefrontVenues(), getGuestPhotos({ limit: 1 })]);
  const hero = photos[0]?.url ?? null;
  const halls = venues.length;

  return (
    <div className="relative -mb-[calc(6rem+var(--sab))] min-h-screen overflow-hidden bg-[#2a0b20] text-[#fdf5f3]">
      {hero ? (
        <div aria-hidden className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url("${hero.replace(/["\\]/g, "\\$&")}")` }} />
      ) : (
        <div aria-hidden className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_30%_20%,#b88513_0,transparent_45%),radial-gradient(circle_at_80%_70%,#7a2160_0,transparent_50%)]" />
      )}
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgba(42,11,32,.05)_25%,rgba(42,11,32,.5)_55%,rgba(42,11,32,.96)_82%)]" />

      <div className="vg-rise-slow relative flex min-h-screen flex-col justify-end gap-[18px] px-7 pb-[calc(var(--sab)+3.5rem)] pt-[calc(var(--sat)+2rem)]">
        <div className="flex size-[54px] items-center justify-center rounded-full border border-[#e8b631]/75 font-editorial text-[26px] font-medium text-[#f3d489] shadow-[0_0_0_6px_rgba(232,182,49,.08)]">V</div>
        <div className="text-[11px] font-semibold uppercase tracking-[.22em] text-[#e8b631]">Veloria Grand · Bengaluru</div>
        <h1 className="font-editorial text-[40px] font-medium leading-[1.02] tracking-[-.02em] [text-wrap:pretty]">
          Where your<br /><em className="italic text-[#f3d489]">celebration</em><br />begins.
        </h1>
        <p className="text-body leading-[1.55] text-[#fdf5f3]/[.78]">
          {halls > 0 ? `${halls === 1 ? "One hall" : `${halls} halls`}, one address.` : "One address."} Hold a date in minutes, plan every detail from your phone.
        </p>
        <OtpSignIn next={dest} />
        <Link href="/app" className="block rounded-2xl border border-[#fdf5f3]/35 py-[15px] text-center text-body font-medium text-[#fdf5f3]">
          Browse as guest
        </Link>
      </div>
    </div>
  );
}
