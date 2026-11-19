import { describe, expect, it } from "vitest";

import {
  citationFullDescription,
  citationKey,
  citationLastSectionText,
  citationShortInlineLabel,
  formatInlineCitations,
  mapHistoryCitation,
  mergeCitation,
  normalizeCitationUrl,
  uniqueCitations,
} from "./citations";
import type { ChatCitation } from "./sse";

function citation(overrides: Partial<ChatCitation> = {}): ChatCitation {
  return {
    index: 1,
    kind: "curriculum",
    title: "Quiz.pdf",
    url: null,
    snippet: "Question 6",
    documentId: "doc-quiz",
    page: 1,
    indexes: [1],
    highlights: [],
    ...overrides,
  };
}

describe("citation helpers", () => {
  it("makes provider-relative Google redirects absolute", () => {
    const token = "/goto?url=CAESabc";
    expect(normalizeCitationUrl(token)).toBe("https://www.google.com/goto?url=CAESabc");
    expect(normalizeCitationUrl("goto?url=CAESabc")).toBe(
      "https://www.google.com/goto?url=CAESabc",
    );
    expect(normalizeCitationUrl("//www.google.com/goto?url=CAESabc")).toBe(
      "https://www.google.com/goto?url=CAESabc",
    );
    expect(normalizeCitationUrl("https://example.com/article")).toBe(
      "https://example.com/article",
    );
    expect(normalizeCitationUrl(null)).toBeNull();
  });

  it("keeps the same document and page distinct from another source with the same index", () => {
    const quiz = citation();
    const logistics = citation({ title: "Logistics.pdf", documentId: "doc-logistics" });

    expect(citationKey(quiz)).not.toBe(citationKey(logistics));
  });

  it("does not append an identical streamed citation twice", () => {
    const existing = [citation()];
    const result = mergeCitation(existing, citation());

    expect(result).toBe(existing);
  });

  it("appends a citation with the same index but a different document", () => {
    const result = mergeCitation(
      [citation()],
      citation({ title: "Logistics.pdf", documentId: "doc-logistics" }),
    );

    expect(result).toHaveLength(2);
  });

  it("deduplicates persisted history while preserving order", () => {
    const first = citation();
    const second = citation({ index: 2, title: "Logistics.pdf", documentId: "doc-logistics" });

    expect(uniqueCitations([first, first, second])).toEqual([first, second]);
  });

  it("renders curriculum markers as short real-metadata labels", () => {
    const result = formatInlineCitations("A fact [1].", [
      citation({
        title: "<u>DSA</u>.pdf",
        section: "<u>DSA</u> · <i>Preface</i>",
        page: 7,
      }),
    ]);

    expect(result).toBe("A fact ([DSA · Trang 7](#citation-1)).");
    expect(result).not.toContain(".pdf");
    expect(result).not.toContain("<u>");
    expect(result).not.toContain("<i>");
  });

  it("uses document, numbered section, and page for DSA inline labels", () => {
    const result = formatInlineCitations("A [1] B [2].", [
      citation({
        title: "Dsa.pdf",
        section: "Dsa.pdf > 1.1 Introduction",
        page: 12,
        indexes: [1],
      }),
      citation({
        index: 2,
        title: "Dsa.pdf",
        section: "Dsa.pdf > 1.2 Abstract Data Types",
        page: 12,
        indexes: [2],
      }),
    ]);

    expect(result).toBe(
      "A ([Dsa · Mục 1.1 · Trang 12](#citation-1)) B ([Dsa · Mục 1.2 · Trang 12](#citation-2)).",
    );
  });

  it("groups aliases of one resolved citation", () => {
    const shared = citation({
      index: 1,
      title: "Dsa.pdf",
      section: "Dsa.pdf > 1.1 Introduction",
      page: 12,
      indexes: [1, 2],
    });

    expect(formatInlineCitations("Both [1][2].", [shared])).toBe(
      "Both ([Dsa · Mục 1.1 · Trang 12](#citation-1)).",
    );
  });

  it("keeps distinct citations even when their short labels match", () => {
    const result = formatInlineCitations("Both [1][2].", [
      citation({
        index: 1,
        title: "Dsa.pdf",
        section: "Dsa.pdf > Introduction",
        page: 12,
        indexes: [1],
      }),
      citation({
        index: 2,
        title: "Dsa.pdf",
        section: "Dsa.pdf > Preface",
        page: 12,
        indexes: [2],
      }),
    ]);

    expect(result).toBe(
      "Both ([Dsa · Trang 12](#citation-1); [Dsa · Trang 12](#citation-2)).",
    );
  });

  it("falls back to document and page when the chunk has no numbered section", () => {
    const result = formatInlineCitations("A fact [1].", [
      citation({ title: "DSA.pdf", page: 1, section: null }),
    ]);

    expect(result).toBe("A fact ([DSA · Trang 1](#citation-1)).");
  });

  it("keeps document and page for a live multi-page range", () => {
    const result = formatInlineCitations("A fact [1].", [
      citation({
        title: "DSA.pdf",
        page: 8,
        pages: [8, 9],
        pageLabel: "8-9",
        section: "DSA.pdf > Preface",
      }),
    ]);

    expect(result).toBe("A fact ([DSA · Trang 8-9](#citation-1)).");
  });

  it("keeps short labels when the source label has html entities", () => {
    const result = formatInlineCitations("A fact [1].", [
      citation({
        title: "DSA &amp; ML.pdf",
        section: "<b>Preface</b>",
        page: 7,
      }),
    ]);

    expect(result).toBe("A fact ([DSA & ML · Trang 7](#citation-1)).");
  });

  it("drops only the adjacent redundant page locator before a curriculum marker", () => {
    const result = formatInlineCitations(
      "Earlier (Page 2) stays. A fact (Page 1) [1].",
      [
        citation({
          title: "DSA.pdf",
          section: "Preface",
          page: 7,
        }),
      ],
    );

    expect(result).toBe(
      "Earlier (Page 2) stays. A fact ([DSA · Trang 7](#citation-1)).",
    );
  });

  it("preserves a non-numeric page reference before a curriculum marker", () => {
    const result = formatInlineCitations("A fact (Page reference) [1].", [
      citation({
        title: "DSA.pdf",
        section: "Preface",
        page: 7,
      }),
    ]);

    expect(result).toBe(
      "A fact (Page reference) ([DSA · Trang 7](#citation-1)).",
    );
  });

  it("drops a numeric localized page range before a curriculum marker", () => {
    const result = formatInlineCitations("A fact (Trang 8–9) [1].", [
      citation({
        title: "DSA.pdf",
        section: "Preface",
        page: 8,
        pages: [8, 9],
        pageLabel: "8-9",
      }),
    ]);

    expect(result).toBe(
      "A fact ([DSA · Trang 8-9](#citation-1)).",
    );
  });

  it("keeps a page locator before a web marker", () => {
    const result = formatInlineCitations("A fact (Page 1) [1].", [
      citation({
        kind: "internet",
        title: "Web Docs",
        url: "https://example.com/docs",
        page: null,
        documentId: null,
      }),
    ]);

    expect(result).toBe("A fact (Page 1) *(Web Docs)*.");
  });

  it("preserves web citation labels", () => {
    const result = formatInlineCitations("A fact [1].", [
      citation({
        kind: "internet",
        title: "Web Docs",
        url: "https://example.com/docs",
        page: null,
        documentId: null,
      }),
    ]);

    expect(result).toBe("A fact *(Web Docs)*.");
  });

  it("groups adjacent markers and keeps unknown markers", () => {
    const result = formatInlineCitations(
      "Both [1][2] and an unknown [9].",
      [
        citation({
          index: 1,
          title: "Git Lab Guide.pdf",
          page: 8,
          section: "Section A",
          indexes: [1],
        }),
        citation({
          index: 2,
          title: "Git Lab Guide.pdf",
          page: 9,
          section: "Section B",
          indexes: [2],
        }),
      ],
    );

    expect(result).toBe(
      "Both ([Git Lab Guide · Trang 8](#citation-1); [Git Lab Guide · Trang 9](#citation-2)) and an unknown [9].",
    );
  });

  it("leaves citation-like text inside code untouched", () => {
    const content = "Use `items[1]` in code.\n\n```ts\nconst x = items[1];\n```\n\nFact [1].";

    expect(formatInlineCitations(content, [citation()])).toBe(
      "Use `items[1]` in code.\n\n```ts\nconst x = items[1];\n```\n\nFact ([Quiz · Trang 1](#citation-1)).",
    );
  });
});

describe("curriculum inline short labels", () => {
  it("uses document, numbered section, and page", () => {
    const dsa = citation({
      title: "Dsa.pdf",
      section: "Dsa.pdf > 1.1 Introduction",
      page: 12,
    });
    const dsaNext = citation({
      index: 2,
      title: "Dsa.pdf",
      section: "Dsa.pdf > 1.2 Abstract Data Types",
      page: 12,
    });

    expect(citationShortInlineLabel(dsa, 1)).toBe(
      "Dsa · Mục 1.1 · Trang 12",
    );
    expect(citationShortInlineLabel(dsaNext, 2)).toBe(
      "Dsa · Mục 1.2 · Trang 12",
    );
  });

  it("uses document and page when no numbered section exists", () => {
    expect(
      citationShortInlineLabel(
        citation({ title: "Dsa.pdf", section: "Introduction", page: 12 }),
      ),
    ).toBe("Dsa · Trang 12");
  });

  it("uses numbered section and page when the title is generic", () => {
    expect(
      citationShortInlineLabel(
        citation({
          title: "source",
          section: "Chapter 1 > Mục 1.1",
          page: 12,
        }),
      ),
    ).toBe("Mục 1.1 · Trang 12");
  });

  it("keeps Introduction when it is the last section without a number", () => {
    expect(
      citationLastSectionText(
        citation({ title: "Dsa.pdf", section: "Dsa.pdf > Introduction" }),
      ),
    ).toBe("Introduction");
    expect(
      citationShortInlineLabel(
        citation({
          title: "source",
          section: "Introduction",
          page: null,
          pages: [],
          pageLabel: null,
        }),
      ),
    ).toBe("Introduction");
  });

  it("falls back to a readable source marker when metadata is absent", () => {
    expect(
      citationShortInlineLabel(
        citation({
          title: "source",
          section: null,
          page: null,
          pages: [],
          pageLabel: null,
        }),
        3,
      ),
    ).toBe("Nguồn 3");
  });

  it("keeps the full title, section path, and page in the tooltip", () => {
    expect(
      citationFullDescription(
        citation({
          title: "Dsa.pdf",
          section: "Dsa.pdf > 1.1 Introduction",
          page: 12,
        }),
      ),
    ).toBe("Dsa.pdf · 1.1 Introduction · Trang 12");
  });
});

describe("mapHistoryCitation", () => {
  it("maps persisted citation fields to ChatCitation", () => {
    const mapped = mapHistoryCitation({
      index: 1,
      kind: "curriculum",
      title: "Lecture 1.pdf",
      url: "//cdn.example.com/doc",
      snippet: "Key definition",
      document_id: "doc-123",
      page: 4,
      indexes: [1, 3],
      highlights: ["Highlight 1", "Highlight 2"],
    });

    expect(mapped).toEqual({
      index: 1,
      kind: "curriculum",
      title: "Lecture 1.pdf",
      url: "https://cdn.example.com/doc",
      snippet: "Key definition",
      documentId: "doc-123",
      page: 4,
      pages: [4],
      pageLabel: null,
      section: null,
      indexes: [1, 3],
      highlights: ["Highlight 1", "Highlight 2"],
    });
  });

  it("maps the section locator from persisted citations", () => {
    const mapped = mapHistoryCitation({
      index: 1,
      kind: "curriculum",
      title: "Lecture 1.pdf",
      url: null,
      snippet: "Key definition",
      document_id: "doc-123",
      page: 4,
      section: "Chapter 2 > Transport",
      indexes: [1],
      highlights: [],
    });

    expect(mapped.section).toBe("Chapter 2 > Transport");
  });

  it("falls back indexes to [index] when indexes array is missing or empty", () => {
    const withEmpty = mapHistoryCitation({
      index: 2,
      kind: "internet",
      title: "Docs",
      url: "https://example.com",
      snippet: "Web snippet",
      document_id: null,
      page: null,
      indexes: [],
    });
    expect(withEmpty.indexes).toEqual([2]);

    const withUndefined = mapHistoryCitation({
      index: 3,
      kind: "internet",
      title: "Docs",
      url: "https://example.com",
      snippet: "Web snippet",
      document_id: null,
      page: null,
    });
    expect(withUndefined.indexes).toEqual([3]);
  });

  it("never converts snippet into highlight when highlights is empty", () => {
    const mapped = mapHistoryCitation({
      index: 1,
      kind: "curriculum",
      title: "Doc.pdf",
      url: null,
      snippet: "Raw snippet preview",
      document_id: "doc-1",
      page: 1,
      highlights: [],
    });

    expect(mapped.snippet).toBe("Raw snippet preview");
    expect(mapped.highlights).toEqual([]);
  });

  it("uses highlights[0] as snippet fallback when snippet is empty", () => {
    const mapped = mapHistoryCitation({
      index: 1,
      kind: "curriculum",
      title: "Doc.pdf",
      url: null,
      snippet: "   ",
      document_id: "doc-1",
      page: 1,
      highlights: ["Primary source passage", "Secondary passage"],
    });

    expect(mapped.snippet).toBe("Primary source passage");
  });
});
