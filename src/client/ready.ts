// Docusaurus doesn't reload pages, so the browser scripts in this folder run after every navigation
// (onRouteDidUpdate). This hands each a page's new elements once: it marks them `data-ready`, so an
// element that stays on the page isn't set up twice.

/** The elements matching `selector` that haven't been set up yet, now marked as set up. */
export function newElements(selector: string): HTMLElement[] {
	const found = [...document.querySelectorAll<HTMLElement>(`${selector}:not([data-ready])`)];
	for (const el of found) el.dataset.ready = '';
	return found;
}
