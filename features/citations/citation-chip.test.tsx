// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CitationChip } from "./citation-chip";
import { AUTH_TOKEN_KEY } from "@/components/ui/nav-config";
import type { ChatCitation } from "@/lib/sse";

vi.mock("next/navigation", () => ({
  usePathname: () => "/student/class/c1/agent",
  useParams: () => ({ id: "c1" }),
}));

const citation: ChatCitation = {
  index: 1,
  kind: "curriculum",
  title: "Dsa.pdf",
  url: null,
  snippet: "Passage",
  documentId: "doc-1",
  page: 12,
  pages: [12],
  pageLabel: "12",
  section: "Dsa.pdf > 1.1 Introduction",
  indexes: [1],
  highlights: ["Passage"],
};

describe("inline curriculum citation", () => {
  let host: HTMLDivElement;
  let root: Root;
  let viewer: { opener: unknown; location: { href: string }; close: () => void };
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    localStorage.clear();
    localStorage.setItem(AUTH_TOKEN_KEY, "token-1");

    viewer = { opener: null, location: { href: "" }, close: vi.fn() };
    vi.spyOn(window, "open").mockReturnValue(viewer as unknown as Window);
    fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      blob: async () => new Blob(["%PDF-1.7"], { type: "application/pdf" }),
      json: async () => ({}),
    }));
    vi.stubGlobal("fetch", fetchMock);

    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:cited-pdf"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });

    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows a short real-metadata label and keeps the full name in the tooltip", async () => {
    await act(async () => {
      root.render(<CitationChip citation={citation} variant="inline" marker={1} />);
    });

    const button = host.querySelector("button");
    expect(button).not.toBeNull();
    expect(button?.textContent).toBe("Dsa · Mục 1.1 · Trang 12");
    expect(button?.getAttribute("aria-label")).toBe(
      "Dsa · Mục 1.1 · Trang 12",
    );
    expect(button?.getAttribute("title")).toContain("Dsa.pdf");
    expect(button?.getAttribute("title")).toContain("1.1 Introduction");
    expect(button?.getAttribute("title")).toContain("Trang 12");

    await act(async () => {
      button?.click();
    });

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toBe("http://localhost:8000/api/chat/sources/doc-1");
    expect(init.method).toBeUndefined();
    expect(init.body).toBeUndefined();
    expect(init.headers).toMatchObject({ Authorization: "Bearer token-1" });
    expect(fetchMock.mock.calls.some(([calledUrl]) => String(calledUrl).includes("/highlight"))).toBe(false);

    await vi.waitFor(() =>
      expect(viewer.location.href).toBe("blob:cited-pdf#page=12"),
    );
  });

  it("opens the class syllabus for a syllabus inline citation without fetching", async () => {
    const syllabusCitation: ChatCitation = {
      ...citation,
      title: "Class Syllabus.pdf",
      page: null,
      pages: [],
      pageLabel: null,
      section: "Chapter 1 > Introduction",
    };

    await act(async () => {
      root.render(<CitationChip citation={syllabusCitation} variant="inline" />);
    });

    const button = host.querySelector("button");
    await act(async () => {
      button?.click();
    });

    expect(window.open).toHaveBeenCalledWith(
      "/student/class/c1/syllabus",
      "_blank",
      "noopener,noreferrer",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("renders a clean source-list label without markup or filename", async () => {
    await act(async () => {
      root.render(<CitationChip citation={citation} />);
    });

    const button = host.querySelector("button");
    expect(button?.textContent).toBe(
      "[1] Dsa · 1.1 Introduction · Trang 12",
    );
    expect(host.textContent).not.toContain(".pdf");
  });
});
