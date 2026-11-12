// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClassMaterials } from "./class-materials";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

const documentRow = {
  id: "syllabus-1",
  file_name: "Syllabus_Draft.md",
  file_type: ".md",
  mime_type: "text/markdown",
  size_bytes: 100,
  uploader_id: "teacher-1",
  class_id: "class-1",
  class_name: "Class 1",
  status: "pending",
  failure_reason: null,
  version: 1,
  created_at: "2026-11-09T00:00:00Z",
};

function response(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response;
}

function installFetch(canApprove: boolean, row = documentRow) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL | Request) => {
      const value = String(url);
      if (value.includes("/syllabus-units")) {
        return response({
          class_id: "class-1",
          document_id: "syllabus-1",
          file_name: "Syllabus_Draft.md",
          status: "pending",
          is_draft: true,
          ready_material_count: canApprove ? 1 : 0,
          total_material_count: 0,
          can_approve: canApprove,
          units: [],
        });
      }
      if (value.includes("status=processing")) {
        return response({ items: [], total: 0, page: 1, page_size: 1 });
      }
      return response({ items: [row], total: 1, page: 1, page_size: 10 });
    }),
  );
}

async function render(classId: string): Promise<{ root: Root; container: HTMLElement }> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<ClassMaterials classId={classId} />);
    await Promise.resolve();
    await Promise.resolve();
  });
  return { root, container };
}

function approveButton(container: HTMLElement): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll("button")).find(
    (button) => button.textContent?.trim() === "Approve",
  ) as HTMLButtonElement | undefined;
}

describe("ClassMaterials syllabus approval ownership (AI-166)", () => {
  let root: Root | null = null;

  beforeEach(() => {
    localStorage.setItem("qa.auth.token", "test-token");
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  });

  afterEach(() => {
    root?.unmount();
    root = null;
    vi.unstubAllGlobals();
  });

  it("does not duplicate the syllabus Approve CTA inside the materials table", async () => {
    installFetch(false);
    const rendered = await render("class-1");
    root = rendered.root;
    expect(approveButton(rendered.container)).toBeUndefined();
  });

  it("keeps material approval independent from the syllabus gate", async () => {
    installFetch(false, {
      ...documentRow,
      id: "material-1",
      file_name: "unit-note.md",
      status: "pending",
    });
    const rendered = await render("class-2");
    root = rendered.root;
    const button = approveButton(rendered.container);
    expect(button).toBeDefined();
    expect(button?.disabled).toBe(false);
  });
});
