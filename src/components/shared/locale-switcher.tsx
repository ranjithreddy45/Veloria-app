"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { GlobeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const localeNames: Record<string, string> = {
  en: "English",
  hi: "हिन्दी",
  kn: "ಕನ್ನಡ",
  te: "తెలుగు",
};

export function LocaleSwitcher() {
  const router = useRouter();
  const [current, setCurrent] = React.useState("en");
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    // Read current locale from cookie (client-only to avoid hydration mismatch)
    const match = document.cookie.match(/(?:^|; )locale=([^;]*)/);
    if (match) setCurrent(match[1]);
    setMounted(true);
  }, []);

  function switchLocale(locale: string) {
    document.cookie = `locale=${locale};path=/;max-age=31536000`;
    setCurrent(locale);
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <GlobeIcon className="size-4" />
          <span className="hidden sm:inline text-xs">
            {mounted ? (localeNames[current] ?? "English") : "English"}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {Object.entries(localeNames).map(([code, name]) => (
          <DropdownMenuItem
            key={code}
            onClick={() => switchLocale(code)}
            className={mounted && current === code ? "bg-accent" : ""}
          >
            {name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
