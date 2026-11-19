import { describe, expect, it } from "vitest";

type TestMessage = { id: string; backendMessageId?: string };

import {
  adoptConsentSessionKey,
  appendMessageOnce,
  buildStreamTranscript,
  runConsentRequestForCurrentSession,
} from "./consent-race";

describe("web consent delayed response race", () => {
  it("does not append a delayed answer after switching conversations", async () => {
    let currentKey = "session-a";
    let finish!: (value: string) => void;
    const appended: string[] = [];

    const pending = runConsentRequestForCurrentSession({
      targetSessionId: "session-a",
      getCurrentSessionKey: () => currentKey,
      request: () => new Promise<string>((resolve) => { finish = resolve; }),
      apply: (answer) => appended.push(answer),
    });

    currentKey = "session-b";
    finish("web answer");
    const outcome = await pending;

    expect(outcome.applied).toBe(false);
    expect(appended).toEqual([]);
  });

  it("recognizes the live new-chat session before the done event", async () => {
    const currentKey = adoptConsentSessionKey("__new_chat__", "session-a");
    const appended: string[] = [];
    const outcome = await runConsentRequestForCurrentSession({
      targetSessionId: "session-a",
      getCurrentSessionKey: () => currentKey,
      request: async () => "early web answer",
      apply: (answer) => appended.push(answer),
    });

    expect(currentKey).toBe("session-a");
    expect(outcome.applied).toBe(true);
    expect(appended).toEqual(["early web answer"]);
  });

  it("keeps an early accepted web answer in transcript reconstruction after done", async () => {
    const baseMessages: TestMessage[] = [{ id: "base" }];
    const userMessage: TestMessage = { id: "user" };
    const answer: TestMessage = { id: "doc-answer" };
    const webMessage: TestMessage = { id: "web", backendMessageId: "assistant-web-1" };
    const context = {
      baseMessages,
      userMessage,
      answer,
      webMessages: [] as TestMessage[],
    };
    let currentKey = "__new_chat__";
    let visibleMessages: TestMessage[] = [...baseMessages, userMessage, answer];

    // Consent arrives before done and the session is adopted immediately.
    currentKey = adoptConsentSessionKey(currentKey, "session-a");
    const outcome = await runConsentRequestForCurrentSession({
      targetSessionId: "session-a",
      getCurrentSessionKey: () => currentKey,
      request: async () => webMessage,
      apply: (message) => {
        context.webMessages = appendMessageOnce(context.webMessages, message);
        visibleMessages = appendMessageOnce(visibleMessages, message);
      },
    });

    // The later done event/session adoption rebuilds the transcript from context.
    visibleMessages = buildStreamTranscript(context);

    expect(outcome.applied).toBe(true);
    expect(currentKey).toBe("session-a");
    expect(visibleMessages).toHaveLength(4);
    expect(visibleMessages.filter((message) => message.id === "web")).toHaveLength(1);
  });

  it("renders an accepted web answer exactly once when history already has it", () => {
    const existing = [{ backendMessageId: "assistant-web-1" }];
    const duplicate = appendMessageOnce(existing, {
      backendMessageId: "assistant-web-1",
    });
    expect(duplicate).toHaveLength(1);

    const appended = appendMessageOnce(duplicate, {
      backendMessageId: "assistant-web-2",
    });
    expect(appended).toHaveLength(2);
  });

  it("appends when the same conversation is still selected", async () => {
    const appended: string[] = [];
    const outcome = await runConsentRequestForCurrentSession({
      targetSessionId: "session-a",
      getCurrentSessionKey: () => "session-a",
      request: async () => "web answer",
      apply: (answer) => appended.push(answer),
    });

    expect(outcome.applied).toBe(true);
    expect(appended).toEqual(["web answer"]);
  });
});
