import { describe, expect, it } from "vitest";
import { associatedQuestion } from "./associated-question";

describe("associatedQuestion", () => {
  it("returns the user prompt immediately before an assistant answer", () => {
    expect(associatedQuestion([
      { role: "user", content: "What is a list comprehension?" },
      { role: "ai", content: "It is a concise way to build a list." },
    ], 1)).toBe("What is a list comprehension?");
  });

  it("does not associate the welcome message or an answer after another answer", () => {
    expect(associatedQuestion([{ role: "ai", content: "Welcome" }], 0)).toBeNull();
    expect(associatedQuestion([
      { role: "ai", content: "First answer" },
      { role: "ai", content: "Another answer" },
    ], 1)).toBeNull();
  });

  it("does not return an empty user prompt", () => {
    expect(associatedQuestion([
      { role: "user", content: "  " },
      { role: "ai", content: "Answer" },
    ], 1)).toBeNull();
  });

  it("uses the stored original question for a web answer after another answer", () => {
    expect(associatedQuestion([
      { role: "ai", content: "Course answer" },
      { role: "ai", content: "Web answer", originalQuestion: "How do I print Hello World in C++?" },
    ], 1)).toBe("How do I print Hello World in C++?");
  });
});
