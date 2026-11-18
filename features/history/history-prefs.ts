const COLLAPSED_KEY = "qa.chat.historyCollapsed";

/** Server render and first client render must agree: default to the compact rail. */
export function readHistoryCollapsed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) !== "0";
  } catch {
    return true;
  }
}

export function writeHistoryCollapsed(collapsed: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch {
    // Private mode / storage disabled: the toggle still works for this session.
  }
}
