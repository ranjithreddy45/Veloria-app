"use client";

import * as React from "react";
import {
  ZapIcon,
  Loader2Icon,
  PlayIcon,
  ChevronDownIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { getMacros, executeMacro, type MacroData } from "@/actions/macro.actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ============================================================
// Props
// ============================================================

interface MacroButtonProps {
  entityType: string;
  entityId: string;
}

// ============================================================
// Component
// ============================================================

export function MacroButton({ entityType, entityId }: MacroButtonProps) {
  const router = useRouter();
  const [macros, setMacros] = React.useState<MacroData[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [executingId, setExecutingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    getMacros(entityType).then((res) => {
      if (res.success) setMacros(res.data);
      setLoading(false);
    });
  }, [entityType]);

  async function handleRun(macro: MacroData) {
    setExecutingId(macro.id);
    const result = await executeMacro(macro.id, entityId);
    if (result.success) {
      toast.success(
        `"${macro.name}" executed — ${result.data.executedActions} action(s)`
      );
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setExecutingId(null);
  }

  if (loading || macros.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <ZapIcon className="mr-2 size-4" />
          Macros
          <ChevronDownIcon className="ml-1 size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Run Macro</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {macros.map((macro) => (
          <DropdownMenuItem
            key={macro.id}
            onClick={() => handleRun(macro)}
            disabled={executingId !== null}
          >
            {executingId === macro.id ? (
              <Loader2Icon className="mr-2 size-4 animate-spin" />
            ) : (
              <PlayIcon className="mr-2 size-4" style={{ color: macro.color }} />
            )}
            <div className="min-w-0 flex-1">
              <span className="text-sm">{macro.name}</span>
              {macro.description && (
                <p className="text-xs text-muted-foreground truncate">
                  {macro.description}
                </p>
              )}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
