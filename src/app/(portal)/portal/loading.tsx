import { Loader2 } from "lucide-react";

export default function PortalLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="size-8 animate-spin text-indigo-600 dark:text-indigo-400" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}
