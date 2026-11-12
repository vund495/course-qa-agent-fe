"use client";
import * as React from "react";
import {
  AdminPageShell,
  ADMIN_CARD,
  ADMIN_INPUT,
} from "@/components/shared/AdminPageShell";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Modal } from "@/components/shared/Modal";
import { Button } from "@/components/ui/button";
import { holidayApi, type Holiday, type HolidayBody } from "@/lib/holiday-api";
import { adminApi, type ClassSection } from "@/lib/admin-api";

export default function AdminHolidaysPage() {
  const [year, setYear] = React.useState(new Date().getFullYear());
  const [rows, setRows] = React.useState<Holiday[]>([]);
  const [classes, setClasses] = React.useState<ClassSection[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [reload, setReload] = React.useState(0);
  const [editing, setEditing] = React.useState<Holiday | "new" | null>(null);
  const [form, setForm] = React.useState<HolidayBody>({
    date: "",
    name: "",
    type: "admin",
    scope: "system",
    class_id: null,
  });
  const [busy, setBusy] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState<Holiday | null>(null);
  React.useEffect(() => {
    let active = true;
    adminApi
      .classes()
      .then((data) => {
        if (active) setClasses(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  React.useEffect(() => {
    if (year < 1900 || year > 2200) return;
    let active = true;
    /* eslint-disable react-hooks/set-state-in-effect -- reload the selected calendar year. */
    setLoading(true);
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    holidayApi
      .list(year)
      .then((data) => {
        if (active) setRows(data);
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Could not load holidays.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [year, reload]);
  function edit(item?: Holiday) {
    setEditing(item ?? "new");
    setForm(
      item
        ? {
            date: item.date,
            name: item.name,
            type: item.type,
            scope: item.scope,
            class_id: item.class_id,
          }
        : {
            date: `${year}-01-01`,
            name: "",
            type: "admin",
            scope: "system",
            class_id: null,
          },
    );
    setFormError(null);
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!editing || busy) return;
    if (
      !form.name.trim() ||
      !form.date ||
      (form.scope === "class" && !form.class_id)
    ) {
      setFormError("Enter a date, name and applicable class.");
      return;
    }
    setBusy(true);
    setFormError(null);
    const body = {
      ...form,
      name: form.name.trim(),
      class_id: form.scope === "system" ? null : form.class_id,
    };
    try {
      if (editing === "new") await holidayApi.create(body);
      else await holidayApi.update(editing.id, body);
      setEditing(null);
      setReload((v) => v + 1);
    } catch (cause) {
      setFormError(
        cause instanceof Error ? cause.message : "Could not save holiday.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <AdminPageShell
      title="Holiday calendar"
      subtitle="Manage system and class holidays by year."
      actions={<Button onClick={() => edit()}>Add holiday</Button>}
    >
      <label className="flex max-w-xs items-center gap-3 text-sm">
        Year
        <input
          aria-label="Holiday year"
          type="number"
          min={1900}
          max={2200}
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className={ADMIN_INPUT}
        />
      </label>
      {loading ? (
        <p role="status">Loading holidays…</p>
      ) : error ? (
        <div role="alert" className="text-red-700">
          {error}
          <Button variant="outline" onClick={() => setReload((v) => v + 1)}>
            Retry
          </Button>
        </div>
      ) : !rows.length ? (
        <p className={`${ADMIN_CARD} p-6 text-sm`}>No holidays for {year}.</p>
      ) : (
        <div className={`${ADMIN_CARD} overflow-x-auto`}>
          <table className="w-full text-left text-sm">
            <thead className="border-b text-[#6F6F6F]">
              <tr>
                <th className="p-4">Date</th>
                <th>Name</th>
                <th>Scope</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="p-4 whitespace-nowrap">{item.date}</td>
                  <td>{item.name}</td>
                  <td>
                    {item.scope === "system"
                      ? "System"
                      : (classes.find((c) => c.id === item.class_id)?.code ??
                        item.class_id)}
                  </td>
                  <td className="flex gap-2 p-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => edit(item)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setDeleting(item);
                        setFormError(null);
                      }}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal
        isOpen={editing !== null}
        onClose={busy ? () => {} : () => setEditing(null)}
        title={editing === "new" ? "Add holiday" : "Edit holiday"}
        widthClass="max-w-lg"
      >
        <form className="space-y-4" onSubmit={save}>
          <label className="block text-sm">
            Name
            <input
              aria-label="Holiday name"
              required
              maxLength={200}
              className={ADMIN_INPUT}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            Date
            <input
              aria-label="Holiday date"
              type="date"
              required
              className={ADMIN_INPUT}
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            Type
            <select
              aria-label="Holiday type"
              className={ADMIN_INPUT}
              value={form.type}
              onChange={(e) =>
                setForm({
                  ...form,
                  type: e.target.value as HolidayBody["type"],
                })
              }
            >
              <option value="admin">Custom</option>
              <option value="solar">Solar calendar</option>
              <option value="lunar">Lunar calendar</option>
            </select>
          </label>
          <label className="block text-sm">
            Scope
            <select
              aria-label="Holiday scope"
              className={ADMIN_INPUT}
              value={form.scope}
              onChange={(e) =>
                setForm({
                  ...form,
                  scope: e.target.value as HolidayBody["scope"],
                  class_id: null,
                })
              }
            >
              <option value="system">System</option>
              <option value="class">Class</option>
            </select>
          </label>
          {form.scope === "class" && (
            <label className="block text-sm">
              Class
              <select
                aria-label="Holiday class"
                required
                className={ADMIN_INPUT}
                value={form.class_id ?? ""}
                onChange={(e) =>
                  setForm({ ...form, class_id: e.target.value || null })
                }
              >
                <option value="">Select class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code}
                  </option>
                ))}
              </select>
            </label>
          )}
          {formError && (
            <p role="alert" className="text-sm text-red-700">
              {formError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditing(null)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save holiday"}
            </Button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog
        isOpen={!!deleting}
        title="Delete this holiday?"
        description={
          <>
            <p>
              Remove {deleting?.name} from the calendar. Sessions will no longer
              show this holiday warning.
            </p>
            {formError && (
              <p role="alert" className="text-red-700">
                {formError}
              </p>
            )}
          </>
        }
        confirmLabel="Delete holiday"
        tone="danger"
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await holidayApi.remove(deleting.id);
            setDeleting(null);
            setReload((v) => v + 1);
          } catch (cause) {
            setFormError(
              cause instanceof Error
                ? cause.message
                : "Could not delete holiday.",
            );
          }
        }}
      />
    </AdminPageShell>
  );
}
