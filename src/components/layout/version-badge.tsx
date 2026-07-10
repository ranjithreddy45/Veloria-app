import { version } from "@/../package.json";

// ============================================================
// VersionBadge — the app version, read from package.json at build time and
// rendered small and muted (for the user-menu dropdown footer). If package.json
// has no version we render nothing rather than fabricate one.
// ============================================================

export function VersionBadge({ className }: { className?: string }) {
  if (!version || typeof version !== "string") return null;
  return (
    <span
      className={
        "select-none text-[11px] font-normal tabular-nums text-muted-foreground/70" +
        (className ? ` ${className}` : "")
      }
    >
      v{version}
    </span>
  );
}
