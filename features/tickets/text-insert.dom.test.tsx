// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { insertTextIntoTextarea } from "./text-insert";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

function ControlledReply({ initial = "" }: { initial?: string }) {
  const [value, setValue] = React.useState(initial);
  return (
    <form>
      <textarea value={value} onChange={(event) => setValue(event.target.value)} />
    </form>
  );
}

async function mount(initial?: string) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<ControlledReply initial={initial} />);
  });
  const textarea = container.querySelector("textarea");
  if (!textarea) throw new Error("textarea did not render");
  return { textarea, root, container };
}

describe("insertTextIntoTextarea", () => {
  it("writes emoji into a React controlled textarea at the caret", async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const { textarea, root, container } = await mount("Thanks");

    textarea.setSelectionRange(0, 0);
    await act(async () => {
      expect(insertTextIntoTextarea(textarea, "👍")).toBe(true);
    });

    expect(textarea.value).toBe("👍Thanks");
    expect(textarea.selectionStart).toBe(2);
    expect(textarea).toBe(document.activeElement);

    await act(async () => root.unmount());
    container.remove();
  });

  it("replaces a selection and keeps typing sync", async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const { textarea, root, container } = await mount("old text");
    textarea.setSelectionRange(0, 3);

    await act(async () => {
      insertTextIntoTextarea(textarea, "🎉");
    });

    expect(textarea.value).toBe("🎉 text");

    await act(async () => root.unmount());
    container.remove();
  });

  it("reports failure for a read-only textarea", () => {
    const textarea = document.createElement("textarea");
    textarea.readOnly = true;
    expect(insertTextIntoTextarea(textarea, "😀")).toBe(false);
  });
});
