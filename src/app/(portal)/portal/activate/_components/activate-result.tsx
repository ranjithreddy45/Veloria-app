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
    <div className="mx-auto max-w-md py-6">
      <Card className="shadow-card rounded-2xl py-0">
        <CardContent className="flex flex-col items-center px-6 py-14 text-center">
          <div
            className={`flex size-16 items-center justify-center rounded-2xl ${
              ok ? "bg-success/10" : "bg-destructive/10"
            }`}
          >
            {ok ? (
              <CheckCircle2 className="size-8 text-success" />
            ) : (
              <XCircle className="size-8 text-destructive" />
            )}
          </div>
          <p className="text-muted-foreground mt-5 text-[11px] font-semibold uppercase tracking-[0.14em]">
            Your account
          </p>
          <h1 className="font-editorial text-foreground mt-2 text-[24px] font-semibold">
            {ok ? "You're all set" : "We couldn't activate this"}
          </h1>
          <p className="text-muted-foreground mt-2.5 max-w-sm text-sm leading-relaxed">
            {message}
          </p>
          <Button asChild className="mt-7 rounded-full px-6">
            <Link href="/portal">Go to my portal</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
