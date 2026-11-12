// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SyllabusUnitMaterials } from "./syllabus-unit-materials";

const PAYLOAD = {
  class_id: "class-1",
  document_id: "syllabus-1",
  file_name: "Syllabus_Draft.md",
  status: "pending",
  is_draft: true,
  ready_material_count: 1,
  total_material_count: 2,
  can_approve: true,
  units: [
    {
      unit_number: 1,
      unit_title: "Python Basics",
      description: "Introduction",
      content: "### Session 1\n- Intro",
      materials: [
        {
          id: "material-1",
          file_name: "unit-one.md",
          status: "indexed",
          failure_reason: null,
          version: 1,
          created_at: "2026-11-09T00:00:00Z",
        },
        {
          id: "material-2",
          file_name: "unit-one-extra.md",
          status: "processing",
          failure_reason: null,
          version: 1,
          created_at: "2026-11-09T00:00:00Z",
        },
      ],
    },
    {
      unit_number: 2,
      unit_title: "Advanced OOP",
      description: null,
      content: "### Session 2\n- OOP",
      materials: [],
    },
  ],
};

function mockResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response;
}

async function click(element: Element) {
  await act(async () => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });
}

async function render(): Promise<{ root: Root; container: HTMLElement }> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<SyllabusUnitMaterials classId="class-1" />);
    await Promise.resolve();
  });
  return { root, container };
}

function unitHeader(container: HTMLElement, unitNumber: number): HTMLButtonElement {
  return container.querySelector(
    `button[aria-controls="syllabus-unit-panel-${unitNumber}"]`,
  ) as HTMLButtonElement;
}

describe("SyllabusUnitMaterials accordion", () => {
  let root: Root | null = null;

  beforeEach(() => {
    localStorage.setItem("qa.auth.token", "test-token");
    vi.stubGlobal("fetch", vi.fn(async () => mockResponse(PAYLOAD)));
  });

  afterEach(() => {
    root?.unmount();
    root = null;
    vi.unstubAllGlobals();
  });

  it("starts collapsed and expands only the clicked unit", async () => {
    const rendered = await render();
    root = rendered.root;
    const { container } = rendered;
    expect(container.textContent).toContain("Python Basics");
    expect(container.textContent).toContain("Advanced OOP");
    expect(container.textContent).not.toContain("unit-one.md");
    expect(container.textContent).not.toContain("No materials yet");
    expect(container.querySelector('button[aria-label*="Unit 1"]')).toBeNull();
    expect(container.querySelector('button[aria-label*="Unit 2"]')).toBeNull();

    const unitOne = unitHeader(container, 1);
    const unitTwo = unitHeader(container, 2);
    expect(unitOne.getAttribute("aria-expanded")).toBe("false");
    expect(unitTwo.getAttribute("aria-expanded")).toBe("false");

    await click(unitOne);
    expect(unitOne.getAttribute("aria-expanded")).toBe("true");
    expect(unitTwo.getAttribute("aria-expanded")).toBe("false");
    expect(container.textContent).toContain("unit-one.md");
    expect(container.textContent).toContain("Ready");
    expect(container.textContent).toContain("Processing");
    expect(container.textContent).toContain("Intro");
    expect(container.querySelector('button[aria-label*="Unit 1"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label*="Unit 2"]')).toBeNull();
    expect(container.textContent).not.toContain("No materials yet");

    await click(unitOne);
    expect(unitOne.getAttribute("aria-expanded")).toBe("false");
    expect(container.textContent).not.toContain("unit-one.md");
    expect(container.querySelector('button[aria-label*="Unit 1"]')).toBeNull();
  });

  it("resets expansion when the syllabus document changes, not on same-syllabus refresh", async () => {
    const rendered = await render();
    root = rendered.root;
    await click(unitHeader(rendered.container, 1));
    expect(unitHeader(rendered.container, 1).getAttribute("aria-expanded")).toBe("true");

    await act(async () => {
      root!.render(<SyllabusUnitMaterials classId="class-1" refreshKey={1} />);
      await Promise.resolve();
    });
    expect(unitHeader(rendered.container, 1).getAttribute("aria-expanded")).toBe("true");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => mockResponse({ ...PAYLOAD, document_id: "syllabus-2" })),
    );
    await act(async () => {
      root!.render(<SyllabusUnitMaterials classId="class-1" refreshKey={2} />);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(unitHeader(rendered.container, 1).getAttribute("aria-expanded")).toBe("false");
  });

  it("shows the material empty state only after expanding an empty unit", async () => {
    const rendered = await render();
    root = rendered.root;
    const { container } = rendered;

    expect(container.textContent).not.toContain("No materials yet");
    await click(unitHeader(container, 2));
    expect(container.textContent).toContain("No materials yet - you can add them later.");
    expect(container.textContent).not.toContain("unit-one.md");
  });

  it("exposes an accessible header and per-unit upload button with aria metadata", async () => {
    const rendered = await render();
    root = rendered.root;
    const { container } = rendered;
    const unitOne = unitHeader(container, 1);
    expect(unitOne.tagName).toBe("BUTTON");
    expect(unitOne.id).toBe("syllabus-unit-header-1");
    expect(unitOne.getAttribute("aria-controls")).toBe("syllabus-unit-panel-1");

    await click(unitOne);
    const uploadButton = container.querySelector(
      'button[aria-label*="Unit 1"]',
    ) as HTMLButtonElement | null;
    expect(uploadButton).not.toBeNull();
    expect(uploadButton?.getAttribute("aria-label")).toContain("Python Basics");
    expect(uploadButton?.getAttribute("aria-label")).toContain("Unit 1");
    expect(uploadButton?.tabIndex).toBe(0);
    const input = uploadButton?.parentElement?.querySelector('input[type="file"]');
    expect(input?.getAttribute("tabindex")).toBe("-1");
    expect(input?.getAttribute("aria-hidden")).toBe("true");
  });

  it("uploads to the unit whose panel is expanded and keeps that unit expanded", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(url), init });
        if (String(url).endsWith("/api/documents/") && init?.method === "POST") {
          return mockResponse({ uploaded: [{ file_name: "new.md", document: null, error: null }] });
        }
        return mockResponse(PAYLOAD);
      }),
    );
    const rendered = await render();
    root = rendered.root;
    const { container } = rendered;
    const unitOne = unitHeader(container, 1);
    await click(unitOne);

    const input = container.querySelector(
      'button[aria-label*="Unit 1"]',
    )?.parentElement?.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["note"], "new.md", { type: "text/markdown" });
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(unitOne.getAttribute("aria-expanded")).toBe("true");
    const form = calls.find(
      (call) => call.url.endsWith("/api/documents/") && call.init?.method === "POST",
    )?.init?.body as FormData;
    expect(form).toBeDefined();
    expect(form.get("syllabus_document_id")).toBe("syllabus-1");
    expect(form.get("unit_number")).toBe("1");
  });

  it("does not duplicate syllabus-level materials in a panel above the materials table", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        mockResponse({
          ...PAYLOAD,
          ready_material_count: 2,
          total_material_count: 3,
          syllabus_materials: [
            {
              id: "dsa",
              file_name: "Dsa.pdf",
              status: "indexed",
              failure_reason: null,
              version: 1,
              created_at: "2026-11-09T00:00:00Z",
            },
          ],
        }),
      ),
    );
    const rendered = await render();
    root = rendered.root;
    const { container } = rendered;

    expect(container.textContent).toContain("2 ready / 3 materials");
    expect(container.textContent).not.toContain("Syllabus-level materials");
    expect(container.textContent).not.toContain("Dsa.pdf");

    await click(unitHeader(container, 1));
    expect(container.textContent).toContain("unit-one.md");
    expect(container.textContent).toContain("unit-one-extra.md");
  });

  it("explains why approval is blocked when no material is ready", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        mockResponse({
          ...PAYLOAD,
          can_approve: false,
          ready_material_count: 0,
          units: PAYLOAD.units.map((unit) => ({
            ...unit,
            materials: unit.materials.map((material) => ({
              ...material,
              status: "pending",
            })),
          })),
        }),
      ),
    );
    const rendered = await render();
    root = rendered.root;
    expect(rendered.container.textContent).toContain("Approval is blocked");
    expect(rendered.container.textContent).toContain("at least one material in any unit");
    const approve = Array.from(rendered.container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Approve syllabus",
    ) as HTMLButtonElement | undefined;
    expect(approve).toBeDefined();
    expect(approve?.disabled).toBe(true);
    expect(approve?.title).toContain("at least one ready material");
  });

  it("enables and submits the top Approve syllabus action when the gate is open", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        const value = String(url);
        calls.push(value);
        if (value.includes("/approve")) {
          return mockResponse({
            ...PAYLOAD,
            id: "syllabus-1",
            file_name: "Syllabus_Draft.md",
            file_type: ".md",
            mime_type: "text/markdown",
            size_bytes: 100,
            uploader_id: "teacher-1",
            class_name: "Class 1",
            failure_reason: null,
            version: 1,
            created_at: "2026-11-09T00:00:00Z",
            status: "processing",
          });
        }
        return mockResponse(PAYLOAD);
      }),
    );
    const rendered = await render();
    root = rendered.root;
    const approve = Array.from(rendered.container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Approve syllabus",
    ) as HTMLButtonElement | undefined;
    expect(approve).toBeDefined();
    expect(approve?.disabled).toBe(false);
    await click(approve!);
    expect(calls.some((url) => url.includes("/api/documents/syllabus-1/approve"))).toBe(true);
  });

  it("embedded mode exposes unit material controls without duplicating the roadmap outline", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const embeddedRoot = createRoot(container);
    root = embeddedRoot;
    await act(async () => {
      embeddedRoot.render(<SyllabusUnitMaterials classId="class-1" embedded />);
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Unit materials");
    expect(container.textContent).toContain("Python Basics");
    expect(container.textContent).toContain("+ Add materials");
    expect(container.textContent).not.toContain("Hide outline");
    expect(container.textContent).not.toContain("Draft preview");
    expect(container.textContent).toContain("unit-one.md");
  });
});
