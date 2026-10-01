// Glossary tooltips: the terms are marked at build time (plugins/remark-glossary.mjs); this shows
// a term's tip on hover, focus or tap, keeps it inside the text column, and closes it with Escape
// or a click elsewhere. With glossary terms turned off on the Settings page (data-lms-glossary="off"
// on <html>, src/lib/preferences.ts) the terms are plain text: CSS hides the underline and tip, and
// here they leave the tab order and stop being buttons for screen readers.
import { newElements } from './ready';

let open: { mark: HTMLElement; pinned: boolean } | undefined;

function show(mark: HTMLElement, pinned: boolean) {
	if (open && open.mark !== mark) hide();
	const tip = mark.querySelector<HTMLElement>('.glossary-tip')!;
	tip.hidden = false;
	mark.querySelector('button')!.setAttribute('aria-expanded', 'true');
	// Keep the tip inside the lesson column (not under the "On this page" column or off a phone's
	// screen): shift it left by as much as it would overflow, but not past the column's left edge.
	tip.style.removeProperty('--shift');
	const column = (mark.closest('.theme-doc-markdown') ?? document.body).getBoundingClientRect();
	const right = Math.min(column.right, document.documentElement.clientWidth - 8);
	const box = tip.getBoundingClientRect();
	const shift = Math.max(Math.min(0, right - box.right), Math.max(column.left, 8) - box.left);
	if (shift) tip.style.setProperty('--shift', `${shift}px`);
	open = { mark, pinned: pinned || (open?.mark === mark && open.pinned) };
}

function hide() {
	if (!open) return;
	open.mark.querySelector<HTMLElement>('.glossary-tip')!.hidden = true;
	open.mark.querySelector('button')!.setAttribute('aria-expanded', 'false');
	open = undefined;
}

function setup(wrapper: HTMLElement) {
	const button = wrapper.querySelector('button')!;
	if (document.documentElement.dataset.lmsGlossary === 'off') {
		button.tabIndex = -1;
		button.setAttribute('role', 'none');
		button.removeAttribute('aria-expanded');
		button.removeAttribute('aria-controls');
		return;
	}
	let timer: ReturnType<typeof setTimeout> | undefined;
	const later = (fn: () => void) => {
		clearTimeout(timer);
		timer = setTimeout(fn, 120);
	};
	wrapper.addEventListener('mouseenter', () => later(() => show(wrapper, false)));
	wrapper.addEventListener('mouseleave', () => later(() => open?.mark === wrapper && !open.pinned && hide()));
	button.addEventListener('focus', () => show(wrapper, false));
	wrapper.addEventListener('focusout', (event) => {
		if (!wrapper.contains(event.relatedTarget as Node) && open?.mark === wrapper && !open.pinned) hide();
	});
	button.addEventListener('click', () => {
		clearTimeout(timer);
		if (open?.mark === wrapper && open.pinned) hide();
		else show(wrapper, true);
	});
}

if (typeof document !== 'undefined') {
	document.addEventListener('keydown', (event) => {
		if (event.key !== 'Escape' || !open) return;
		const button = open.mark.querySelector('button')!;
		const hadFocus = open.mark.contains(document.activeElement);
		hide();
		if (hadFocus) button.focus();
	});
	// A tap or click elsewhere closes a pinned tip.
	document.addEventListener('click', (event) => {
		if (open && !open.mark.contains(event.target as Node)) hide();
	});
}

export function onRouteDidUpdate() {
	open = undefined;
	newElements('.glossary-mark').forEach(setup);
}
