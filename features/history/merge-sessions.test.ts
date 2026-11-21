import { describe, expect, it } from "vitest";
import { mergeSessionPages } from "./merge-sessions";

const page = (...ids: string[]) => ids.map((id) => ({ id, title: `Chat ${id}` }));
const ids = (items: { id: string }[]) => items.map((item) => item.id);

describe("mergeSessionPages", () => {
  it("appends a new page after the existing rows, keeping server order", () => {
    const merged = mergeSessionPages(page("a", "b"), page("c", "d"));

    expect(ids(merged)).toEqual(["a", "b", "c", "d"]);
  });

  it("drops ids that are already present", () => {
    const merged = mergeSessionPages(page("a", "b"), page("b", "c"));

    expect(ids(merged)).toEqual(["a", "b", "c"]);
  });

  it("returns the same array when the incoming page is empty", () => {
    const existing = page("a", "b");

    expect(mergeSessionPages(existing, [])).toBe(existing);
  });
});
