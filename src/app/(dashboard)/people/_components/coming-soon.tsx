import { Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";

// Shared "coming soon" stub for P2 People modules (nav present, build deferred).
export function ComingSoon({ title, description, bullets }: { title: string; description: string; bullets: string[] }) {
  return (
    <div className="space-y-5">
      <PageHeader title={title} eyebrow="People" description={description} />
      <div className="mx-auto max-w-lg rounded-xl border border-dashed p-10 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="size-6" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">Coming soon</h3>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
          {title} is on the People roadmap. It’ll build on the same employee master, org chart and approval engine already live.
        </p>
        <ul className="mx-auto mt-4 max-w-sm space-y-1 text-left text-[13px] text-muted-foreground">
          {bullets.map((b) => (
            <li key={b} className="flex gap-2"><span className="text-primary">•</span>{b}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
