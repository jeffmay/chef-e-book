/** Controls that take Enter as their own input, so an editor or modal must not steal it. */
const ENTER_PASSTHROUGH_TAGS: ReadonlySet<string> = new Set(["TEXTAREA", "BUTTON", "A"]);

/** Whether Enter pressed on `target` belongs to that control rather than to the enclosing editor. */
export function isEnterPassthrough(target: EventTarget): boolean {
  return target instanceof HTMLElement && ENTER_PASSTHROUGH_TAGS.has(target.tagName);
}

/**
 * A control that currently has a popup open (`aria-expanded="true"`: a
 * `react-select` menu, a `TreeSelect` trigger), or a key pressed inside a
 * `TreeSelect` panel — which is portalled out of the field's DOM, so it carries
 * no `aria-expanded` of its own. Escape there closes the popup, so the enclosing
 * editor or modal must leave it alone rather than cancel as well.
 */
const OPEN_POPUP_SELECTOR = '[aria-expanded="true"], .p-treeselect-panel';

/** Whether Escape pressed on `target` is for an open popup, not for the editor around it. */
export function isEscapeForOpenPopup(target: EventTarget): boolean {
  return target instanceof Element && target.closest(OPEN_POPUP_SELECTOR) !== null;
}
