// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { ErrorView } from "./ErrorView";

let host: HTMLDivElement;
let root: Root;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  vi.clearAllMocks();
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  consoleErrorSpy.mockRestore();
});

describe("ErrorView Component (AC-01, AC-05, AC-06)", () => {
  it("renders a clear message, a retry action, and a link home (AC-01)", () => {
    const resetSpy = vi.fn();
    const testError = new Error("Internal secret connection failure");

    act(() => {
      root.render(
        <ErrorView
          error={testError}
          reset={resetSpy}
          title="Custom Title"
          message="Custom friendly message"
          homeHref="/custom-home"
          homeLabel="Custom Home Label"
        />,
      );
    });

    const alert = host.querySelector('[role="alert"]');
    expect(alert).toBeTruthy();
    expect(host.textContent).toContain("Custom Title");
    expect(host.textContent).toContain("Custom friendly message");

    const homeLink = host.querySelector('a[href="/custom-home"]');
    expect(homeLink).toBeTruthy();
    expect(homeLink?.textContent).toContain("Custom Home Label");

    const retryBtn = [...host.querySelectorAll("button")].find(
      (b) => b.textContent?.includes("Try again"),
    );
    expect(retryBtn).toBeTruthy();
  });

  it("never exposes internal error details in DOM and logs to console.error (AC-05)", () => {
    const secretMessage = "DATABASE_PASSWORD_LEAK_SECRET_12345";
    const testError = new Error(secretMessage);
    testError.stack = "Error: DATABASE_PASSWORD_LEAK_SECRET_12345\n    at SecretFunction (/app/secret.ts:42:10)";

    act(() => {
      root.render(<ErrorView error={testError} reset={vi.fn()} />);
    });

    // Enforce AC-05: Details MUST NOT be in the DOM
    expect(host.textContent).not.toContain(secretMessage);
    expect(host.textContent).not.toContain("SecretFunction");
    expect(host.textContent).not.toContain("/app/secret.ts");

    // Details MUST be in the console log
    expect(consoleErrorSpy).toHaveBeenCalledWith(testError);
  });

  it("clicking retry triggers the reset callback (AC-06)", () => {
    const resetSpy = vi.fn();
    const testError = new Error("Demo error");

    act(() => {
      root.render(<ErrorView error={testError} reset={resetSpy} />);
    });

    const retryBtn = [...host.querySelectorAll("button")].find(
      (b) => b.textContent?.includes("Try again"),
    );
    expect(retryBtn).toBeTruthy();

    act(() => {
      retryBtn?.click();
    });

    expect(resetSpy).toHaveBeenCalledTimes(1);
  });

  it("never leaks internal details or technical digest in DOM and logs to console (AC-05)", () => {
    const testError = Object.assign(new Error("Sensitive internal error"), {
      digest: "NEXTJS_DIGEST_987654",
    });

    act(() => {
      root.render(<ErrorView error={testError} reset={vi.fn()} />);
    });

    expect(host.textContent).not.toContain("NEXTJS_DIGEST_987654");
    expect(host.textContent).not.toContain("Sensitive internal error");
    expect(consoleErrorSpy).toHaveBeenCalledWith(testError);
  });
});
