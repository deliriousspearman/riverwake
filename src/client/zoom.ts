// Click to enlarge: an image, Mermaid diagram or draw.io diagram (.lms-drawio) in a page that's shown smaller than its real size
// (wide diagrams and screenshots are scaled to the text column) opens full size in a dialog. Only
// shrunk ones are enlargeable: they get a zoom cursor, and can be reached with Tab and opened with
// Enter or Space. Escape, the close button or a click outside the picture closes it.

const SHRUNK = 1.15; // shown at less than 1/1.15 of its real width
const MIN_WIDTH = 480; // smaller pictures (icons, a deliberately small image) gain nothing from it
const CANDIDATES = '.theme-doc-markdown img:not(a img):not(.picture), .theme-doc-markdown .lms-mermaid, .theme-doc-markdown .lms-drawio';

let dialog: HTMLDialogElement | undefined;
let opener: HTMLElement | undefined;
const watched = new WeakSet<Element>();

/** The real width of an image or diagram, and what it's shown at. */
function widths(el: HTMLElement): [natural: number, shown: number] {
	if (el instanceof HTMLImageElement) return [el.naturalWidth, el.getBoundingClientRect().width];
	const svg = el.querySelector('svg');
	if (!svg) return [0, 0];
	// Mermaid gives the diagram's own width as max-width, and so does plugins/remark-drawio.mjs.
	return [parseFloat(svg.style.maxWidth) || 0, svg.getBoundingClientRect().width];
}

function update(el: HTMLElement) {
	const [natural, shown] = widths(el);
	const zoomable = shown > 0 && natural >= MIN_WIDTH && natural > shown * SHRUNK;
	if (zoomable === el.hasAttribute('data-zoomable')) return;
	if (zoomable) {
		el.setAttribute('data-zoomable', '');
		el.tabIndex = 0;
		el.setAttribute('role', 'button');
		const what = el instanceof HTMLImageElement ? (el.alt ? `image: ${el.alt}` : 'image') : 'diagram';
		el.setAttribute('aria-label', `Enlarge ${what}`);
	} else {
		for (const name of ['data-zoomable', 'tabindex', 'role', 'aria-label']) el.removeAttribute(name);
	}
}

const resize = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver((entries) => entries.forEach((e) => update(e.target as HTMLElement)));

function watch(el: HTMLElement) {
	if (watched.has(el)) return;
	watched.add(el);
	resize?.observe(el);
	if (el instanceof HTMLImageElement && !el.complete) el.addEventListener('load', () => update(el), { once: true });
	update(el);
}

function getDialog() {
	if (dialog) return dialog;
	dialog = document.createElement('dialog');
	dialog.className = 'lms-zoom';
	dialog.innerHTML = '<button type="button" class="lms-zoom-close" aria-label="Close">×</button><div class="lms-zoom-body"></div>';
	dialog.addEventListener('click', (event) => {
		// The backdrop and the close button close it; the picture itself doesn't.
		if (event.target === dialog || (event.target as Element).closest('.lms-zoom-close')) dialog!.close();
	});
	dialog.addEventListener('close', () => {
		dialog!.querySelector('.lms-zoom-body')!.replaceChildren();
		opener?.focus();
	});
	document.body.append(dialog);
	return dialog;
}

function open(el: HTMLElement) {
	const d = getDialog();
	const body = d.querySelector('.lms-zoom-body')!;
	let copy: Element;
	if (el instanceof HTMLImageElement) {
		copy = Object.assign(document.createElement('img'), { src: el.currentSrc || el.src, alt: el.alt });
	} else {
		copy = el.querySelector('svg')!.cloneNode(true) as SVGElement;
		const svg = copy as SVGElement;
		// Full size: the diagram's own width, not the page's 100%.
		svg.setAttribute('width', svg.style.maxWidth);
		svg.style.minWidth = '';
		svg.style.maxWidth = 'none';
	}
	body.replaceChildren(copy);
	d.setAttribute('aria-label', el.getAttribute('aria-label')?.replace(/^Enlarge/, 'Enlarged') ?? 'Enlarged picture');
	opener = el;
	d.showModal();
	body.scrollTo(0, 0);
}

if (typeof document !== 'undefined') {
	document.addEventListener('click', (event) => {
		const el = (event.target as Element).closest<HTMLElement>('[data-zoomable]');
		if (el) open(el);
	});
	document.addEventListener('keydown', (event) => {
		const el = (event.target as Element).closest?.<HTMLElement>('[data-zoomable]');
		if (el && (event.key === 'Enter' || event.key === ' ')) {
			event.preventDefault();
			open(el);
		}
	});
	// Mermaid draws its diagrams after the page has loaded: watch for them arriving (looking at most
	// once a frame, however many changes there are).
	let pending = false;
	new MutationObserver(() => {
		if (pending) return;
		pending = true;
		requestAnimationFrame(() => {
			pending = false;
			document.querySelectorAll<HTMLElement>(CANDIDATES).forEach(watch);
		});
	}).observe(document.body, { childList: true, subtree: true });
}

export function onRouteDidUpdate() {
	dialog?.close();
	document.querySelectorAll<HTMLElement>(CANDIDATES).forEach(watch);
}
