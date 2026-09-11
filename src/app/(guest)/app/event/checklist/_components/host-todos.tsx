"use client";

import * as React from "react";
import { Check, Loader2 } from "lucide-react";
import { addGuestTodo, toggleGuestTodo, type GuestTodo } from "@/actions/guest-host.actions";

/** The host's own tickable list. Rows are real tasks on the booking, so the coordinator sees them too. */
export function HostTodos({ bookingId, initial }: { bookingId: string; initial: GuestTodo[] }) {
  const [todos, setTodos] = React.useState(initial);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const done = todos.filter((t) => t.done).length;

  async function add() {
    const title = input.trim(); if (!title) return;
    setBusy(true); setError(null);
    const res = await addGuestTodo(bookingId, title);
    setBusy(false);
    if (!res.success) return setError(res.error);
    setTodos((t) => [...t, res.data]); setInput("");
  }
  async function toggle(t: GuestTodo) {
    setTodos((x) => x.map((y) => (y.id === t.id ? { ...y, done: !y.done } : y)));
    const res = await toggleGuestTodo(t.id);
    if (!res.success) { setTodos((x) => x.map((y) => (y.id === t.id ? { ...y, done: t.done } : y))); setError(res.error); }
  }

  return (
    <div>
      <div className="flex items-baseline justify-between"><div className="text-copy font-semibold">Your to-dos</div>{todos.length > 0 && <div className="numeric text-meta font-medium text-[#6e6e73]">{done} of {todos.length}</div>}</div>
      <div className="vg-card vg-divide mt-2.5 overflow-hidden rounded-2xl">
        {todos.map((t) => (
          <button key={t.id} type="button" onClick={() => toggle(t)} className="flex min-h-[50px] w-full items-center gap-3 px-3.5 py-3 text-left">
            <span className={`flex size-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors ${t.done ? "border-[#6d1b52] bg-[#6d1b52]" : "border-black/20"}`}>{t.done && <Check className="size-3 text-white" strokeWidth={3} />}</span>
            <span className={`flex-1 text-body ${t.done ? "text-[#8a8a8e] line-through" : ""}`}>{t.label}</span>
            <span className="text-meta text-[#8a8a8e]">You</span>
          </button>
        ))}
        <div className="flex items-center gap-2 py-1.5 pl-3.5 pr-1.5">
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Add a to-do…" className="min-h-9 min-w-0 flex-1 bg-transparent text-body focus:outline-none" />
          <button type="button" onClick={add} disabled={busy || !input.trim()} className="h-9 rounded-[10px] bg-[#6d1b52] px-3.5 text-detail font-semibold text-[#fdf5f3] disabled:opacity-50">{busy ? <Loader2 className="size-4 animate-spin" /> : "Add"}</button>
        </div>
      </div>
      {error && <p className="mt-1.5 text-meta text-[#b3261e]">{error}</p>}
    </div>
  );
}
