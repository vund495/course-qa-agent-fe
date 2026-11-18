// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DateInput,
  formatIsoDateForDisplay,
  parseDisplayDate,
} from "./date-input";

describe("DateInput", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it("formats and parses valid dates without changing the ISO API value", () => {
    expect(formatIsoDateForDisplay("2026-11-02")).toBe("02/11/2026");
    expect(parseDisplayDate("02/11/2026")).toBe("2026-11-02");
    expect(parseDisplayDate("31/02/2026")).toBeNull();
  });

  it("shows DD/MM/YYYY and emits ISO after a valid edit", async () => {
    const onChange = vi.fn();
    await act(async () => {
      root.render(
        <DateInput
          aria-label="Effective From"
          value="2026-11-02"
          onChange={onChange}
        />,
      );
    });

    const visible = host.querySelector<HTMLInputElement>(
      'input[aria-label="Effective From"]',
    );
    expect(visible?.type).toBe("text");
    expect(visible?.value).toBe("02/11/2026");

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(visible, "15/12/2026");
      visible?.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(onChange).toHaveBeenCalledWith("2026-12-15");
  });
});
