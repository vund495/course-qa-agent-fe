// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClassMaterials } from "./class-materials";
import { SyllabusUnitMaterials } from "./syllabus-unit-materials";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

type Status = "pending" | "processing" | "indexed" | "rejected" | "failed" | "replaced";

type DocumentRow = {
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

type MaterialRow = {
  id: string;
  file_name: string;
  status: Status;
  failure_reason: string | null;
  version: number;
  created_at: string;
};

type SyllabusPayload = {
  class_id: string;
  document_id: string | null;
  file_name: string | null;
  status: Status;
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

function documentRow(overrides: Partial<DocumentRow> = {}): DocumentRow {
  return {
    id: "new-doc",
    file_name: "new-material.md",
    file_type: ".md",
    mime_type: "text/markdown",
    size_bytes: 10,
    uploader_id: "teacher-1",
    class_id: "class-1",
    class_name: "Class 1",
    status: "pending",
    failure_reason: null,
    syllabus_document_id: null,
    syllabus_unit_number: null,
    version: 1,
    created_at: "2026-11-12T00:00:00Z",
    ...overrides,
  };
}

function materialFrom(row: DocumentRow): MaterialRow {
  return {
    id: row.id,
    file_name: row.file_name,
    status: row.status,
    failure_reason: row.failure_reason,
    version: row.version,
    created_at: row.created_at,
  };
}

function syllabus(overrides: Partial<SyllabusPayload> = {}): SyllabusPayload {
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
    ...overrides,
  };
}

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function actAndSettle(callback: () => void | Promise<void>) {
  await act(async () => {
    await callback();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function findButton(container: HTMLElement, label: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll("button")).find(
    (button) => button.textContent?.trim() === label,
  ) as HTMLButtonElement | undefined;
}

function uploadInput(container: HTMLElement, label = "Choose files to upload") {
  return container.querySelector(`input[aria-label="${label}"]`) as HTMLInputElement;
}

function chooseFile(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  return actAndSettle(() => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function unitUploadInput(container: HTMLElement) {
  return container.querySelector(
    'button[aria-label*="Add materials to Unit 1"]',
  )?.parentElement?.querySelector('input[type="file"]') as HTMLInputElement;
}

function tableRow(container: HTMLElement, fileName: string) {
  return Array.from(container.querySelectorAll("tbody tr")).find((row) =>
    row.textContent?.includes(fileName),
  );
}

describe("upload refresh behaviour", () => {
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

  it("keeps the unit spinner from blocking on a slow syllabus refresh", async () => {
    const refreshed = deferred<Response>();
    let syllabusCalls = 0;
    const uploaded = documentRow({
      id: "unit-doc",
      file_name: "unit-upload.md",
      syllabus_document_id: "syllabus-1",
      syllabus_unit_number: 1,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if ((init?.method ?? "GET").toUpperCase() === "POST" && url.endsWith("/api/documents/")) {
          return response({
            uploaded: [
              { file_name: "unit-upload.md", document: uploaded, error: null, warning: null },
            ],
          });
        }
        if (url.includes("/syllabus-units")) {
          syllabusCalls += 1;
          if (syllabusCalls === 1) return response(syllabus());
          return refreshed.promise;
        }
        return response({});
      }),
    );

    await actAndSettle(() => {
      root!.render(<SyllabusUnitMaterials classId="class-1" />);
    });
    const header = container.querySelector(
      'button[aria-controls="syllabus-unit-panel-1"]',
    ) as HTMLButtonElement;
    await actAndSettle(() => {
      header.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await chooseFile(
      unitUploadInput(container),
      new File(["note"], "unit-upload.md", { type: "text/markdown" }),
    );

    const addButton = container.querySelector(
      'button[aria-label*="Add materials to Unit 1"]',
    ) as HTMLButtonElement;
    expect(addButton.disabled).toBe(false);
    expect(container.textContent).toContain("unit-upload.md");

    refreshed.resolve(
      response(
        syllabus({
          total_material_count: 1,
          units: [
            {
              unit_number: 1,
              unit_title: "Foundations",
              description: "Unit one",
              content: "### Session 1",
              materials: [materialFrom(uploaded)],
            },
          ],
        }),
      ),
    );
    await actAndSettle(() => Promise.resolve());
    expect(container.querySelectorAll("table").length).toBe(0);
    expect(container.textContent?.match(/unit-upload\.md/g)).toHaveLength(1);
  });

  it("shows the uploaded unit material and clears the spinner when the refresh fails", async () => {
    let syllabusCalls = 0;
    const uploaded = documentRow({
      id: "unit-doc",
      file_name: "unit-upload.md",
      syllabus_document_id: "syllabus-1",
      syllabus_unit_number: 1,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if ((init?.method ?? "GET").toUpperCase() === "POST" && url.endsWith("/api/documents/")) {
          return response({
            uploaded: [
              { file_name: "unit-upload.md", document: uploaded, error: null, warning: null },
            ],
          });
        }
        if (url.includes("/syllabus-units")) {
          syllabusCalls += 1;
          if (syllabusCalls === 1) return response(syllabus());
          throw new TypeError("network down");
        }
        return response({});
      }),
    );

    await actAndSettle(() => {
      root!.render(<SyllabusUnitMaterials classId="class-1" />);
    });
    const header = container.querySelector(
      'button[aria-controls="syllabus-unit-panel-1"]',
    ) as HTMLButtonElement;
    await actAndSettle(() => {
      header.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await chooseFile(
      unitUploadInput(container),
      new File(["note"], "unit-upload.md", { type: "text/markdown" }),
    );

    const addButton = container.querySelector(
      'button[aria-label*="Add materials to Unit 1"]',
    ) as HTMLButtonElement;
    expect(addButton.disabled).toBe(false);
    expect(container.textContent).toContain("unit-upload.md");
    expect(container.textContent).toContain("network down");
  });

  it("surfaces a unit upload error instead of claiming the file was added", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if ((init?.method ?? "GET").toUpperCase() === "POST" && url.endsWith("/api/documents/")) {
          return response({
            uploaded: [
              {
                file_name: "unrelated.md",
                document: null,
                error: "The file is empty.",
              },
            ],
          });
        }
        if (url.includes("/syllabus-units")) return response(syllabus());
        return response({});
      }),
    );

    await actAndSettle(() => {
      root!.render(<SyllabusUnitMaterials classId="class-1" />);
    });
    const header = container.querySelector(
      'button[aria-controls="syllabus-unit-panel-1"]',
    ) as HTMLButtonElement;
    await actAndSettle(() => {
      header.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await chooseFile(
      unitUploadInput(container),
      new File(["note"], "unrelated.md", { type: "text/markdown" }),
    );

    expect(container.textContent).toContain("The file is empty.");
    expect(container.textContent).not.toContain("Added 1 material");
  });

  it("shows successful files from a mixed success and error batch without a reload", async () => {
    const refreshed = deferred<Response>();
    let listCalls = 0;
    const uploaded = documentRow({ id: "ok-doc", file_name: "ok.md" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        const method = (init?.method ?? "GET").toUpperCase();
        if (method === "POST" && url.endsWith("/api/documents/")) {
          return response({
            uploaded: [
              { file_name: "ok.md", document: uploaded, error: null, warning: null },
              {
                file_name: "warning.md",
                document: null,
                error: "The file is empty.",
              },
            ],
          });
        }
        if (url.includes("/syllabus-units")) {
          return response({
            ...syllabus({ document_id: "syllabus-1" }),
          });
        }
        if (url.includes("status=processing")) {
          return response({ items: [], total: 0, page: 1, page_size: 1 });
        }
        if (method === "GET" && url.includes("/api/documents/?")) {
          listCalls += 1;
          if (listCalls === 1) return response({ items: [], total: 0, page: 1, page_size: 10 });
          return refreshed.promise;
        }
        return response({});
      }),
    );

    await actAndSettle(() => {
      root!.render(<ClassMaterials classId="class-1" />);
    });
    await actAndSettle(() => {
      findButton(container, "Import materials")!.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    const input = uploadInput(container);
    Object.defineProperty(input, "files", {
      value: [
        new File(["ok"], "ok.md", { type: "text/markdown" }),
        new File(["warn"], "warning.md", { type: "text/markdown" }),
      ],
      configurable: true,
    });
    await actAndSettle(() => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await actAndSettle(() => {
      findButton(container, "Upload for approval")!.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(container.querySelector("table")?.textContent).toContain("ok.md");
    expect(container.querySelector('button[aria-label="Remove ok.md"]')).toBeNull();
    expect(container.querySelector('button[aria-label="Remove warning.md"]')).not.toBeNull();

    refreshed.resolve(
      response({ items: [uploaded], total: 1, page: 1, page_size: 10 }),
    );
    await actAndSettle(() => Promise.resolve());
    expect(container.querySelectorAll("table tbody tr")).toHaveLength(1);
  });

  it("shows Dsa.pdf as Uploading while the general POST is pending, then Pending approval", async () => {
    const post = deferred<Response>();
    const dsa = documentRow({
      id: "dsa-doc",
      file_name: "Dsa.pdf",
      file_type: ".pdf",
      mime_type: "application/pdf",
      size_bytes: 1024 * 1024,
    });
    const syllabusRow = documentRow({
      id: "syllabus-1",
      file_name: "L1_AL_DSAA_Syllabus_v2.0.xlsx",
      file_type: ".xlsx",
      mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      status: "pending",
    });
    let listCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        const method = (init?.method ?? "GET").toUpperCase();
        if (method === "POST" && url.endsWith("/api/documents/")) return post.promise;
        if (url.includes("/syllabus-units")) return response(syllabus());
        if (url.includes("status=processing")) {
          return response({ items: [], total: 0, page: 1, page_size: 1 });
        }
        if (method === "GET" && url.includes("/api/documents/?")) {
          listCalls += 1;
          const items = listCalls === 1 ? [syllabusRow] : [dsa, syllabusRow];
          return response({ items, total: items.length, page: 1, page_size: 10 });
        }
        return response({});
      }),
    );

    await actAndSettle(() => {
      root!.render(<ClassMaterials classId="class-1" />);
    });
    await actAndSettle(() => {
      findButton(container, "Import materials")!.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    await chooseFile(
      uploadInput(container),
      new File(["pdf"], "Dsa.pdf", { type: "application/pdf" }),
    );
    await actAndSettle(() => {
      findButton(container, "Upload for approval")!.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    const pendingRow = tableRow(container, "Dsa.pdf");
    expect(pendingRow?.textContent).toContain("Uploading");
    expect(pendingRow?.textContent).not.toContain("Pending approval");
    expect(findButton(container, "Uploading…")).toBeTruthy();

    post.resolve(
      response(
        {
          uploaded: [
            { file_name: "Dsa.pdf", document: dsa, error: null, warning: null },
          ],
        },
        201,
      ),
    );
    await actAndSettle(() => Promise.resolve());
    await actAndSettle(() => Promise.resolve());

    const doneRow = tableRow(container, "Dsa.pdf");
    expect(doneRow?.textContent).toContain("Pending approval");
    expect(container.querySelectorAll("tbody tr")).toHaveLength(2);
    expect(findButton(container, "Uploading…")).toBeUndefined();
  });

  it("removes the Uploading row and reports a per-file error without success", async () => {
    const post = deferred<Response>();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        const method = (init?.method ?? "GET").toUpperCase();
        if (method === "POST" && url.endsWith("/api/documents/")) return post.promise;
        if (url.includes("/syllabus-units")) return response(syllabus());
        if (url.includes("status=processing")) {
          return response({ items: [], total: 0, page: 1, page_size: 1 });
        }
        if (method === "GET" && url.includes("/api/documents/?")) {
          return response({ items: [], total: 0, page: 1, page_size: 10 });
        }
        return response({});
      }),
    );

    await actAndSettle(() => {
      root!.render(<ClassMaterials classId="class-1" />);
    });
    await actAndSettle(() => {
      findButton(container, "Import materials")!.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    await chooseFile(
      uploadInput(container),
      new File(["bad"], "Dsa.pdf", { type: "application/pdf" }),
    );
    await actAndSettle(() => {
      findButton(container, "Upload for approval")!.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    expect(tableRow(container, "Dsa.pdf")?.textContent).toContain("Uploading");

    post.resolve(
      response(
        {
          uploaded: [
            {
              file_name: "Dsa.pdf",
              document: null,
              error: "File is not a valid PDF.",
              warning: null,
            },
          ],
        },
        201,
      ),
    );
    await actAndSettle(() => Promise.resolve());

    expect(tableRow(container, "Dsa.pdf")).toBeUndefined();
    expect(container.textContent).toContain("File is not a valid PDF.");
    expect(container.querySelector('button[aria-label="Remove Dsa.pdf"]')).not.toBeNull();
    expect(container.textContent).not.toContain("Upload successful");
  });

  it("keeps a successful general upload visible when the list refresh fails", async () => {
    let listCalls = 0;
    const uploaded = documentRow({ id: "ok-doc", file_name: "ok.md" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        const method = (init?.method ?? "GET").toUpperCase();
        if (method === "POST" && url.endsWith("/api/documents/")) {
          return response({
            uploaded: [{ file_name: "ok.md", document: uploaded, error: null, warning: null }],
          });
        }
        if (url.includes("/syllabus-units")) return response(syllabus());
        if (url.includes("status=processing")) {
          return response({ items: [], total: 0, page: 1, page_size: 1 });
        }
        if (method === "GET" && url.includes("/api/documents/?")) {
          listCalls += 1;
          if (listCalls === 1) return response({ items: [], total: 0, page: 1, page_size: 10 });
          throw new TypeError("network down");
        }
        return response({});
      }),
    );

    await actAndSettle(() => {
      root!.render(<ClassMaterials classId="class-1" />);
    });
    await actAndSettle(() => {
      findButton(container, "Import materials")!.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    await chooseFile(
      uploadInput(container),
      new File(["ok"], "ok.md", { type: "text/markdown" }),
    );
    await actAndSettle(() => {
      findButton(container, "Upload for approval")!.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(container.querySelector("table")?.textContent).toContain("ok.md");
    expect(container.textContent).not.toContain("Uploading…");
    expect(container.textContent).toContain("Cannot reach backend");
  });

  it("clears the general upload state and reports a backend rejection", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        const method = (init?.method ?? "GET").toUpperCase();
        if (method === "POST" && url.endsWith("/api/documents/")) {
          return response({ detail: "Upload rejected." }, 500);
        }
        if (url.includes("/syllabus-units")) return response(syllabus());
        if (url.includes("status=processing")) {
          return response({ items: [], total: 0, page: 1, page_size: 1 });
        }
        if (method === "GET" && url.includes("/api/documents/?")) {
          return response({ items: [], total: 0, page: 1, page_size: 10 });
        }
        return response({});
      }),
    );

    await actAndSettle(() => {
      root!.render(<ClassMaterials classId="class-1" />);
    });
    await actAndSettle(() => {
      findButton(container, "Import materials")!.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    await chooseFile(
      uploadInput(container),
      new File(["bad"], "bad.md", { type: "text/markdown" }),
    );
    await actAndSettle(() => {
      findButton(container, "Upload for approval")!.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(container.textContent).toContain("Upload failed (500).");
    expect(container.textContent).not.toContain("Uploading…");
  });

  it("clears the unit spinner and reports a failed upload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if ((init?.method ?? "GET").toUpperCase() === "POST" && url.endsWith("/api/documents/")) {
          return response({ detail: "Upload rejected." }, 500);
        }
        if (url.includes("/syllabus-units")) return response(syllabus());
        return response({});
      }),
    );

    await actAndSettle(() => {
      root!.render(<SyllabusUnitMaterials classId="class-1" />);
    });
    const header = container.querySelector(
      'button[aria-controls="syllabus-unit-panel-1"]',
    ) as HTMLButtonElement;
    await actAndSettle(() => {
      header.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await chooseFile(
      unitUploadInput(container),
      new File(["note"], "broken.md", { type: "text/markdown" }),
    );

    const addButton = container.querySelector(
      'button[aria-label*="Add materials to Unit 1"]',
    ) as HTMLButtonElement;
    expect(addButton.disabled).toBe(false);
    expect(container.textContent).toContain("Upload failed: Upload rejected.");
  });
});
