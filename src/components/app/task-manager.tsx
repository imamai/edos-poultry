"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Farmer, FieldTask } from "@/lib/database.types";
import type { TenantMemberWithEmail } from "@/lib/data/network";

type TaskWithFarmer = FieldTask & { poultryedos_farmers: { full_name: string } | null };

export function TaskManager({
  tenantId,
  isAdmin,
  myTasks,
  allTasks,
  officers,
  farmers,
}: {
  tenantId: string;
  isAdmin: boolean;
  myTasks: TaskWithFarmer[];
  allTasks: TaskWithFarmer[];
  officers: TenantMemberWithEmail[];
  farmers: (Farmer & { farm_count: number })[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [assignedTo, setAssignedTo] = useState(officers[0]?.user_id ?? "");
  const [farmerId, setFarmerId] = useState(farmers[0]?.id ?? "");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.from("poultryedos_field_tasks").insert({
      tenant_id: tenantId,
      assigned_to: assignedTo || null,
      farmer_id: farmerId || null,
      title,
      due_date: dueDate || null,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setTitle("");
    setAdding(false);
    router.refresh();
  }

  async function toggleDone(taskId: string, done: boolean) {
    const supabase = createClient();
    await supabase.from("poultryedos_field_tasks").update({ status: done ? "done" : "open" }).eq("id", taskId);
    router.refresh();
  }

  const list = isAdmin ? allTasks : myTasks;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-medium tracking-tight text-ink">Tasks</h1>
        {isAdmin && !adding && officers.length > 0 && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-primary-dark"
          >
            + Assign task
          </button>
        )}
      </div>

      {adding && (
        <form onSubmit={handleCreate} className="mt-4 space-y-3 rounded-xl border border-line bg-paper-raised p-4">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to happen?"
            className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <select
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
          >
            {officers.map((o) => (
              <option key={o.user_id} value={o.user_id}>
                {o.email}
              </option>
            ))}
          </select>
          {farmers.length > 0 && (
            <select
              value={farmerId}
              onChange={(e) => setFarmerId(e.target.value)}
              className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="">— No specific farmer —</option>
              {farmers.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.full_name}
                </option>
              ))}
            </select>
          )}
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={() => setAdding(false)} className="rounded-full border border-line-strong px-4 py-2 text-sm text-ink-soft">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
              {busy ? "Saving…" : "Assign"}
            </button>
          </div>
        </form>
      )}

      <div className="mt-4 space-y-2">
        {list.length === 0 && !adding && (
          <p className="rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-ink-faint">
            No tasks.
          </p>
        )}
        {list.map((t) => (
          <label
            key={t.id}
            className="flex items-start gap-3 rounded-xl border border-line bg-paper-raised px-4 py-3"
          >
            <input
              type="checkbox"
              checked={t.status === "done"}
              onChange={(e) => toggleDone(t.id, e.target.checked)}
              className="mt-1 h-4 w-4"
            />
            <span className="flex-1">
              <span className={`block font-medium ${t.status === "done" ? "text-ink-faint line-through" : "text-ink"}`}>
                {t.title}
              </span>
              <span className="block text-xs text-ink-faint">
                {t.poultryedos_farmers?.full_name}
                {t.due_date && ` · Due ${new Date(t.due_date).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}`}
              </span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
