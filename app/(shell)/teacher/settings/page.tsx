"use client";

import * as React from "react";
import { AdminPageShell, ADMIN_CARD } from "@/components/shared/AdminPageShell";
import { toast } from "sonner";

/**
 * Workspace notifications. There is no theme picker (the product is light-only)
 * and no language picker (the interface is English-only), so the page no longer
 * pretends those settings exist.
 */
export default function GlobalSettingsPage() {
  const [prefs, setPrefs] = React.useState<Record<string, boolean>>({
    "New ticket received": true,
    "New proposal submitted": true,
    "New member joined": true,
    "Syllabus import status": true,
  });

  const toggle = (label: string) => {
    setPrefs((prev) => ({ ...prev, [label]: !prev[label] }));
    toast.success("Notification preferences saved.");
  };

  return (
    <AdminPageShell title="Settings" subtitle="Notifications for activity in your classes.">
      <div className={`${ADMIN_CARD} p-6`}>
        <h2 className="mb-1 text-[16px] font-bold text-foreground">Notifications</h2>
        <p className="mb-4 text-[13px] text-muted-foreground">
          Get notified about activity in your classes.
        </p>
        <div className="space-y-3">
          {Object.entries(prefs).map(([label, checked]) => (
            <label key={label} className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(label)}
                className="size-4 rounded border-border accent-[var(--brand)]"
              />
              <span className="text-[13.5px] text-foreground">{label}</span>
            </label>
          ))}
        </div>
      </div>
    </AdminPageShell>
  );
}
