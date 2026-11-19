// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import NotFound from "./not-found";

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

describe("NotFound Component (AC-04)", () => {
  it("renders a branded 404 screen for unknown URLs", () => {
    act(() => {
      root.render(<NotFound />);
    });

    expect(host.textContent).toContain("404 ERROR");
    expect(host.textContent).toContain("Page Not Found");
    expect(host.textContent).toContain("couldn't find the page");

    const homeLink = host.querySelector('a[href="/"]');
    expect(homeLink).toBeTruthy();
    expect(homeLink?.textContent).toContain("Return Home");

    const studentLink = host.querySelector('a[href="/student/home"]');
    expect(studentLink).toBeTruthy();
  });
});
