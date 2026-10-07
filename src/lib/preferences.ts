// This browser's site preferences, set on the Settings page (src/pages/settings.tsx). Stored only in
// localStorage, like progress (src/lib/progress.ts), and never sent anywhere.
//
//   lms-preferences-v1   { text, width, motion, scroll, wrap, toc, breadcrumbs, glossary, captions,
//                        speed, pathways, palette }: only the ones changed from the default are stored
//   lms-hide-completed   "1" or "0": the catalogue's "Hide completed" switch (src/components/
//                        CatalogFilter.tsx), older than the rest and kept under its own key
//
// Each stored preference is also set on <html> as data-lms-<name>, which the CSS reads (text size,
// width, motion, the "On this page" column, the pinned breadcrumb bar, glossary underlines, the
// colour theme). static/head/preferences.js (from src/head/preferences.js)
// does that before the page is drawn, so pages don't jump once the scripts load; this module keeps
// it up to date when a preference changes, here or in another tab.
import { useSyncExternalStore } from 'react';
import { STORED_PALETTES } from './palettes';

const KEY = 'lms-preferences-v1';
const HIDE_KEY = 'lms-hide-completed';

export type Preferences = {
	/** Text size: the whole page, as with browser zoom, so line lengths stay the same. */
	text?: 'large' | 'larger';
	/** A wider text column on lesson and guide pages, or one as wide as the screen allows. */
	width?: 'wide' | 'full';
	/** Turn animations and transitions off, whatever the device says. */
	motion?: 'reduce';
	/** "On this page" jumps to a heading instead of a quick scroll (src/client/toc-scroll.ts). */
	scroll?: 'instant';
	/** Code blocks too wide for the column start word-wrapped (src/theme/CodeBlock/Buttons/WordWrapButton). */
	wrap?: 'on';
	/** "On this page" collapsed, on screens wide enough to show it beside the text (src/theme/DocBreadcrumbs). */
	toc?: 'hidden';
	/** The breadcrumb bar scrolls away with the page instead of staying pinned under the navbar. */
	breadcrumbs?: 'scroll';
	/** Glossary terms in lessons as plain text: no underline, no tip. */
	glossary?: 'off';
	/** Lesson video captions on from the start. */
	captions?: 'on';
	/** Playback speed for lesson videos and terminal recordings, e.g. "1.25". */
	speed?: string;
	/** Pathway cards list every course instead of the first few and "+N more courses". */
	pathways?: 'all';
	/** A colour theme other than the site's own light or dark (src/lib/palettes.ts). */
	palette?: string;
};
export const PREFERENCE_NAMES = ['text', 'width', 'motion', 'scroll', 'wrap', 'toc', 'breadcrumbs', 'glossary', 'captions', 'speed', 'pathways', 'palette'] as const;
export const SPEEDS = ['0.75', '1', '1.25', '1.5', '2'];
/** Each preference's values other than its default (which isn't stored). */
const CHOICES: Record<(typeof PREFERENCE_NAMES)[number], string[]> = {
	text: ['large', 'larger'],
	width: ['wide', 'full'],
	motion: ['reduce'],
	scroll: ['instant'],
	wrap: ['on'],
	toc: ['hidden'],
	breadcrumbs: ['scroll'],
	glossary: ['off'],
	captions: ['on'],
	speed: SPEEDS.filter((speed) => speed !== '1'),
	pathways: ['all'],
	palette: STORED_PALETTES,
};

const NONE: Preferences = {};
let snapshot: Preferences | undefined;
const listeners = new Set<() => void>();

function load(): Preferences {
	try {
		const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}');
		if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {};
		// A colour theme no longer offered: back to the site's own colours.
		const known = (name: (typeof PREFERENCE_NAMES)[number]) => typeof saved[name] === 'string' && (name !== 'palette' || CHOICES.palette.includes(saved[name]));
		return Object.fromEntries(PREFERENCE_NAMES.filter(known).map((name) => [name, saved[name]]));
	} catch {
		return {};
	}
}

/** Sets data-lms-<name> on <html> for each preference (and removes the rest). */
function apply(preferences: Preferences) {
	const root = document.documentElement;
	for (const name of PREFERENCE_NAMES) {
		const value = preferences[name];
		if (value) root.setAttribute(`data-lms-${name}`, value);
		else root.removeAttribute(`data-lms-${name}`);
	}
}

function changed() {
	snapshot = load();
	apply(snapshot);
	listeners.forEach((listener) => listener());
}

/** The current preferences (outside React: video and recording players read these as they start). */
export const getPreferences = (): Preferences => (snapshot ??= typeof window === 'undefined' ? NONE : load());

/** Changes some preferences: `undefined` (or the default) puts one back to its default. */
export function setPreferences(change: Preferences) {
	const next: Record<string, string | undefined> = { ...getPreferences(), ...change };
	if (next.speed === '1') delete next.speed;
	for (const name of PREFERENCE_NAMES) if (!next[name]) delete next[name];
	try {
		if (Object.keys(next).length) localStorage.setItem(KEY, JSON.stringify(next));
		else localStorage.removeItem(KEY);
		changed();
	} catch {
		// Storage unavailable: apply for this page only.
		snapshot = next as Preferences;
		apply(snapshot);
		listeners.forEach((listener) => listener());
	}
}

/** Every preference back to its default (not "Hide completed", which the catalogue pages show). */
export const resetPreferences = () => setPreferences(Object.fromEntries(PREFERENCE_NAMES.map((name) => [name, undefined])));

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

export const usePreferences = () => useSyncExternalStore(subscribe, getPreferences, () => NONE);

/** The catalogue's "Hide completed" choice. */
export function getHideCompleted() {
	try {
		return localStorage.getItem(HIDE_KEY) === '1';
	} catch {
		return false;
	}
}
export function setHideCompleted(hide: boolean) {
	try {
		localStorage.setItem(HIDE_KEY, hide ? '1' : '0');
	} catch {
		// Storage unavailable: the switch still works on this page.
	}
}

/** For a progress backup (the Settings page adds it): the preferences set here, and "Hide completed" if chosen. */
export function preferencesBackup(): Preferences & { hideCompleted?: boolean } {
	let hide: string | null = null;
	try {
		hide = localStorage.getItem(HIDE_KEY);
	} catch {
		// Storage unavailable: nothing chosen.
	}
	return { ...getPreferences(), ...(hide === null ? {} : { hideCompleted: hide === '1' }) };
}

/**
 * Restoring a backup on another device: takes the backup's preferences only where this browser is
 * on the default (a phone keeps its own text size), skipping any it doesn't know. Returns how many
 * it set.
 */
export function fillPreferences(saved: unknown): number {
	if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return 0;
	const backup = saved as Record<string, unknown>;
	const current = getPreferences();
	const change: Preferences = {};
	for (const name of PREFERENCE_NAMES) {
		const value = backup[name];
		if (!current[name] && typeof value === 'string' && CHOICES[name].includes(value)) (change as Record<string, string>)[name] = value;
	}
	let filled = Object.keys(change).length;
	if (filled) setPreferences(change);
	try {
		if (typeof backup.hideCompleted === 'boolean' && localStorage.getItem(HIDE_KEY) === null) {
			setHideCompleted(backup.hideCompleted);
			filled++;
		}
	} catch {
		// Storage unavailable: nothing to fill.
	}
	return filled;
}

// A preference changed in another tab.
if (typeof window !== 'undefined') {
	window.addEventListener('storage', (event) => {
		if (event.key === KEY || event.key === null) changed();
	});
}
