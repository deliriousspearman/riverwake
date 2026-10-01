// Pro lab flags a learner has captured, in this browser (like course progress, src/lib/progress.ts,
// but kept apart: it isn't in backups or "Reset progress"). Never rename the key.
//
//   lms-lab-flags-v1   { "<lab slug>": { "<flag id>": capturedAt (ms) } }
//
// A submitted flag is checked here, in the browser: the site has only each flag's hash
// (scripts/lab-flags.mjs, which hashes the same way), never its value. A flag's id is the start of
// its hash, so a flag whose value an editor changes starts uncaptured.
import { useSyncExternalStore } from 'react';
import type { Lab, LabFlag } from './catalog';
import type { ProgressSummary } from './progress';

const KEY = 'lms-lab-flags-v1';

export type Captured = Record<string, number>;
type Store = Record<string, Captured>;

const NONE: Captured = {};
let memory: Store | undefined;
let snapshot: Store | undefined;
const listeners = new Set<() => void>();

function load(): Store {
	if (memory) return memory;
	try {
		const parsed = JSON.parse(localStorage.getItem(KEY) ?? '{}');
		return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
	} catch {
		return {};
	}
}

function save(store: Store) {
	try {
		localStorage.setItem(KEY, JSON.stringify(store));
	} catch {
		// Storage unavailable: kept for this page only.
		memory = store;
	}
	snapshot = undefined;
	listeners.forEach((listener) => listener());
}

const getStore = () => (snapshot ??= load());

function subscribe(listener: () => void) {
	listeners.add(listener);
	const onStorage = (event: StorageEvent) => {
		if (event.key === KEY || event.key === null) {
			snapshot = undefined;
			listener();
		}
	};
	window.addEventListener('storage', onStorage);
	return () => {
		listeners.delete(listener);
		window.removeEventListener('storage', onStorage);
	};
}

/** The flags captured in one lab: flag id → when. Empty on the server and during hydration. */
export function useLabFlags(slug: string): Captured {
	return useSyncExternalStore(
		subscribe,
		() => getStore()[slug] ?? NONE,
		() => NONE,
	);
}

/** The hash the site has for `text` as one of this lab's flags (as scripts/lab-flags.mjs makes it). */
export async function hashFlag(slug: string, text: string): Promise<string> {
	const bytes = new TextEncoder().encode(`codex-flag:${slug}:${text.trim()}`);
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Whether this browser can check flags (Web Crypto needs a secure address: https or localhost). */
export const canCheckFlags = () => typeof crypto !== 'undefined' && !!crypto.subtle;

export type FlagResult = { result: 'captured'; flag: LabFlag } | { result: 'already'; flag: LabFlag; at: number } | { result: 'wrong' };

/** Checks a submitted flag against the lab's, and records it if it's one of them. */
export async function submitFlag(lab: Pick<Lab, 'slug' | 'flagList'>, text: string): Promise<FlagResult> {
	const hash = await hashFlag(lab.slug, text);
	const flag = lab.flagList.find((f) => f.hash === hash);
	if (!flag) return { result: 'wrong' };
	const store = load();
	const captured = store[lab.slug] ?? {};
	if (captured[flag.id]) return { result: 'already', flag, at: captured[flag.id] };
	save({ ...store, [lab.slug]: { ...captured, [flag.id]: Date.now() } });
	return { result: 'captured', flag };
}

/** "GATE · User", or just the label for a flag that isn't on one machine. */
export const flagName = (flag: LabFlag) => (flag.machine ? `${flag.machine} · ${flag.label}` : flag.label);

/** A lab's flag progress in the shape the course progress parts take (ProgressRow, progressClasses). */
export function labFlagSummary(lab: Pick<Lab, 'flagList'>, captured: Captured): ProgressSummary {
	const total = lab.flagList.length;
	const count = lab.flagList.filter((f) => captured[f.id]).length;
	// No "Continue" link for a lab.
	return { count, total, started: count > 0, complete: total > 0 && count === total, next: undefined, nextLabel: '' };
}
