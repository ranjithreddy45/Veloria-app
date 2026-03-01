"use client";

import { MessageCircle } from "lucide-react";

// ============================================================
// WhatsApp Empty State — No conversation selected
// ============================================================

export function WhatsAppEmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex size-20 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/40">
        <MessageCircle className="size-10 text-emerald-600 dark:text-emerald-400" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-foreground">
          WhatsApp Conversations
        </h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Select a conversation from the left to view messages, or send a new
          WhatsApp message from a contact&apos;s page.
        </p>
      </div>
    </div>
  );
}
