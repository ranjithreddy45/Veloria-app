"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { CheckCircle2, Loader2, Pen, Type, Eraser } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  markSignatureViewed,
  submitSignature,
} from "@/actions/signature-public.actions";

// Keep the canvas small so the base64 PNG payload stays well under
// request-body limits.
const CANVAS_W = 600;
const CANVAS_H = 200;

interface SignPadProps {
  token: string;
  defaultSignerName: string;
}

export function SignPad({ token, defaultSignerName }: SignPadProps) {
  const [isPending, startTransition] = useTransition();
  const [signed, setSigned] = useState(false);
  const [signerName, setSignerName] = useState(defaultSignerName);
  const [agreed, setAgreed] = useState(false);
  const [mode, setMode] = useState<"TYPED" | "DRAWN">("TYPED");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const hasDrawnRef = useRef(false);

  // Mark the request as viewed once, on mount.
  useEffect(() => {
    void markSignatureViewed(token);
  }, [token]);

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#18181b";
    return ctx;
  }, []);

  const pointFromEvent = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) / rect.width) * CANVAS_W,
        y: ((e.clientY - rect.top) / rect.height) * CANVAS_H,
      };
    },
    []
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      canvasRef.current?.setPointerCapture(e.pointerId);
      drawingRef.current = true;
      lastRef.current = pointFromEvent(e);
    },
    [pointFromEvent]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current) return;
      const ctx = getCtx();
      const last = lastRef.current;
      if (!ctx || !last) return;
      const p = pointFromEvent(e);
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      lastRef.current = p;
      hasDrawnRef.current = true;
    },
    [getCtx, pointFromEvent]
  );

  const handlePointerUp = useCallback(() => {
    drawingRef.current = false;
    lastRef.current = null;
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    hasDrawnRef.current = false;
  }, []);

  function handleSubmit() {
    const name = signerName.trim();
    if (name.length < 2) {
      toast.error("Please enter your full name.");
      return;
    }
    if (!agreed) {
      toast.error("Please agree to the Terms & Conditions to continue.");
      return;
    }

    let signatureData: string;
    if (mode === "TYPED") {
      signatureData = name;
    } else {
      if (!hasDrawnRef.current || !canvasRef.current) {
        toast.error("Please draw your signature in the box.");
        return;
      }
      signatureData = canvasRef.current.toDataURL("image/png");
    }

    startTransition(async () => {
      const result = await submitSignature({
        token,
        signerName: name,
        signatureType: mode,
        signatureData,
        agreed: true,
      });
      if (result.success) {
        setSigned(true);
        toast.success("Thank you — your signature has been recorded.");
      } else {
        toast.error(result.error || "Something went wrong. Please try again.");
      }
    });
  }

  if (signed) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-900/50 dark:bg-emerald-950/30">
        <CheckCircle2 className="size-9 text-emerald-600" />
        <p className="text-base font-semibold text-emerald-800 dark:text-emerald-300">
          Signed — thank you, {signerName.trim()}!
        </p>
        <p className="text-sm text-emerald-700 dark:text-emerald-400">
          Your booking confirmation has been signed and locked. A copy has been
          shared with our team. No further action is needed.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <h2 className="font-editorial text-foreground text-[20px] font-semibold">
        Sign to confirm
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Type or draw your signature below. Your signature is legally binding.
      </p>

      <div className="mt-5 space-y-2">
        <Label htmlFor="signerName" className="text-sm">
          Full name
        </Label>
        <Input
          id="signerName"
          value={signerName}
          onChange={(e) => setSignerName(e.target.value)}
          placeholder="Your full legal name"
          autoComplete="name"
        />
      </div>

      <Tabs
        value={mode}
        onValueChange={(v) => setMode(v as "TYPED" | "DRAWN")}
        className="mt-5"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="TYPED">
            <Type className="mr-1.5 size-4" />
            Type
          </TabsTrigger>
          <TabsTrigger value="DRAWN">
            <Pen className="mr-1.5 size-4" />
            Draw
          </TabsTrigger>
        </TabsList>

        <TabsContent value="TYPED" className="mt-4">
          <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center">
            <span
              className="text-2xl text-foreground"
              style={{ fontFamily: "'Brush Script MT', cursive" }}
            >
              {signerName.trim() || "Your signature"}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Your typed name above will be used as your signature.
          </p>
        </TabsContent>

        <TabsContent value="DRAWN" className="mt-4">
          <div className="overflow-hidden rounded-xl border-border border bg-white">
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              className="h-[200px] w-full touch-none"
              style={{ touchAction: "none" }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            />
          </div>
          <div className="mt-2 flex justify-between">
            <p className="text-xs text-muted-foreground">
              Draw your signature with your finger or mouse.
            </p>
            <button
              type="button"
              onClick={clearCanvas}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <Eraser className="size-3.5" />
              Clear
            </button>
          </div>
        </TabsContent>
      </Tabs>

      <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl bg-muted/30 p-3">
        <Checkbox
          checked={agreed}
          onCheckedChange={(v) => setAgreed(v === true)}
          className="mt-0.5"
        />
        <span className="text-sm text-foreground/85">
          I have read and agree to the Terms &amp; Conditions set out in this
          booking confirmation.
        </span>
      </label>

      <Button
        className="mt-5 w-full"
        size="lg"
        disabled={isPending}
        onClick={handleSubmit}
      >
        {isPending ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <CheckCircle2 className="mr-2 size-4" />
        )}
        Sign &amp; Confirm
      </Button>
    </div>
  );
}
