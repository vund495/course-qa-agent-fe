// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClassMaterials } from "./class-materials";

vi.mock("next/navigation", () => {
  const router = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };
  return { useRouter: () => router };
});

type Status = "pending" | "processing" | "indexed" | "rejected" | "failed" | "replaced";

type Row = {
  id: string;
  file_name: string;
  file_type: string;
  mime_type: string;
  size_bytes: number;
  uploader_id: string;
  class_id: string;
  class_name: string;
  status: Status;
  failure_reason: string | null;
  syllabus_document_id: string | null;
  syllabus_unit_number: number | null;
  version: number;
  created_at: string;
};

function row(status: Status, overrides: Partial<Row> = {}): Row {
  return {
    id: "material-1",
    file_name: "material.pdf",
    file_type: ".pdf",
    mime_type: "application/pdf",
    size_bytes: 100,
    uploader_id: "teacher-1",
    class_id: "class-1",
    class_name: "Class 1",
    status,
    failure_reason: null,
    syllabus_document_id: null,
    syllabus_unit_number: null,
    version: 1,
    created_at: "2026-11-09T00:00:00Z",
    ...overrides,
  };
}

function response(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}

let currentRows: Row[] = [];
let replacementPosts = 0;

function installFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const value = String(input);
      if (value.includes("/syllabus-units")) {
        return response({
          class_id: "class-1",
          document_id: "syllabus-1",
          file_name: "Syllabus_Draft.md",
          status: "pending",
          is_draft: true,
          ready_material_count: 0,
          total_material_count: 0,
          can_approve: false,
          syllabus_materials: [],
          units: [
            {
              unit_number: 1,
              unit_title: "Unit 1",
              description: null,
              content: "Session",
              materials: [],
            },
          ],
        });
      }
      if (value.includes("status=processing")) {
        return response({ items: [], total: 0, page: 1, page_size: 1 });
      }
      if ((init?.method ?? "GET") === "POST" && value.endsWith("/api/documents/")) {
        replacementPosts += 1;
        return response({
          uploaded: [{ file_name: "material.pdf", document: currentRows[0], error: null }],
        });
      }
      return response({ items: currentRows, total: currentRows.length, page: 1, page_size: 10 });
    }),
  );
}

async function render(
  root: Root,
  node: React.ReactNode,
): Promise<void> {
  await act(async () => {
    root.render(node);
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

function actionLabels(container: HTMLElement): string[] {
  const cell = container.querySelector("tbody tr td:last-child");
  return Array.from(cell?.querySelectorAll("button") ?? []).map(
    (button) => button.textContent?.trim() ?? "",
  );
}

function findButton(container: HTMLElement, label: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll("button")).find(
    (button) => button.textContent?.trim() === label,
  ) as HTMLButtonElement | undefined;
}

async function click(element: Element | undefined) {
  expect(element).toBeTruthy();
  await act(async () => {
    element!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("ClassMaterials action visibility", () => {
  let root: Root | null = null;
  let container: HTMLElement;

  beforeEach(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    localStorage.setItem("qa.auth.token", "test-token");
    replacementPosts = 0;
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    installFetch();
  });

  afterEach(() => {
    root?.unmount();
    root = null;
    container.remove();
    vi.unstubAllGlobals();
  });

  for (const status of [
    "pending",
    "processing",
    "indexed",
    "rejected",
    "failed",
    "replaced",
  ] as const) {
    it(`shows Replace only for indexed documents (${status})`, async () => {
      currentRows = [row(status)];
      await render(root!, <ClassMaterials classId="class-1" />);
      const labels = actionLabels(container);
      expect(labels.includes("Replace")).toBe(status === "indexed");
      expect(labels.includes("Delete")).toBe(true);
      expect(labels.includes("Download")).toBe(
        status !== "replaced" && status !== "pending",
      );
    });
  }

  it("hides Replace and the duplicate Approve on a pending syllabus row", async () => {
    currentRows = [
      row("pending", {
        id: "syllabus-1",
        file_name: "Syllabus_Draft.pdf",
        file_type: ".pdf",
      }),
    ];
    await render(root!, <ClassMaterials classId="class-1" />);
    const labels = actionLabels(container);
    expect(labels).toContain("Reject");
    expect(labels).toContain("Delete");
    expect(labels).not.toContain("Download");
    expect(labels).not.toContain("Approve");
    expect(labels).not.toContain("Replace");
  });

  it("keeps Replace visible for an indexed material and Delete/Download usable", async () => {
    currentRows = [row("indexed", { id: "material-1" })];
    await render(root!, <ClassMaterials classId="class-1" />);
    const labels = actionLabels(container);
    expect(labels).toContain("Preview");
    expect(labels).toContain("Download");
    expect(labels).toContain("Replace");
    expect(labels).toContain("Delete");
  });

  it("blocks a replacement picker if the document is no longer indexed", async () => {
    const clickSpy = vi
      .spyOn(HTMLInputElement.prototype, "click")
      .mockImplementation(() => undefined);
    currentRows = [row("indexed", { id: "material-1" })];
    await render(root!, <ClassMaterials classId="class-1" />);

    await click(findButton(container, "Replace"));
    expect(clickSpy).toHaveBeenCalled();

    currentRows = [row("pending", { id: "material-1" })];
    await render(
      root!,
      <ClassMaterials classId="class-1" refreshKey={1} changeSource="units" />,
    );
    expect(actionLabels(container)).not.toContain("Replace");

    const input = container.querySelector(
      'input[aria-label="Choose a replacement file"]',
    ) as HTMLInputElement;
    const file = new File(["replacement"], "material.pdf", { type: "application/pdf" });
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(replacementPosts).toBe(0);
    expect(container.textContent).toContain(
      "Replace is only available after this file is approved and indexed.",
    );
    clickSpy.mockRestore();
  });
});
