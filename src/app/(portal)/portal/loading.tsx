import { Loader2 } from "lucide-react";

export default function PortalLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="text-primary size-7 animate-spin" />
        <p className="text-muted-foreground text-body">
          Just a moment&hellip;
        </p>
      </div>
    </div>
  );
}
