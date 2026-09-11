import { getGuestPhotos, getGuestPhotoTags } from "@/actions/guest-public.actions";
import { Screen, ScreenHeader, Chip, EmptyNote, Photo } from "../../_components/ui";

export const metadata = { title: "Gallery — Veloria Grand" };
export const revalidate = 300;

export default async function GalleryPage({ searchParams }: { searchParams: Promise<{ tag?: string }> }) {
  const { tag } = await searchParams;
  const [tags, photos] = await Promise.all([getGuestPhotoTags(), getGuestPhotos({ limit: 40, tag: tag || undefined })]);

  return (
    <Screen className="gap-4">
      <ScreenHeader title="Gallery" backHref="/app" />
      <h1 className="-mt-1 font-editorial text-[26px] font-medium leading-[1.15] tracking-[-.015em]">
        Real celebrations,<br /><em className="italic text-[#6d1b52]">as they happened.</em>
      </h1>
      {tags.length > 0 && (
        <div className="vg-scroll-x vg-bleed gap-1.5">
          <Chip active={!tag} href="/app/gallery">All</Chip>
          {tags.map((t) => <Chip key={t} active={tag === t} href={`/app/gallery?tag=${encodeURIComponent(t)}`}>{t}</Chip>)}
        </div>
      )}
      {photos.length === 0 ? (
        <EmptyNote>Photos from real events at Veloria Grand will appear here once the team publishes them. Nothing here is stock imagery.</EmptyNote>
      ) : (
        <div className="grid auto-rows-[150px] grid-cols-2 gap-2">
          {photos.map((p, i) => (
            <Photo key={p.id} src={p.url} alt={p.title ?? "Event photo"} className={`rounded-[14px] ${i % 5 === 0 ? "col-span-2" : ""}`}>
              {(p.title || p.tags[0]) && (
                <span className="absolute bottom-2 left-2.5 rounded-full bg-[#1d1d1f]/55 px-2 py-1 text-[10.5px] font-semibold text-white backdrop-blur">{p.title ?? p.tags[0]}</span>
              )}
            </Photo>
          ))}
        </div>
      )}
    </Screen>
  );
}
