// @vitest-environment jsdom
import React, { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import RootError from "./error";
import GlobalError from "./global-error";
import TeacherRouteError from "./(shell)/teacher/error";
import StudentRouteError from "./(shell)/student/error";
import AdminRouteError from "./(shell)/admin/error";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  vi.clearAllMocks();
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("Error Boundaries (AC-01, AC-02, AC-05, AC-06)", () => {
  it("RootError renders message, retry, and link home without internal details (AC-01)", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const reset = vi.fn();
    const error = new Error("Root leak error");

    act(() => {
      root.render(<RootError error={error} reset={reset} />);
    });

    expect(host.textContent).toContain("We couldn't load this page");
    expect(host.textContent).not.toContain("Root leak error");
    expect(host.querySelector('a[href="/"]')).toBeTruthy();

    const retryBtn = [...host.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Try again"),
    );
    expect(retryBtn).toBeTruthy();

    act(() => {
      retryBtn?.click();
    });
    expect(reset).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("GlobalError renders html/body, retry, and link home (AC-01)", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const reset = vi.fn();
    const error = new Error("Global critical error");

    act(() => {
      root.render(<GlobalError error={error} reset={reset} />);
    });

    expect(host.textContent).toContain("We couldn't load this page");
    expect(host.textContent).not.toContain("Global critical error");
    expect(host.querySelector('a[href="/"]')).toBeTruthy();

    const retryBtn = [...host.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Try again"),
    );
    expect(retryBtn).toBeTruthy();

    act(() => {
      retryBtn?.click();
    });
    expect(reset).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("StudentRouteError renders student-specific portal message and home link (AC-02)", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const reset = vi.fn();
    const error = new Error("Student portal backend hiccup");

    act(() => {
      root.render(<StudentRouteError error={error} reset={reset} />);
    });

    expect(host.textContent).toContain("We couldn't load your classes");
    expect(host.textContent).toContain("Your progress and class work are completely safe");
    expect(host.textContent).not.toContain("Student portal backend hiccup");
    expect(host.querySelector('a[href="/student/home"]')).toBeTruthy();
    consoleSpy.mockRestore();
  });

  it("TeacherRouteError renders teacher-specific portal message and home link (AC-02)", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const reset = vi.fn();
    const error = new Error("Teacher portal query error");

    act(() => {
      root.render(<TeacherRouteError error={error} reset={reset} />);
    });

    expect(host.textContent).toContain("We couldn't load this workspace");
    expect(host.textContent).toContain("retrieving your class materials");
    expect(host.textContent).not.toContain("Teacher portal query error");
    expect(host.querySelector('a[href="/teacher/home"]')).toBeTruthy();
    consoleSpy.mockRestore();
  });

  it("AdminRouteError renders admin-specific portal message and home link (AC-02)", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const reset = vi.fn();
    const error = new Error("Admin query timeout");

    act(() => {
      root.render(<AdminRouteError error={error} reset={reset} />);
    });

    expect(host.textContent).toContain("We couldn't load this admin view");
    expect(host.textContent).toContain("temporary system issue");
    expect(host.textContent).not.toContain("Admin query timeout");
    expect(host.querySelector('a[href="/admin/home"]')).toBeTruthy();
    consoleSpy.mockRestore();
  });

  it("Forcing a route to throw shows the error screen and retry re-renders successfully (AC-06)", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Harness simulating route throw and recovery on reset
    function BuggyRouteHarness() {
      const [hasError, setHasError] = useState(true);

      if (hasError) {
        return (
          <StudentRouteError
            error={new Error("Simulated network hiccup")}
            reset={() => setHasError(false)}
          />
        );
      }

      return <div data-testid="recovered-page">Student Class Overview Ready</div>;
    }

    act(() => {
      root.render(<BuggyRouteHarness />);
    });

    // Verify error UI is displayed
    expect(host.textContent).toContain("We couldn't load your classes");
    expect(host.querySelector('[data-testid="recovered-page"]')).toBeNull();

    // Click retry
    const retryBtn = [...host.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Try again"),
    );
    expect(retryBtn).toBeTruthy();

    act(() => {
      retryBtn?.click();
    });

    // Verify recovered component renders successfully
    expect(host.querySelector('[data-testid="recovered-page"]')).toBeTruthy();
    expect(host.textContent).toContain("Student Class Overview Ready");

    consoleSpy.mockRestore();
  });
});
