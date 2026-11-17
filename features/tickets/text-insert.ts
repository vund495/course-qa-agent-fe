/**
 * Caret-aware text insertion for the ticket reply textareas.
 *
 * The emoji panel lives in a sibling component, so it updates the message by
 * writing through the native value setter and dispatching an `input` event.
 * React's value tracker then sees the change exactly like a keystroke, which
 * keeps the controlled textarea (and its undo history) in sync.
 */

/** Pure slice/insert used by the DOM helper, and by tests. */
export function insertAtSelection(
  value: string,
  start: number | null,
  end: number | null,
  text: string,
): { value: string; caret: number } {
  const from = start === null ? value.length : Math.min(start, value.length);
  const to = end === null ? from : Math.min(Math.max(end, from), value.length);
  return {
    value: value.slice(0, from) + text + value.slice(to),
    caret: from + text.length,
  };
}

/**
 * Insert `text` at the textarea's caret (replacing any selection) and keep the
 * caret right after the inserted text. Returns false when the textarea cannot
 * be updated, so callers can fall back to other behaviour.
 */
export function insertTextIntoTextarea(
  textarea: HTMLTextAreaElement | null,
  text: string,
): boolean {
  if (!textarea || textarea.disabled || textarea.readOnly) return false;

  const { value, caret } = insertAtSelection(
    textarea.value,
    textarea.selectionStart,
    textarea.selectionEnd,
    text,
  );

  const setter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value",
  )?.set;
  if (!setter) return false;

  setter.call(textarea, value);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.focus({ preventScroll: true });
  textarea.setSelectionRange(caret, caret);
  return true;
}
