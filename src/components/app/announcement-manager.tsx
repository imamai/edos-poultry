"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Announcement } from "@/lib/database.types";

function statusOf(a: Announcement, now = new Date()): "upcoming" | "active" | "ended" {
  if (new Date(a.starts_at) > now) return "upcoming";
  if (a.ends_at && new Date(a.ends_at) < now) return "ended";
  return "active";
}

const STATUS_STYLES: Record<string, string> = {
  upcoming: "bg-accent-soft text-accent-dark",
  active: "bg-success-soft text-success",
  ended: "bg-line text-ink-faint",
};

export function AnnouncementManager({ tenantId, announcements }: { tenantId: string; announcements: Announcement[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const ownAnnouncements = announcements.filter((a) => a.tenant_id === tenantId);

  async function remove(id: string) {
    const supabase = createClient();
    await supabase.from("poultryedos_announcements").delete().eq("id", id);
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-ink-soft">Announcements</p>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-full border border-line-strong px-3 py-1.5 text-sm text-ink-soft hover:border-primary"
          >
            + New announcement
          </button>
        )}
      </div>

      {adding && <AnnouncementForm tenantId={tenantId} onDone={() => setAdding(false)} />}

      <div className="mt-3 space-y-2">
        {ownAnnouncements.length === 0 && !adding && (
          <p className="rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-ink-faint">
            No announcements yet.
          </p>
        )}
        {ownAnnouncements.map((a) =>
          editingId === a.id ? (
            <AnnouncementForm key={a.id} tenantId={tenantId} initial={a} onDone={() => setEditingId(null)} />
          ) : (
            <div key={a.id} className="rounded-xl border border-line bg-paper-raised px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[statusOf(a)]}`}>{statusOf(a)}</span>
                  <p className="mt-1.5 font-medium text-ink">{a.title}</p>
                  <p className="mt-1 text-sm text-ink-faint">{a.body}</p>
                </div>
                <div className="flex shrink-0 gap-2 text-xs">
                  <button type="button" onClick={() => setEditingId(a.id)} className="text-primary hover:underline">
                    Edit
                  </button>
                  <button type="button" onClick={() => remove(a.id)} className="text-danger hover:underline">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

function AnnouncementForm({
  tenantId,
  initial,
  onDone,
}: {
  tenantId: string;
  initial?: Announcement;
  onDone: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [startsAt, setStartsAt] = useState(initial?.starts_at.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [endsAt, setEndsAt] = useState(initial?.ends_at?.slice(0, 10) ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const payload = {
      tenant_id: tenantId,
      title,
      body,
      starts_at: new Date(startsAt).toISOString(),
      ends_at: endsAt ? new Date(endsAt).toISOString() : null,
    };
    const { error } = initial
      ? await supabase.from("poultryedos_announcements").update(payload).eq("id", initial.id)
      : await supabase.from("poultryedos_announcements").insert(payload);
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    onDone();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3 rounded-xl border border-line bg-paper-raised p-4">
      <input
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
      />
      <textarea
        required
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="Announcement text"
        className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
      />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-ink-faint">Starts</label>
          <input
            type="date"
            required
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-ink-faint">Ends (optional)</label>
          <input
            type="date"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-3">
        <button type="button" onClick={onDone} className="rounded-full border border-line-strong px-4 py-2 text-sm text-ink-soft">
          Cancel
        </button>
        <button type="submit" disabled={busy} className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
