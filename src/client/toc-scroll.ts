// "On this page" (the desktop column and the phone dropdown): choosing a heading glides quickly to
// it (about 0.3s) instead of jumping, so readers see where they went. "Jump to headings: Instantly"
// in Settings (data-lms-scroll="instant" on <html>, src/lib/preferences.ts) keeps the browser's own
// jump, as does reduced motion (the device's setting, or Settings → Motion).
//
// The glide aims at where the browser would jump to (the heading less its scroll-margin-top, for the
// navbar), re-measured every frame in case the page moves as it starts. At the end the address gets
// the #heading as before (a history entry, so Back returns to where the reader was; focus moves
// there), which lands on the same spot. Scrolling, a tap or a key press stops it.

const DURATION = 300;
const LINKS = 'a.table-of-contents__link[href^="#"]';

let cancel: (() => void) | undefined;

const instant = () =>
	document.documentElement.dataset.lmsScroll === 'instant' ||
	document.documentElement.dataset.lmsMotion === 'reduce' ||
	matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Where the browser's own jump to `target` would put the page. */
function destination(target: HTMLElement) {
	const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
	const max = document.documentElement.scrollHeight - innerHeight;
	return Math.max(0, Math.min(max, target.getBoundingClientRect().top + scrollY - margin));
}

function glide(target: HTMLElement, hash: string) {
	cancel?.();
	const start = scrollY;
	const began = performance.now();
	let frame = 0;
	const stop = () => {
		cancelAnimationFrame(frame);
		for (const name of ['wheel', 'touchstart', 'keydown'] as const) removeEventListener(name, stop);
		cancel = undefined;
	};
	const step = (now: number) => {
		const t = Math.min(1, (now - began) / DURATION);
		const eased = 1 - (1 - t) ** 3;
		scrollTo(0, start + (destination(target) - start) * eased);
		if (t < 1) frame = requestAnimationFrame(step);
		else {
			stop();
			// As the browser's own jump would: the address, a history entry, and focus. The browser
			// saves the old entry's scroll position as the hash changes, for Back: so it's set from
			// where the glide started, then the hash jumps to the same spot the glide reached (both
			// before the next paint, so nothing flickers).
			if (location.hash !== hash) {
				scrollTo(0, start);
				location.hash = hash;
			}
		}
	};
	for (const name of ['wheel', 'touchstart', 'keydown'] as const) addEventListener(name, stop, { passive: true });
	cancel = stop;
	frame = requestAnimationFrame(step);
}

if (typeof document !== 'undefined') {
	document.addEventListener('click', (event) => {
		if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
		const link = (event.target as Element).closest?.<HTMLAnchorElement>(LINKS);
		if (!link || instant()) return;
		const hash = link.getAttribute('href')!;
		const target = document.getElementById(decodeURIComponent(hash.slice(1)));
		if (!target) return;
		event.preventDefault();
		glide(target, hash);
	});
}
