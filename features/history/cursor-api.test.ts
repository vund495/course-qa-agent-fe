import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/admin-api";
import { getSessionsPage } from "./api";

vi.mock("@/lib/admin-api", () => ({
  apiFetch: vi.fn(),
}));

const mockedApiFetch = vi.mocked(apiFetch);

describe("getSessionsPage", () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
    mockedApiFetch.mockResolvedValue({ items: [], total: 0, next_cursor: null });
  });

  it("includes the cursor when one is provided", async () => {
    await getSessionsPage({ classId: "class-1", section: "recent", cursor: "abc123" });

    expect(mockedApiFetch).toHaveBeenCalledWith(
      "/api/history?class_id=class-1&section=recent&limit=20&cursor=abc123",
    );
  });

  it("omits the cursor when it is null", async () => {
    await getSessionsPage({ classId: "class-1", section: "recent", cursor: null });

    expect(mockedApiFetch).toHaveBeenCalledWith(
      "/api/history?class_id=class-1&section=recent&limit=20",
    );
  });

  it("always sends section and limit", async () => {
    await getSessionsPage({ classId: "class-1", section: "pinned", limit: 50 });

    expect(mockedApiFetch).toHaveBeenCalledWith(
      "/api/history?class_id=class-1&section=pinned&limit=50",
    );
  });
});
