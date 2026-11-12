import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AUTH_TOKEN_KEY } from "@/components/ui/nav-config";
import {
  handoverApi,
  handoverFetch,
  isSystemReply,
  todayIso,
  validateLeaveRange,
} from "./handover-api";

class MemoryStorage {
  private values = new Map<string, string>();

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

type FetchCall = { url: string; init?: RequestInit };

function setupMockFetch(body: unknown, status = 200) {
  const calls: FetchCall[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  return {
    calls,
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}

const originalWindow = (globalThis as { window?: unknown }).window;
let local: MemoryStorage;
let token: string;

describe("handover API client", () => {
  beforeEach(() => {
    local = new MemoryStorage();
    token = `test-token-${Math.random()}`;
    local.setItem(AUTH_TOKEN_KEY, token);
    (globalThis as { window?: unknown }).window = { localStorage: local };
  });

  afterEach(() => {
    (globalThis as { window?: unknown }).window = originalWindow;
  });

  it("adds the bearer token and JSON content type", async () => {
    const { calls, restore } = setupMockFetch({ ok: true });
    try {
      await handoverFetch<{ ok: boolean }>("/api/test");
      const headers = calls[0].init?.headers as Record<string, string>;
      expect(headers.Authorization).toBe(`Bearer ${token}`);
      expect(headers["Content-Type"]).toBe("application/json");
    } finally {
      restore();
    }
  });

  it("maps day status endpoints and date query", async () => {
    const { calls, restore } = setupMockFetch([]);
    try {
      await handoverApi.getMyStatus("2026-11-09");
      await handoverApi.listClassStatus("class-1", "2026-11-10");
      expect(calls[0].url).toContain("/api/trainer-status?date=2026-11-09");
      expect(calls[1].url).toContain(
        "/api/classes/class-1/trainer-status?date=2026-11-10",
      );
    } finally {
      restore();
    }
  });

  it("sends leave, handover, admin queue and assign requests", async () => {
    const { calls, restore } = setupMockFetch({});
    try {
      await handoverApi.setMyStatus({ date: "2026-11-09", status: "off" });
      expect(calls[0].init?.method).toBe("PUT");
      expect(JSON.parse(String(calls[0].init?.body))).toEqual({
        date: "2026-11-09",
        status: "off",
      });

      await handoverApi.createLeave({
        date_from: "2026-11-10",
        date_to: "2026-11-12",
        target_trainer_id: "trainer-2",
        class_id: "class-1",
        reason_type: "business_trip",
        reason_details: "Trip",
      });
      expect(calls[1].url).toContain("/api/leave-requests");
      expect(calls[1].init?.method).toBe("POST");

      await handoverApi.acceptHandover("handover-1");
      expect(calls[2].url).toContain("/api/handovers/handover-1/accept");

      await handoverApi.reviewLeave("leave-1", false, "Not available");
      expect(calls[3].url).toContain("/api/admin/leaves/leave-1/review");

      await handoverApi.adminQueue();
      expect(calls[4].url).toContain("/api/admin/tickets/queue");

      await handoverApi.assignTicket("ticket-1", "trainer-2");
      expect(calls[5].url).toContain("/api/tickets/ticket-1/handover");
      expect(JSON.parse(String(calls[5].init?.body))).toEqual({
        to_trainer_id: "trainer-2",
      });
    } finally {
      restore();
    }
  });

  it("maps class assistant and admin leave routes without peer approval", async () => {
    const { calls, restore } = setupMockFetch([]);
    try {
      await handoverApi.listClassAssistants("class/1");
      await handoverApi.addClassAssistant("class/1", "ta-1");
      await handoverApi.removeClassAssistant("class/1", "ta/1");
      await handoverApi.listAdminLeaves("pending");
      await handoverApi.listAdminLeaves();
      await handoverApi.reviewLeave("leave/1", true);
      expect(calls.map(call => call.url.split("/api")[1])).toEqual([
        "/classes/class%2F1/assistants", "/admin/classes/class%2F1/assistants",
        "/admin/classes/class%2F1/assistants/ta%2F1", "/admin/leaves?status=pending",
        "/admin/leaves", "/admin/leaves/leave%2F1/review",
      ]);
      expect(JSON.parse(String(calls[1].init?.body))).toEqual({ assistant_id: "ta-1" });
      expect(calls[2].init?.method).toBe("DELETE");
      expect(JSON.parse(String(calls[5].init?.body))).toEqual({ approve: true });
    } finally { restore(); }
  });

  it("surfaces the backend detail on failure", async () => {
    const { restore } = setupMockFetch({ detail: "Only admins can view the admin queue." }, 403);
    try {
      await expect(handoverApi.adminQueue()).rejects.toThrow(
        "Only admins can view the admin queue.",
      );
    } finally {
      restore();
    }
  });
});

describe("handover helpers", () => {
  it("computes the Vietnam date even when UTC is still the previous day", () => {
    expect(todayIso(new Date("2026-11-09T17:30:00Z"))).toBe("2026-11-10");
  });

  it("validates leave ranges on the client", () => {
    expect(validateLeaveRange("2026-11-10", "2026-11-09")).toBe(
      "The end date must be on or after the start date.",
    );
    expect(validateLeaveRange("2026-11-09", "2026-11-09")).toBeNull();
    expect(validateLeaveRange("", "2026-11-09")).toBe("Choose both dates.");
  });

  it("recognises the three backend system replies", () => {
    expect(isSystemReply("Ticket transferred from A to B (auto_absent).")).toBe(true);
    expect(
      isSystemReply("All trainers are off today; the ticket is waiting for an administrator."),
    ).toBe(true);
    expect(
      isSystemReply("Handover from A was rejected; the ticket returns to the automatic queue."),
    ).toBe(true);
    expect(isSystemReply("A normal teacher answer.")).toBe(false);
  });
});
