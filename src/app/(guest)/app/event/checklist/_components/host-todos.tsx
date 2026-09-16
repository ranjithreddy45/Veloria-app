"use client";

import * as React from "react";
import { Check, Loader2 } from "lucide-react";
import { addGuestTodo, toggleGuestTodo, type GuestTodo } from "@/actions/guest-host.actions";
import { TASK_STATUS_LABEL, customerLabel } from "@/lib/customer-app/status-labels";

/**
 * The host's own tickable list. Rows are real Tasks (CLIENT_TODO) on the booking,
 * so the team sees them on the booking's Tasks tab and can move them on their
 * board; the status shown here is whatever that board says.
 */
export function HostTodos({ bookingId, initial, readOnly = false }: { bookingId: string; initial: GuestTodo[]; readOnly?: boolean }) {
  const [todos, setTodos] = React.useState(initial);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const done = todos.filter((t) => t.done).length;

  async function add() {
    const title = input.trim();
    if (!title || readOnly) return;
    setBusy(true);
    setError(null);
    const res = await addGuestTodo(bookingId, title);
    setBusy(false);
    if (!res.success) return setError(res.error);
    setTodos((t) => [...t, res.data]);
    setInput("");
  }

  async function toggle(t: GuestTodo) {
    if (readOnly) return;
    setError(null);
    const next = t.done ? "TODO" : "DONE";
    setTodos((x) => x.map((y) => (y.id === t.id ? { ...y, done: !t.done, status: next, statusLabel: customerLabel(TASK_STATUS_LABEL, next) } : y)));
    const res = await toggleGuestTodo(t.id);
    if (!res.success) {
      setTodos((x) => x.map((y) => (y.id === t.id ? t : y)));
      setError(res.error);
      return;
    }
    setTodos((x) => x.map((y) => (y.id === t.id ? { ...y, ...res.data } : y)));
  }

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <div className="text-copy font-semibold">Your to-dos</div>
        {todos.length > 0 && (
          <div className="numeric text-meta font-medium text-[#6e6e73]">
            {done} of {todos.length}
          </div>
        )}
      </div>
      <div className="mt-0.5 text-meta text-[#6e6e73]">Your team sees these on your booking.</div>
      <div className="vg-card vg-divide mt-2.5 overflow-hidden rounded-2xl">
        {todos.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => toggle(t)}
            disabled={readOnly}
            aria-pressed={t.done}
            className="flex min-h-[50px] w-full items-center gap-3 px-3.5 py-3 text-left disabled:cursor-default"
          >
            <span className={`flex size-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors ${t.done ? "border-[#6d1b52] bg-[#6d1b52]" : "border-black/20"}`}>
              {t.done && <Check className="size-3 text-white" strokeWidth={3} />}
            </span>
            <span className={`flex-1 text-body ${t.done ? "text-[#636368] line-through" : ""}`}>{t.label}</span>
            <span className="text-meta text-[#636368]">{t.done || t.status === "TODO" ? "You" : t.statusLabel}</span>
          </button>
        ))}
        {readOnly ? (
          <p className="px-3.5 py-3 text-meta text-[#6e6e73]">Staff preview: hosts add and tick their own to-dos here.</p>
        ) : (
          <div className="flex items-center gap-2 py-1.5 pl-3.5 pr-1.5">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") add();
              }}
              placeholder="Add a to-do…"
              aria-label="New to-do"
              maxLength={160}
              className="min-h-9 min-w-0 flex-1 bg-transparent text-body focus:outline-none"
            />
            <button
              type="button"
              onClick={add}
              disabled={busy || !input.trim()}
              className="h-9 rounded-[10px] bg-[#6d1b52] px-3.5 text-detail font-semibold text-[#fdf5f3] disabled:opacity-50"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : "Add"}
            </button>
          </div>
        )}
      </div>
      {error && <p className="mt-1.5 text-meta text-[#b3261e]">{error}</p>}
    </div>
  );
}
