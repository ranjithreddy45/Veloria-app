import { Loader2 } from "lucide-react";

export default function VendorPortalLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="size-7 animate-spin text-teal-600 dark:text-teal-400" />
        <p className="text-sm text-muted-foreground">One moment…</p>
      </div>
    </div>
  );
}
