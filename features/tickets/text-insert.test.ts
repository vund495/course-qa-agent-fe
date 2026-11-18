import { describe, expect, it } from "vitest";
import { insertAtSelection } from "./text-insert";

describe("insertAtSelection", () => {
  it("inserts at the caret without touching the rest of the message", () => {
    expect(insertAtSelection("abc def", 4, 4, "😀")).toEqual({
      value: "abc 😀def",
      caret: 6,
    });
  });

  it("replaces the selected range", () => {
    expect(insertAtSelection("hello there", 0, 5, "👍")).toEqual({
      value: "👍 there",
      caret: 2,
    });
  });

  it("appends when there is no caret information", () => {
    expect(insertAtSelection("no emoji yet", null, null, "🎉")).toEqual({
      value: "no emoji yet🎉",
      caret: 14,
    });
  });

  it("clamps stale selection offsets to the current value", () => {
    expect(insertAtSelection("ok", 99, 120, "🙂")).toEqual({
      value: "ok🙂",
      caret: 4,
    });
  });

  it("inserts into an empty message", () => {
    expect(insertAtSelection("", 0, 0, "❤️")).toEqual({ value: "❤️", caret: 2 });
  });
});
