// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { studentApi } from "@/lib/student-api";
import { TeacherAttendancePage } from "./teacher-attendance-page";

const replace = vi.fn();
const router = { replace };
let queryClassId = "";

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => ({ get: () => queryClassId }),
}));

vi.mock("@/lib/student-api", () => ({ studentApi: { classes: vi.fn() } }));

vi.mock("@/components/ui/app-select", () => ({
  AppSelect: ({ value, onValueChange, options, id }: {
    value: string;
    onValueChange: (value: string) => void;
    options: { value: string; label: string }[];
    id: string;
  }) => (
    <select id={id} aria-label="Filter attendance by class" value={value} onChange={(event) => onValueChange(event.target.value)}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  ),
}));

vi.mock("./teacher-attendance-workspace", () => ({
  TeacherAttendanceWorkspace: ({ classId, classFilter }: { classId: string; classFilter: React.ReactNode }) => (
    <div data-testid="attendance-workspace" data-class-id={classId}>{classFilter}</div>
  ),
}));

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  queryClassId = "";
  replace.mockReset();
  vi.mocked(studentApi.classes).mockResolvedValue([
    { id: "class-a", code: "A01", name: "Class A" },
    { id: "class-b", code: "B01", name: "Class B" },
  ] as Awaited<ReturnType<typeof studentApi.classes>>);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.clearAllMocks();
});

it("selects the requested class and changes attendance through the class filter", async () => {
  queryClassId = "class-b";
  await act(async () => root.render(<TeacherAttendancePage />));

  expect(host.querySelector('[data-testid="attendance-workspace"]')?.getAttribute("data-class-id")).toBe("class-b");
  const select = host.querySelector<HTMLSelectElement>('[aria-label="Filter attendance by class"]');
  expect(select?.value).toBe("class-b");

  await act(async () => {
    if (select) {
      select.value = "class-a";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });

  expect(host.querySelector('[data-testid="attendance-workspace"]')?.getAttribute("data-class-id")).toBe("class-a");
  expect(replace).toHaveBeenCalledWith("/teacher/attendance?classId=class-a", { scroll: false });
});

it("falls back to the first assigned class when the URL has no valid class", async () => {
  queryClassId = "missing";
  await act(async () => root.render(<TeacherAttendancePage />));

  expect(host.querySelector('[data-testid="attendance-workspace"]')?.getAttribute("data-class-id")).toBe("class-a");
  expect(replace).toHaveBeenCalledWith("/teacher/attendance?classId=class-a", { scroll: false });
});
