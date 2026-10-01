// Mounts asciinema-player on the placeholders rendered by the ```asciinema blocks
// (scripts/blocks.mjs). The player (JS, WebAssembly and CSS) is only downloaded on pages that
// contain a recording. The learner's playback speed (Settings, src/lib/preferences.ts) multiplies
// the recording's own `speed`.
import { getPreferences } from '../lib/preferences';
import { newElements } from './ready';

let cssLoaded: Promise<void> | undefined;

function loadStylesheet() {
	// The stylesheet is copied to static/vendor/ by scripts/prepare.mjs, so it's only fetched here.
	return (cssLoaded ??= new Promise<void>((resolve) => {
		const link = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: '/vendor/asciinema-player.css' });
		link.addEventListener('load', () => resolve());
		link.addEventListener('error', () => resolve());
		document.head.append(link);
	}));
}

async function mount(placeholders: HTMLElement[]) {
	const [AsciinemaPlayer] = await Promise.all([import('asciinema-player'), loadStylesheet()]);
	const fontFamily = getComputedStyle(document.documentElement).getPropertyValue('--lms-mono').trim();
	const speed = Number(getPreferences().speed) || 1;

	for (const el of placeholders) {
		if (!el.isConnected) continue;
		const target = el.querySelector<HTMLElement>('.lms-cast-player')!;
		let options: { speed?: number } = {};
		try {
			options = JSON.parse(el.dataset.castOptions ?? '{}');
		} catch {
			// Options are validated at build time; fall back to defaults if they're somehow unreadable.
		}
		target.replaceChildren();
		AsciinemaPlayer.create(el.dataset.castSrc!, target, {
			theme: 'lms',
			fit: 'width',
			terminalFontFamily: fontFamily || undefined,
			idleTimeLimit: 2,
			// Recordings are small: load up front so the player has the right size and a preview frame.
			preload: true,
			poster: 'npt:0:1',
			...options,
			speed: (options.speed ?? 1) * speed,
		});
	}
}

export function onRouteDidUpdate() {
	const placeholders = newElements('[data-cast-src]');
	if (placeholders.length) mount(placeholders);
}
