"use client";
import * as React from "react";
import { adminApi, type AdminUser } from "@/lib/admin-api";
import { handoverApi, type ClassAssistant } from "@/lib/handover-api";
import { Button } from "@/components/ui/button";
import { ADMIN_INPUT } from "@/components/shared/AdminPageShell";

export function ClassAssistantManager({ classId }: { classId: string }) {
  const [assigned, setAssigned] = React.useState<ClassAssistant[]>([]);
  const [users, setUsers] = React.useState<AdminUser[]>([]);
  const [selected, setSelected] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [reload, setReload] = React.useState(0);
  React.useEffect(() => {
    let active = true;
    /* eslint-disable react-hooks/set-state-in-effect -- load the class assignment surface. */
    setLoading(true);
    setError(null);
    setSelected("");
    /* eslint-enable react-hooks/set-state-in-effect */
    Promise.all([handoverApi.listClassAssistants(classId), adminApi.users()])
      .then(([rows, accounts]) => {
        if (active) {
          setAssigned(rows);
          setUsers(
            accounts.filter(
              (user) => user.role === "teaching_assistant" && user.is_active,
            ),
          );
        }
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load assistants.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [classId, reload]);
  async function change(id: string, remove = false) {
    setBusy(true);
    setError(null);
    try {
      if (remove) await handoverApi.removeClassAssistant(classId, id);
      else await handoverApi.addClassAssistant(classId, id);
      setReload((v) => v + 1);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not update assistant assignment.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="space-y-2 border-t pt-4"
      aria-label="Class teaching assistants"
    >
      <h3 className="text-sm font-semibold">Teaching assistants</h3>
      <p className="text-xs text-[#6F6F6F]">
        Assigned assistants can receive this class&apos;s tickets during
        approved trainer leave.
      </p>
      {loading ? (
        <p role="status" className="text-sm">
          Loading assistants…
        </p>
      ) : (
        <>
          <ul className="space-y-1">
            {assigned.map((a) => (
              <li
                key={a.id}
                className="flex justify-between items-center gap-2 rounded border p-2 text-sm"
              >
                <span>
                  {a.name}{" "}
                  <span className="text-xs text-[#6F6F6F]">{a.email}</span>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void change(a.id, true)}
                  aria-label={`Remove assistant ${a.name}`}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
          {!assigned.length && (
            <p className="text-sm text-[#6F6F6F]">No assistants assigned.</p>
          )}
          <div className="flex gap-2">
            <select
              aria-label="Assign teaching assistant"
              className={ADMIN_INPUT}
              value={selected}
              disabled={busy}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">Select an assistant</option>
              {users
                .filter((user) => !assigned.some((a) => a.id === user.id))
                .map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.username} · {user.email}
                  </option>
                ))}
            </select>
            <Button
              variant="outline"
              disabled={!selected || busy}
              onClick={() => void change(selected)}
            >
              Assign
            </Button>
          </div>
        </>
      )}
      {error && (
        <div role="alert" className="text-sm text-red-700">
          {error}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setReload((v) => v + 1)}
          >
            Retry
          </Button>
        </div>
      )}
    </section>
  );
}
