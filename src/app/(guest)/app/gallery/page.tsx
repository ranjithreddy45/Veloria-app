import { getGuestPhotos, getGuestPhotoTags } from "@/actions/guest-public.actions";
import { Screen, ScreenHeader, Chip, EmptyNote, Photo } from "../../_components/ui";
import { GALLERY_STOCK, STOCK_TAGS, CREDITS_LINE } from "../../_components/stock";

export const metadata = { title: "Gallery — Veloria Grand" };
export const revalidate = 300;

export default async function GalleryPage({ searchParams }: { searchParams: Promise<{ tag?: string }> }) {
  const { tag } = await searchParams;
  const [tags, photos, anyReal] = await Promise.all([
    getGuestPhotoTags(),
    getGuestPhotos({ limit: 40, tag: tag || undefined }),
    tag ? getGuestPhotos({ limit: 1 }) : Promise.resolve(null),
  ]);
  // Real public photos always win. Illustrations appear only when the team has published no photo at all.
  const stockMode = (anyReal ?? photos).length === 0;
  const chips: readonly string[] = stockMode ? STOCK_TAGS : tags;
  const list = stockMode
    ? GALLERY_STOCK.filter((g) => !tag || g.tag === tag).map((g) => ({ id: g.src, url: g.src, title: g.label as string | null, tags: [g.tag] as string[] }))
    : photos;

  return (
    <Screen className="gap-4">
      <ScreenHeader title="Gallery" backHref="/app" />
      {stockMode ? (
        <div>
          <h1 className="-mt-1 font-editorial text-[26px] font-medium leading-[1.15] tracking-[-.015em]">
            Ideas for your<br /><em className="italic text-[#6d1b52]">celebration.</em>
          </h1>
          <p className="vg-gold-note mt-3 rounded-[14px] p-3.5 text-detail leading-[1.5] text-[#3a3a3c]">
            <span className="font-semibold text-[#1d1d1f]">These are illustrations,</span> not photos taken at Veloria Grand. Our own photos replace them here as soon as the team publishes them.
          </p>
        </div>
      ) : (
        <h1 className="-mt-1 font-editorial text-[26px] font-medium leading-[1.15] tracking-[-.015em]">
          Photos from<br /><em className="italic text-[#6d1b52]">Veloria Grand.</em>
        </h1>
      )}
      <div className="vg-scroll-x vg-bleed gap-1.5">
        <Chip active={!tag} href="/app/gallery">All</Chip>
        {chips.map((t) => <Chip key={t} active={tag === t} href={`/app/gallery?tag=${encodeURIComponent(t)}`}>{t}</Chip>)}
      </div>
      {list.length === 0 ? (
        <EmptyNote>Nothing under this tag yet.</EmptyNote>
      ) : (
        <div className="grid auto-rows-[150px] grid-cols-2 gap-2">
          {list.map((p, i) => (
            <Photo key={p.id} src={p.url} alt={p.title ?? "Photo"} illustration={stockMode} className={`rounded-[14px] ${i % 5 === 0 ? "col-span-2" : ""}`}>
              {(p.title || p.tags[0]) && (
                <span className="absolute bottom-2 left-2.5 rounded-full bg-[#1d1d1f]/55 px-2 py-1 text-[10.5px] font-semibold text-white backdrop-blur">{p.title ?? p.tags[0]}</span>
              )}
            </Photo>
          ))}
        </div>
      )}
      {stockMode && <p className="text-meta leading-[1.5] text-[#636368]">{CREDITS_LINE}</p>}
    </Screen>
  );
}
