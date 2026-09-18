import { PolicyBody } from "./policy-body";

/**
 * One policy as customers read it: title, version, date line and text.
 * The customer policy page and the team's preview in Settings → Customer
 * content both render this, so a preview is exactly what goes live. Styled
 * with plain utilities (no guest-only CSS classes) so it looks the same inside
 * the dashboard.
 */
export function PolicyDocument({ title, version, meta, body }: { title: string; version: number; meta: string | null; body: string }) {
  return (
    <article className="flex flex-col gap-3 text-[#1d1d1f]">
      <div>
        <h1 className="font-editorial text-[27px] font-semibold leading-[1.12] tracking-[-.015em]">{title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-detail text-[#6e6e73]">
          <span className="inline-flex items-center rounded-full bg-[#f7eef2] px-2.5 py-1 text-meta font-semibold text-[#6d1b52]">Version {version}</span>
          {meta && <span>{meta}</span>}
        </div>
      </div>
      <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-[0_1px_2px_rgba(29,29,31,.04),0_10px_28px_-18px_rgba(29,29,31,.22)]">
        <PolicyBody body={body} />
      </div>
    </article>
  );
}
