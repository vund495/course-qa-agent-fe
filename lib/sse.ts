export type ChatCitation = {
  index: number;
  kind: "curriculum" | "internet";
  title: string;
  url: string | null;
  snippet: string;
  documentId: string | null;
  page: number | null;
  pages?: number[];
  pageLabel?: string | null;
  section?: string | null;
  indexes: number[];
  highlights: string[];
};

export type ChatProgressStage = "searching" | "reading" | "drafting";

export type ChatConsentOffer = {
  id: string;
  sessionId: string;
  scopeKind: "missing" | "full";
  question: string;
  queryScope: string[];
  conflictNote: string | null;
  conflictCitations: ChatCitation[];
  expiresAt: string;
  assistantMessageId: string | null;
};

export type ChatStreamEvent =
  | { type: "progress"; stage: ChatProgressStage; message?: string }
  | { type: "token"; text: string }
  | { type: "restart"; message?: string }
  | { type: "citation"; citation: ChatCitation }
  | { type: "suggestions"; questions: string[] }
  | { type: "consent"; offer: ChatConsentOffer }
  | {
      type: "done";
      source: string;
      usedWebSearch: boolean;
      threshold: number;
      topScore: number | null;
      sessionId: string | null;
      userMessageId: string | null;
      assistantMessageId: string | null;
      suggestedQuestions?: string[];
    }
  | { type: "error"; message: string };

export type ChatDoneEvent = Extract<ChatStreamEvent, { type: "done" }>;

type EventHandler = (event: ChatStreamEvent) => void;

function invalidData(): never {
  throw new Error("Invalid SSE data received from the chat API.");
}

function decodeCitation(data: Record<string, unknown>): ChatCitation {
  if (
    typeof data.index !== "number" ||
    (data.kind !== "curriculum" && data.kind !== "internet") ||
    typeof data.title !== "string" ||
    typeof data.snippet !== "string"
  ) {
    return invalidData();
  }
  const pages = Array.isArray(data.pages)
    ? data.pages.filter((value): value is number => typeof value === "number")
    : undefined;
  const rawPageLabel = data.page_label ?? data.pageLabel;
  const pageLabel = typeof rawPageLabel === "string" ? rawPageLabel : undefined;
  return {
    index: data.index,
    kind: data.kind,
    title: data.title,
    url: typeof data.url === "string" ? data.url : null,
    snippet: data.snippet,
    documentId: typeof data.document_id === "string" ? data.document_id : null,
    page: typeof data.page === "number" ? data.page : null,
    ...(pages !== undefined ? { pages } : {}),
    ...(pageLabel !== undefined ? { pageLabel } : {}),
    section: typeof data.section === "string" ? data.section : null,
    indexes: Array.isArray(data.indexes)
      ? data.indexes.filter((value): value is number => typeof value === "number")
      : [],
    highlights: Array.isArray(data.highlights)
      ? data.highlights.filter((value): value is string => typeof value === "string")
      : [],
  };
}

function decodeEvent(eventName: string, rawData: string): ChatStreamEvent | null {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(rawData) as Record<string, unknown>;
  } catch {
    return invalidData();
  }

  if (eventName === "progress") {
    if (data.stage !== "searching" && data.stage !== "reading" && data.stage !== "drafting") {
      return invalidData();
    }
    return {
      type: "progress",
      stage: data.stage,
      message: typeof data.message === "string" ? data.message : undefined,
    };
  }

  if (eventName === "token") {
    if (typeof data.text !== "string") return invalidData();
    return { type: "token", text: data.text };
  }

  if (eventName === "restart") {
    return {
      type: "restart",
      message: typeof data.message === "string" ? data.message : undefined,
    };
  }

  if (eventName === "citation") {
    return { type: "citation", citation: decodeCitation(data) };
  }

  if (eventName === "suggestions") {
    const rawList = Array.isArray(data.questions)
      ? data.questions
      : Array.isArray(data.suggestions)
        ? data.suggestions
        : null;
    if (!rawList) return invalidData();
    const questions = rawList.filter((q): q is string => typeof q === "string");
    return { type: "suggestions", questions };
  }

  if (eventName === "consent") {
    if (
      typeof data.id !== "string" ||
      typeof data.session_id !== "string" ||
      (data.scope_kind !== "missing" && data.scope_kind !== "full") ||
      typeof data.question !== "string" ||
      !Array.isArray(data.query_scope) ||
      typeof data.expires_at !== "string"
    ) {
      return invalidData();
    }
    return {
      type: "consent",
      offer: {
        id: data.id,
        sessionId: data.session_id,
        scopeKind: data.scope_kind,
        question: data.question,
        queryScope: data.query_scope.filter(
          (value): value is string => typeof value === "string",
        ),
        conflictNote: typeof data.conflict_note === "string" ? data.conflict_note : null,
        conflictCitations: Array.isArray(data.conflict_citations)
          ? data.conflict_citations.map((item) =>
              item && typeof item === "object"
                ? decodeCitation(item as Record<string, unknown>)
                : invalidData(),
            )
          : [],
        expiresAt: data.expires_at,
        assistantMessageId:
          typeof data.assistant_message_id === "string" ? data.assistant_message_id : null,
      },
    };
  }

  if (eventName === "done") {
    if (
      typeof data.source !== "string" ||
      typeof data.used_web_search !== "boolean" ||
      typeof data.threshold !== "number" ||
      (data.top_score !== null && typeof data.top_score !== "number")
    ) {
      return invalidData();
    }
    const suggestionsRaw = Array.isArray(data.suggestions)
      ? data.suggestions
      : Array.isArray(data.suggested_questions)
        ? data.suggested_questions
        : null;
    const suggestedQuestions = suggestionsRaw
      ? suggestionsRaw.filter((q): q is string => typeof q === "string")
      : undefined;

    return {
      type: "done",
      source: data.source,
      usedWebSearch: data.used_web_search,
      threshold: data.threshold,
      topScore: data.top_score,
      sessionId: typeof data.session_id === "string" ? data.session_id : null,
      userMessageId:
        typeof data.user_message_id === "string" ? data.user_message_id : null,
      assistantMessageId:
        typeof data.assistant_message_id === "string"
          ? data.assistant_message_id
          : null,
      suggestedQuestions,
    };
  }

  if (eventName === "error") {
    if (typeof data.message !== "string") return invalidData();
    return { type: "error", message: data.message };
  }

  return null;
}

function parseBlock(block: string): ChatStreamEvent | null {
  let eventName = "message";
  const dataLines: string[] = [];

  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) {
      eventName = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  }

  if (dataLines.length === 0) return null;
  return decodeEvent(eventName, dataLines.join("\n"));
}

export function createSseParser(onEvent: EventHandler) {
  let buffer = "";

  function drainCompleteEvents() {
    buffer = buffer.replace(/\r\n/g, "\n");
    let boundary = buffer.indexOf("\n\n");

    while (boundary !== -1) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const event = parseBlock(block);
      if (event) onEvent(event);
      boundary = buffer.indexOf("\n\n");
    }
  }

  return {
    push(chunk: string) {
      buffer += chunk;
      drainCompleteEvents();
    },
    finish() {
      if (!buffer.trim()) return;
      const event = parseBlock(buffer.replace(/\r\n/g, "\n"));
      buffer = "";
      if (event) onEvent(event);
    },
  };
}
