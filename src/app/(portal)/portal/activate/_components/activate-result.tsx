"use client";

import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ActivateResultProps {
  ok: boolean;
  message: string;
}

export function ActivateResult({ ok, message }: ActivateResultProps) {
  return (
    <div className="mx-auto max-w-md">
      <Card className="border-zinc-200/80 shadow-sm">
        <CardContent className="flex flex-col items-center py-12 text-center">
          {ok ? (
            <CheckCircle2 className="size-16 text-emerald-500" />
          ) : (
            <XCircle className="size-16 text-red-400" />
          )}
          <h1 className="mt-4 text-lg font-semibold text-foreground">
            {ok ? "Portal activated" : "Couldn't activate"}
          </h1>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">{message}</p>
          <Button asChild className="mt-6">
            <Link href="/portal">Go to my portal</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
