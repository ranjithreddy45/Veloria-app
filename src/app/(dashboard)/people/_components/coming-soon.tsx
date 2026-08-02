import { Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";

// Shared "coming soon" stub for P2 People modules (nav present, build deferred).
export function ComingSoon({ title, description, bullets }: { title: string; description: string; bullets: string[] }) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} eyebrow="People" icon={Sparkles} description={description} />
      <div className="mx-auto max-w-lg rounded-2xl border border-dashed bg-card p-8 text-center shadow-card sm:p-10">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Sparkles className="size-6" />
        </div>
        <h3 className="font-editorial mt-5 text-title leading-tight">Coming soon</h3>
        <p className="mx-auto mt-2 max-w-sm text-body leading-relaxed text-muted-foreground">
          {title} is on the People roadmap. It’ll build on the same employee master, org chart and approval engine already live.
        </p>
        <ul className="mx-auto mt-5 max-w-sm space-y-1.5 text-left text-body text-muted-foreground">
          {bullets.map((b) => (
            <li key={b} className="flex gap-2"><span className="text-primary">•</span>{b}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
