// @vitest-environment jsdom
import React, { act, useCallback, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClassMaterials } from "./class-materials";
import { SyllabusUnitMaterials } from "./syllabus-unit-materials";

vi.mock("next/navigation", () => {
  const router = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };
  return { useRouter: () => router };
});

type DocumentRow = {
  id: string;
  file_name: string;
  file_type: string;
  mime_type: string;
  size_bytes: number;
  uploader_id: string;
  class_id: string;
  class_name: string;
  status: "pending" | "processing" | "indexed" | "rejected" | "failed" | "replaced";
  failure_reason: string | null;
  syllabus_document_id: string | null;
  syllabus_unit_number: number | null;
  version: number;
  created_at: string;
};

type MaterialRow = {
  id: string;
  file_name: string;
  status: DocumentRow["status"];
  failure_reason: string | null;
  version: number;
  created_at: string;
};

type SyllabusPayload = {
  class_id: string;
  document_id: string | null;
  file_name: string | null;
  status: DocumentRow["status"];
  is_draft: boolean;
  ready_material_count: number;
  total_material_count: number;
  can_approve: boolean;
  syllabus_materials: MaterialRow[];
  units: {
    unit_number: number;
    unit_title: string;
    description: string | null;
    content: string;
    materials: MaterialRow[];
  }[];
};

type Backend = {
  syllabus: SyllabusPayload;
  documents: DocumentRow[];
  calls: { url: string; method: string }[];
  attachCalls: number;
  approveCalls: number;
  listRequests: number;
};

function blankSyllabus(): SyllabusPayload {
  return {
    class_id: "class-1",
    document_id: null,
    file_name: null,
    status: "pending",
    is_draft: false,
    ready_material_count: 0,
    total_material_count: 0,
    can_approve: false,
    syllabus_materials: [],
    units: [],
  };
}

function draftSyllabus(): SyllabusPayload {
  return {
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
        unit_title: "Foundations",
        description: "Unit one",
        content: "### Session 1",
        materials: [],
      },
    ],
  };
}

function makeRow(overrides: Partial<DocumentRow> = {}): DocumentRow {
  return {
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

function materialFrom(row: DocumentRow): MaterialRow {
  return {
    id: row.id,
    file_name: row.file_name,
    status: row.status,
    failure_reason: null,
    version: 1,
    created_at: row.created_at,
  };
}

function syncMaterialStatuses(backend: Backend) {
  for (const material of backend.syllabus.syllabus_materials) {
    const row = backend.documents.find((document) => document.id === material.id);
    if (row) material.status = row.status;
  }
  for (const unit of backend.syllabus.units) {
    for (const material of unit.materials) {
      const row = backend.documents.find((document) => document.id === material.id);
      if (row) material.status = row.status;
    }
  }
}

function syncCounts(backend: Backend) {
  const linked = backend.documents.filter(
    (document) =>
      backend.syllabus.document_id !== null &&
      document.syllabus_document_id === backend.syllabus.document_id,
  );
  backend.syllabus.total_material_count = linked.length;
  backend.syllabus.ready_material_count = linked.filter(
    (document) => document.status === "indexed",
  ).length;
  backend.syllabus.can_approve = backend.syllabus.ready_material_count > 0;
}

function attachMaterial(backend: Backend, row: DocumentRow, unitNumber: number | null) {
  row.syllabus_document_id = backend.syllabus.document_id;
  row.syllabus_unit_number = unitNumber;
  const material = materialFrom(row);
  const unit =
    unitNumber === null
      ? null
      : backend.syllabus.units.find((candidate) => candidate.unit_number === unitNumber);
  if (unit) unit.materials.push(material);
  else backend.syllabus.syllabus_materials.push(material);
  syncCounts(backend);
}

function installBackend(initial?: {
  syllabus?: SyllabusPayload;
  documents?: DocumentRow[];
}): Backend {
  const backend: Backend = {
    syllabus: initial?.syllabus ?? blankSyllabus(),
    documents: initial?.documents ?? [],
    calls: [],
    attachCalls: 0,
    approveCalls: 0,
    listRequests: 0,
  };

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const method = (init?.method ?? "GET").toUpperCase();
      const parsed = new URL(url);
      const path = parsed.pathname;
      backend.calls.push({ url, method });

      if (path.endsWith("/syllabus-units")) {
        return response(backend.syllabus);
      }
      if (parsed.searchParams.get("status") === "processing") {
        return response({ items: [], total: 0, page: 1, page_size: 1 });
      }
      if (method === "POST" && path.endsWith("/syllabus-link")) {
        const id = decodeURIComponent(path.split("/")[3] ?? "");
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          syllabus_document_id: string;
          unit_number: number | null;
        };
        const row = backend.documents.find((document) => document.id === id);
        backend.attachCalls += 1;
        if (row) attachMaterial(backend, row, body.unit_number);
        return response(row ?? makeRow({ id }));
      }
      if (method === "POST" && path.endsWith("/approve")) {
        const id = decodeURIComponent(path.split("/")[3] ?? "");
        backend.approveCalls += 1;
        if (id === backend.syllabus.document_id) {
          backend.syllabus.status = "processing";
        }
        const row = backend.documents.find((document) => document.id === id);
        if (row) row.status = "processing";
        syncMaterialStatuses(backend);
        syncCounts(backend);
        return response(row ?? makeRow({ id, status: "processing" }));
      }
      if (method === "POST" && path.endsWith("/reject")) {
        const id = decodeURIComponent(path.split("/")[3] ?? "");
        const row = backend.documents.find((document) => document.id === id);
        if (row) row.status = "rejected";
        syncMaterialStatuses(backend);
        syncCounts(backend);
        return response(row ?? makeRow({ id, status: "rejected" }));
      }
      if (method === "POST" && path.endsWith("/api/documents/")) {
        const form = init?.body as FormData;
        const formFiles = form.getAll("files") as File[];
        const syllabusId = form.get("syllabus_document_id");
        const unitNumber = form.get("unit_number");
        const uploaded = formFiles.map((file, index) => {
          const row = makeRow({
            id: `doc-${backend.documents.length + index + 1}`,
            file_name: file.name,
            file_type: file.name.slice(file.name.lastIndexOf(".")),
            mime_type: file.type || "text/markdown",
            size_bytes: file.size,
            syllabus_document_id: syllabusId ? String(syllabusId) : null,
            syllabus_unit_number: unitNumber ? Number(unitNumber) : null,
          });
          backend.documents.push(row);
          if (!syllabusId && !backend.syllabus.document_id && /syllabus/i.test(file.name)) {
            backend.syllabus = {
              ...draftSyllabus(),
              document_id: row.id,
              file_name: row.file_name,
            };
          } else if (syllabusId && unitNumber) {
            attachMaterial(backend, row, Number(unitNumber));
          }
          return { file_name: file.name, error: null, warning: null, document: row };
        });
        return response({ uploaded });
      }
      if (method === "GET" && path.endsWith("/api/documents/")) {
        backend.listRequests += 1;
        const search = (parsed.searchParams.get("search") ?? "").toLowerCase();
        const status = parsed.searchParams.get("status");
        const fileType = parsed.searchParams.get("file_type");
        const page = Number(parsed.searchParams.get("page") ?? "1");
        const pageSize = Number(parsed.searchParams.get("page_size") ?? "10");
        const filtered = backend.documents.filter(
          (document) =>
            (!search || document.file_name.toLowerCase().includes(search)) &&
            (!status || document.status === status) &&
            (!fileType || document.file_type === fileType),
        );
        return response({
          items: filtered.slice((page - 1) * pageSize, page * pageSize),
          total: filtered.length,
          page,
          page_size: pageSize,
        });
      }
      return response({});
    }),
  );

  return backend;
}

function Harness() {
  const [refresh, setRefresh] = useState({ token: 0, source: "initial" });
  const changed = useCallback((source: string) => {
    setRefresh((current) => ({ token: current.token + 1, source }));
  }, []);
  return (
    <>
      <SyllabusUnitMaterials
        classId="class-1"
        refreshKey={refresh.token}
        changeSource={refresh.source}
        onChanged={changed}
      />
      <ClassMaterials
        classId="class-1"
        refreshKey={refresh.token}
        changeSource={refresh.source}
        onDataChanged={changed}
      />
    </>
  );
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

function findButton(container: HTMLElement, label: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll("button")).find(
    (button) => button.textContent?.trim() === label,
  ) as HTMLButtonElement | undefined;
}

function unitHeader(container: HTMLElement): HTMLButtonElement {
  return container.querySelector(
    'button[aria-controls="syllabus-unit-panel-1"]',
  ) as HTMLButtonElement;
}

async function click(element: Element | undefined) {
  expect(element).toBeTruthy();
  await act(async () => {
    element!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function chooseFile(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function render(root: Root, node: React.ReactNode) {
  return act(async () => {
    root.render(node);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("sibling refresh integration", () => {
  let root: Root | null = null;
  let container: HTMLElement;

  beforeEach(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    localStorage.setItem("qa.auth.token", "test-token");
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
  });

  afterEach(() => {
    root?.unmount();
    root = null;
    container.remove();
    vi.unstubAllGlobals();
  });

  it("shows a unit upload in the materials table immediately, preserves expansion, and does not loop", async () => {
    const backend = installBackend({
      syllabus: draftSyllabus(),
      documents: [makeRow()],
    });
    await render(root!, <Harness />);
    await settle();

    const header = unitHeader(container);
    expect(header).toBeTruthy();
    await click(header);
    expect(header.getAttribute("aria-expanded")).toBe("true");

    const addButton = container.querySelector(
      'button[aria-label*="Add materials to Unit 1"]',
    );
    const unitInput = addButton?.parentElement?.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    await chooseFile(unitInput, new File(["note"], "unit-upload.md", { type: "text/markdown" }));
    await settle();

    expect(container.textContent).toContain("unit-upload.md");
    expect(unitHeader(container).getAttribute("aria-expanded")).toBe("true");

    const callsAfterUpload = backend.calls.length;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 250));
    });
    expect(backend.calls.length).toBe(callsAfterUpload);
  });

  it("shows a general syllabus upload in the units header and materials table immediately", async () => {
    const backend = installBackend();
    await render(root!, <Harness />);
    await settle();
    expect(container.textContent).toContain("No syllabus roadmap yet");

    await click(findButton(container, "Import materials"));
    const input = container.querySelector(
      'input[aria-label="Choose files to upload"]',
    ) as HTMLInputElement;
    await chooseFile(
      input,
      new File(["# Foundations"], "Syllabus_Draft.md", { type: "text/markdown" }),
    );
    await click(findButton(container, "Upload for approval"));
    await settle();

    expect(container.textContent).toContain("Syllabus_Draft.md");
    expect(findButton(container, "Approve syllabus")).toBeTruthy();
    expect(container.textContent).toContain("Foundations");
    expect(
      backend.calls.filter((call) => call.url.endsWith("/syllabus-units")).length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("refreshes the units gate after attach and the table after top-level approval", async () => {
    const backend = installBackend({
      syllabus: draftSyllabus(),
      documents: [
        makeRow({
          id: "dsa",
          file_name: "Dsa.pdf",
          file_type: ".pdf",
          mime_type: "application/pdf",
          status: "indexed",
        }),
      ],
    });
    await render(root!, <Harness />);
    await settle();

    const initialApprove = findButton(container, "Approve syllabus");
    expect(initialApprove).toBeTruthy();
    expect(initialApprove!.disabled).toBe(true);

    await click(findButton(container, "Attach"));
    await click(findButton(document.body, "Attach material"));
    await settle();

    const readyApprove = findButton(container, "Approve syllabus");
    expect(readyApprove).toBeTruthy();
    expect(readyApprove!.disabled).toBe(false);
    expect(container.textContent).toContain("1 ready / 1 material");
    expect(container.querySelector("table")?.textContent).toContain("Dsa.pdf");
    expect(container.textContent).not.toContain("Syllabus-level materials");

    await click(readyApprove);
    await settle();

    expect(backend.approveCalls).toBe(1);
    expect(backend.syllabus.status).toBe("processing");
    expect(container.textContent).toContain("Syllabus approved and processing.");
    expect(findButton(container, "Approve syllabus")).toBeUndefined();
    expect(container.textContent).toContain("Dsa.pdf");
    expect(container.querySelector("table")?.textContent).toContain("Indexed");
  });

  it("keeps the active search filter and warns when a new upload is hidden", async () => {
    installBackend({
      syllabus: draftSyllabus(),
      documents: [makeRow()],
    });
    await render(root!, <Harness />);
    await settle();

    const searchInput = container.querySelector(
      'input[aria-label="Search materials by file name"]',
    ) as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
        searchInput,
        "Syllabus",
      );
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
    expect(searchInput.value).toBe("Syllabus");

    await click(unitHeader(container));
    const addButton = container.querySelector(
      'button[aria-label*="Add materials to Unit 1"]',
    );
    const unitInput = addButton?.parentElement?.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    await chooseFile(unitInput, new File(["note"], "unit-note.md", { type: "text/markdown" }));
    await settle();

    expect(container.textContent).toContain(
      "New or updated uploads may be hidden by the current search or filters.",
    );
    expect(searchInput.value).toBe("Syllabus");
    expect(container.textContent).toContain("Syllabus_Draft.md");
    expect(container.querySelector("table")?.textContent).not.toContain("unit-note.md");
    expect(container.textContent).toContain("unit-note.md");
  });
});

describe("stale response guard", () => {
  let root: Root | null = null;
  let container: HTMLElement;

  beforeEach(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    localStorage.setItem("qa.auth.token", "test-token");
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
  });

  afterEach(() => {
    root?.unmount();
    root = null;
    container.remove();
    vi.unstubAllGlobals();
  });

  it("ignores an older list response that resolves after a newer refresh", async () => {
    let listRequests = 0;
    const pending: ((value: Response) => void)[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/syllabus-units")) {
          return response({ ...blankSyllabus() });
        }
        if (url.includes("status=processing")) {
          return response({ items: [], total: 0, page: 1, page_size: 1 });
        }
        if ((init?.method ?? "GET") === "GET" && url.includes("/api/documents/?")) {
          listRequests += 1;
          return new Promise<Response>((resolve) => {
            pending.push(resolve);
          });
        }
        return response({});
      }),
    );

    await render(root!, <ClassMaterials classId="class-1" refreshKey={0} />);
    expect(listRequests).toBe(1);

    await render(
      root!,
      <ClassMaterials classId="class-1" refreshKey={1} changeSource="units" />,
    );
    expect(listRequests).toBe(2);

    pending[1](
      response({
        items: [makeRow({ id: "new", file_name: "new-material.md" })],
        total: 1,
      }),
    );
    await settle();
    expect(container.textContent).toContain("new-material.md");

    pending[0](
      response({
        items: [makeRow({ id: "old", file_name: "old-material.md" })],
        total: 1,
      }),
    );
    await settle();
    expect(container.textContent).toContain("new-material.md");
    expect(container.textContent).not.toContain("old-material.md");
  });
});
