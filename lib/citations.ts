import type { ChatMessageCitation } from "@/features/history/types";
import type { ChatCitation } from "./sse";

/**
 * Map a persisted history citation to the ChatCitation shape used throughout the UI.
 *
 * Preserves backend passage highlights and citation index markers, avoiding
 * treating snippet previews as PDF highlights when highlights are empty.
 */
export function mapHistoryCitation(citation: ChatMessageCitation): ChatCitation {
  const highlights = Array.isArray(citation.highlights) ? citation.highlights : [];
  const snippet = (citation.snippet && citation.snippet.trim()) || citation.highlights?.[0] || "";

  return {
    index: citation.index,
    kind: citation.kind === "internet" ? "internet" : "curriculum",
    title: citation.title,
    url: normalizeCitationUrl(citation.url),
    snippet,
    documentId: citation.document_id ?? null,
    page: citation.page ?? null,
    pages: citation.pages && citation.pages.length > 0
      ? citation.pages
      : citation.page !== null && citation.page !== undefined
      ? [citation.page]
      : [],
    pageLabel: citation.page_label ?? null,
    section: citation.section ?? null,
    indexes: citation.indexes?.length ? citation.indexes : [citation.index],
    highlights,
  };
}

/** Turn provider-relative Google redirects into absolute URLs. */
export function normalizeCitationUrl(url: string | null | undefined): string | null {
  const cleaned = url?.trim();
  if (!cleaned) return null;
  if (cleaned.startsWith("//")) {
    return `https:${cleaned}`;
  }
  if (cleaned.startsWith("/goto?url=") || cleaned.startsWith("goto?url=")) {
    return `https://www.google.com/${cleaned.replace(/^\/+/, "")}`;
  }
  return cleaned;
}

/**
 * Stable identity for one citation inside an answer.
 *
 * The backend restarts citation indexes at 1 for every answer, so the index
 * alone is not unique when citations from different documents share a number.
 */
export function citationKey(citation: ChatCitation): string {
  return [
    citation.kind,
    citation.index,
    citation.documentId ?? citation.url ?? "",
    citation.page ?? "",
  ].join("|");
}

/** Append a streamed citation once, even if the same SSE event is replayed. */
export function mergeCitation(
  citations: ChatCitation[] | undefined,
  citation: ChatCitation,
): ChatCitation[] {
  const current = citations ?? [];
  const key = citationKey(citation);
  if (current.some((item) => citationKey(item) === key)) return current;
  return [...current, citation];
}

/** Remove duplicate citations loaded from persisted history. */
export function uniqueCitations(citations: ChatCitation[] | undefined): ChatCitation[] {
  const seen = new Set<string>();
  return (citations ?? []).filter((citation) => {
    const key = citationKey(citation);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const GENERIC_SOURCE_LABELS = new Set([
  "course material",
  "source",
  "document",
  "untitled",
]);
const FILE_EXTENSION_PATTERN =
  /\.(?:pdf|docx?|pptx?|xlsx?|csv|txt|md|rtf|odt|odp|ods)$/i;
const HTML_ENTITY_MAP: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeCitationEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
      try {
        return String.fromCodePoint(parseInt(hex, 16));
      } catch {
        return "";
      }
    })
    .replace(/&#(\d+);/g, (_, code: string) => {
      try {
        return String.fromCodePoint(Number(code));
      } catch {
        return "";
      }
    })
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/gi, (_, name: string) =>
      HTML_ENTITY_MAP[name.toLowerCase()] ?? "",
    );
}

/** Strip inline HTML/markup and normalize whitespace for display-only labels. */
export function cleanCitationText(value: string | null | undefined): string {
  if (!value) return "";
  return decodeCitationEntities(String(value))
    .replace(/<[^>]*>/g, " ")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** Display source name without a file extension or a generic fallback label. */
export function citationSourceText(citation: ChatCitation): string {
  const source = cleanCitationText(citation.title)
    .replace(FILE_EXTENSION_PATTERN, "")
    .trim();
  return GENERIC_SOURCE_LABELS.has(source.toLowerCase()) ? "" : source;
}

/** Display section, removing a source prefix already shown separately. */
export function citationSectionText(citation: ChatCitation): string {
  let section = cleanCitationText(citation.section);
  if (!section) return "";

  const source = citationSourceText(citation);
  if (!source) return section;

  if (section.toLowerCase() === source.toLowerCase()) return "";
  const rawSource = cleanCitationText(citation.title);
  const sourceCandidates = [rawSource, source]
    .filter(Boolean)
    .map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const prefix = new RegExp(
    `^(?:${sourceCandidates.join("|")})\\s*(?:>|·|:|\\-|–|—|/)\\s*`,
    "i",
  );
  section = section.replace(prefix, "").trim();
  return section;
}

/** Localized page locator, e.g. `Trang 7` or `Trang 8-9`. */
export function citationPageText(citation: ChatCitation): string {
  if (citation.kind !== "curriculum") return "";
  const pageLabel = citation.pageLabel?.trim();
  const pages = (citation.pages ?? []).filter(
    (page): page is number => typeof page === "number" && Number.isFinite(page),
  );
  if (pageLabel) return `Trang ${pageLabel}`;
  if (pages.length > 1) return `Trang ${pages.join(", ")}`;
  if (typeof citation.page === "number") return `Trang ${citation.page}`;
  if (pages.length === 1) return `Trang ${pages[0]}`;
  return "";
}

/** Last meaningful section segment; never repeats the document title. */
export function citationLastSectionText(citation: ChatCitation): string {
  const section = citationSectionText(citation);
  if (!section) return "";
  const segments = section
    .split(/\s*(?:>|\u203a|\u00bb|\u2192|\uFFFD)\s*/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  const last = segments[segments.length - 1] ?? "";
  if (!last) return "";
  const source = citationSourceText(citation);
  if (source && last.toLowerCase() === source.toLowerCase()) return "";
  return last;
}

/** Full description used as the inline citation's tooltip/accessible name. */
export function citationFullDescription(citation: ChatCitation): string {
  const title = cleanCitationText(citation.title).replace(/\s+([.,;:!?])/g, "$1");
  const section = citationSectionText(citation).replace(
    /\s+([.,;:!?])/g,
    "$1",
  );
  return [title, section, citationPageText(citation)].filter(Boolean).join(" · ");
}

/** Hierarchical section number from the last path segment, e.g. `Mục 1.1`. */
function citationNumberedSection(citation: ChatCitation): string {
  const last = citationLastSectionText(citation);
  if (!last) return "";
  const match = last.match(
    /^(?:(?:Mục|Section|Chapter|Chương)\s*(\d+(?:\.\d+)*)|(\d+(?:\.\d+)+))\b/i,
  );
  const number = match?.[1] ?? match?.[2];
  return number ? `Mục ${number}` : "";
}

/**
 * Compact inline label built from real metadata: document name, hierarchical
 * section number, and page. Falls back to the last section name, then to a
 * readable source marker when no metadata exists.
 */
export function citationShortInlineLabel(
  citation: ChatCitation,
  marker?: number,
): string {
  const source = citationSourceText(citation);
  const section = citationNumberedSection(citation);
  const page = citationPageText(citation);
  const parts = [source, section, page].filter(Boolean);
  if (parts.length > 0) return parts.join(" · ");

  const lastSection = citationLastSectionText(citation);
  if (lastSection) return lastSection;
  return marker !== undefined ? `Nguồn ${marker}` : "Nguồn tài liệu";
}


/** Compact curriculum locator: source · section · Trang page. */
export function citationCurriculumLabel(citation: ChatCitation): string {
  const parts = [
    citationSourceText(citation),
    citationSectionText(citation),
    citationPageText(citation),
  ];
  const unique: string[] = [];
  for (const part of parts) {
    const cleaned = part.trim();
    if (!cleaned) continue;
    if (unique.some((existing) => existing.toLowerCase() === cleaned.toLowerCase())) continue;
    unique.push(cleaned);
  }
  return unique.join(" · ");
}

/** Human-readable source label used inside the answer text for web citations. */
export function citationInlineLabel(citation: ChatCitation): string {
  if (citation.kind === "curriculum") return citationCurriculumLabel(citation);
  return cleanCitationText(citation.title) || "Source";
}

/** Backward-compatible alias; curriculum locators now include source + Trang page. */
export function citationInlineSectionLabel(citation: ChatCitation): string {
  return citationCurriculumLabel(citation);
}

function escapeInlineLabel(value: string): string {
  return value.replace(/([\\*_~`[\]()#])/g, '\\$&');
}

const PAGE_ONLY_LOCATOR =
  String.raw`\(\s*(?:Page|Trang)\s+\d+(?:\s*[-–—]\s*\d+)?\s*\)[ \t]*`;
const MARKER_GROUP = new RegExp(
  `(?:${PAGE_ONLY_LOCATOR})?(?:\\[\\d+(?:\\s*,\\s*\\d+)*\\])+`,
  "gi",
);
const PAGE_LOCATOR_PREFIX = new RegExp(`^${PAGE_ONLY_LOCATOR}`, "i");

/**
 * Replace LLM citation markers (`[1]`, `[1][2]`) with readable source locators.
 * Curriculum markers become section/page links so ChatMarkdown can render an
 * accessible inline citation button; web labels keep their existing italic text.
 * Fenced/inline code is left untouched, and markers without a matching citation
 * keep their raw form.
 */
export function formatInlineCitations(content: string, citations: ChatCitation[]): string {
  if (citations.length === 0 || !content.includes('[')) return content;

  const byMarker = new Map<number, ChatCitation>();
  for (const citation of citations) {
    const markers = citation.indexes.length > 0 ? citation.indexes : [citation.index];
    for (const marker of markers) {
      if (!byMarker.has(marker)) byMarker.set(marker, citation);
    }
  }
  if (byMarker.size === 0) return content;

  return content
    .split(/(```[\s\S]*?```|`[^`\n]*`)/g)
    .map((segment, index) => {
      if (index % 2 === 1) return segment;

      return segment.replace(MARKER_GROUP, (match) => {
        const pagePrefix = match.match(PAGE_LOCATOR_PREFIX)?.[0] ?? "";
        const markerText = pagePrefix ? match.slice(pagePrefix.length) : match;
        const rendered: string[] = [];
        const webLabels: string[] = [];
        const missing: number[] = [];
        const seen = new Set<number>();
        const seenCitations = new Set<ChatCitation>();
        let hasCurriculum = false;
        let hasCanonicalPage = false;

        for (const raw of markerText.match(/\d+/g) ?? []) {
          const marker = Number(raw);
          if (seen.has(marker)) continue;
          seen.add(marker);
          const citation = byMarker.get(marker);
          if (!citation) {
            missing.push(marker);
            continue;
          }
          if (citation.kind === 'curriculum') {
            hasCurriculum = true;
            if (citationPageText(citation)) hasCanonicalPage = true;
            if (seenCitations.has(citation)) continue;
            seenCitations.add(citation);
            const label = escapeInlineLabel(
              citationShortInlineLabel(citation, marker),
            );
            rendered.push(`[${label}](#citation-${marker})`);
          } else {
            const label = escapeInlineLabel(citationInlineLabel(citation));
            webLabels.push(label);
            rendered.push(`*(${label})*`);
          }
        }

        const keptPagePrefix = pagePrefix && !hasCanonicalPage ? pagePrefix : "";
        const leftovers = missing.map((marker) => `[${marker}]`).join('');
        if (rendered.length === 0) {
          return pagePrefix ? `${pagePrefix}${leftovers}` : leftovers || match;
        }

        const label = hasCurriculum
          ? `(${rendered.join('; ')})`
          : `*(${webLabels.join('; ')})*`;
        return `${keptPagePrefix}${label}${leftovers}`;
      });
    })
    .join('');
}
