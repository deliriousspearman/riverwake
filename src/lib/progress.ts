// Per-browser lesson progress. Stored only in this visitor's localStorage — nothing is sent
// anywhere. Never rename the keys: visitors would lose their progress.
//
//   lms-progress-v1      { "/courses/<course>/<lesson>": completedAt (ms) }
//   lms-last-lesson-v1   the last lesson page visited, for "Continue learning" on the home page
//   lms-quiz-v1          quiz answers (src/lib/quiz-answers.ts), cleared and backed up with these
//
// Docusaurus pages are React and navigate without reloading, so components subscribe to the store
// and re-render when it changes, in this tab or another. Each hook watches only what it shows
// (useIsDone, useProgressMap, useLastLesson, useStorageWorks): progress and the last lesson are
// cached separately, so visiting a lesson (which records it as the last one) doesn't re-render every
// sidebar tick and card, and completing a lesson only re-renders what depends on that lesson.
// Pages render the "no progress" state on the server and during hydration, then the stored state.
import { useSyncExternalStore } from 'react';
import { loadQuizAnswers, mergeQuizAnswers, saveQuizAnswers } from './quiz-answers';

const STORAGE_KEY = 'lms-progress-v1';
const LAST_LESSON_KEY = 'lms-last-lesson-v1';

export type Progress = Record<string, number>;

/** Site path without trailing slash, as progress keys and catalogue paths are stored. */
export const normalise = (path: string) => path.replace(/\/+$/, '') || '/';

// Fallback when storage is unavailable (blocked site data): progress lasts until the page unloads.
let memory: Progress | undefined;
let lastLessonMemory: string | undefined;
let storageWorks = true;
// What the hooks read, until the next change of that part of the store.
let progressSnapshot: Progress | undefined;
let lastLessonSnapshot: { path: string | undefined } | undefined;
const listeners = new Set<() => void>();

function testStorage() {
	try {
		localStorage.setItem('lms-storage-test', '1');
		localStorage.removeItem('lms-storage-test');
		return true;
	} catch {
		return false;
	}
}

function load(): Progress {
	if (memory) return { ...memory };
	try {
		const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
		// An array would pass the object check, but JSON.stringify drops keys set on it.
		return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
	} catch {
		return {};
	}
}

function loadLastLesson(): string | undefined {
	try {
		return localStorage.getItem(LAST_LESSON_KEY) ?? lastLessonMemory;
	} catch {
		return lastLessonMemory;
	}
}

/** Drops the cached parts that changed, then tells the subscribed components. */
function emit(changed: { progress?: boolean; lastLesson?: boolean }) {
	if (changed.progress) progressSnapshot = undefined;
	if (changed.lastLesson) lastLessonSnapshot = undefined;
	for (const listener of listeners) listener();
}

function save(progress: Progress) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
	} catch {
		memory = progress;
		storageWorks = false;
	}
	emit({ progress: true });
}

function saveLastLesson(path: string | undefined) {
	lastLessonMemory = path;
	try {
		if (path) localStorage.setItem(LAST_LESSON_KEY, path);
		else localStorage.removeItem(LAST_LESSON_KEY);
	} catch {
		// Storage unavailable: remembered for this page only.
	}
	emit({ lastLesson: true });
}

let started = false;
function subscribe(listener: () => void) {
	if (!started) {
		started = true;
		storageWorks = testStorage();
		// Keep other open tabs in sync.
		window.addEventListener('storage', (event) => {
			if (event.key === STORAGE_KEY || event.key === LAST_LESSON_KEY) {
				emit({ progress: event.key === STORAGE_KEY, lastLesson: event.key === LAST_LESSON_KEY });
			}
		});
	}
	listeners.add(listener);
	return () => listeners.delete(listener);
}

/** The stored progress; the same object until progress changes (don't modify it). */
export const getProgressSnapshot = (): Progress => (progressSnapshot ??= load());
/** The last lesson visited, if any. */
export const getLastLessonSnapshot = () => (lastLessonSnapshot ??= { path: loadLastLesson() }).path;

const NO_PROGRESS: Progress = {};

export const markComplete = (path: string) => save({ ...load(), [normalise(path)]: Date.now() });
export function markIncomplete(path: string) {
	const progress = load();
	delete progress[normalise(path)];
	save(progress);
}
export function resetProgress() {
	save({});
	saveLastLesson(undefined);
	saveQuizAnswers({});
}
// Backups ("Download a backup" on the Settings page, src/pages/settings.tsx): progress lives in one
// browser, so a learner can save it to a file and restore it in another browser or on another device.
const BACKUP_FORMAT = 'codex-progress-v1';

/** This browser's progress as a backup file's contents. */
export function progressBackup() {
	return { format: BACKUP_FORMAT, exportedAt: new Date().toISOString(), progress: load(), lastLesson: loadLastLesson() ?? null, quizzes: loadQuizAnswers() };
}

/**
 * Merges a backup (parsed JSON) into this browser's progress: nothing is lost on either side, and a
 * lesson completed in both keeps the later time. Quiz answers merge the same way (backups made
 * before quizzes were remembered have none). Returns how many lessons it added; throws if `data`
 * isn't a backup.
 */
export function restoreProgress(data: unknown): number {
	const backup = data as { format?: unknown; progress?: unknown; lastLesson?: unknown; quizzes?: unknown } | null;
	if (!backup || typeof backup !== 'object' || backup.format !== BACKUP_FORMAT) throw new Error('Not a progress backup');
	const saved = backup.progress;
	if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw new Error('Not a progress backup');
	const progress = load();
	let added = 0;
	for (const [path, completedAt] of Object.entries(saved)) {
		if (!path.startsWith('/') || typeof completedAt !== 'number' || !Number.isFinite(completedAt)) continue;
		const key = normalise(path);
		if (!(key in progress)) added++;
		progress[key] = Math.max(progress[key] ?? 0, completedAt);
	}
	save(progress);
	// "Continue learning" resumes the backup's last lesson only if this browser has none of its own.
	if (typeof backup.lastLesson === 'string' && backup.lastLesson.startsWith('/') && !loadLastLesson()) saveLastLesson(normalise(backup.lastLesson));
	mergeQuizAnswers(backup.quizzes);
	return added;
}

/** Forgets the "Continue learning" lesson, keeping progress (Settings page). */
export const forgetLastLesson = () => saveLastLesson(undefined);
/** Lesson pages record themselves as the last lesson visited. */
export const recordLastLesson = (path: string) => loadLastLesson() !== normalise(path) && saveLastLesson(normalise(path));
export const canSave = () => storageWorks;

/** Move progress saved under old paths of moved pages (`aliases` frontmatter) to their new paths. */
export function migrateAliases(aliases: Record<string, string>) {
	if (!Object.keys(aliases).length) return;
	const progress = load();
	let moved = false;
	for (const [path, completedAt] of Object.entries(progress)) {
		const to = aliases[path];
		if (!to) continue;
		progress[to] = Math.max(progress[to] ?? 0, completedAt);
		delete progress[path];
		moved = true;
	}
	if (moved) save(progress);
	const last = loadLastLesson();
	if (last && aliases[last]) saveLastLesson(aliases[last]);
}

/** Whether a lesson at `path` is complete in `progress`. */
export const isDoneIn = (progress: Progress, path: string) => normalise(path) in progress;

/** All progress, re-rendering when it changes (not when the last lesson does). */
export const useProgressMap = () => useSyncExternalStore(subscribe, getProgressSnapshot, () => NO_PROGRESS);

/** Whether one lesson is complete: re-renders only when that changes. */
export function useIsDone(path: string) {
	const key = normalise(path);
	return useSyncExternalStore(subscribe, () => key in getProgressSnapshot(), () => false);
}

/** The last lesson page visited (for "Continue learning"). */
export const useLastLesson = () => useSyncExternalStore(subscribe, getLastLessonSnapshot, () => undefined);

/** False when the browser blocks site storage, so progress can't be saved. */
export const useStorageWorks = () => useSyncExternalStore(subscribe, () => storageWorks, () => true);

export type ProgressSummary = {
	count: number;
	total: number;
	started: boolean;
	complete: boolean;
	/** Where the Continue link goes, and its label. */
	next: string | undefined;
	nextLabel: string;
};

/**
 * Progress through a list of lessons (a course, or a pathway's courses). The Continue link resumes after the most recently
 * completed lesson, so a lesson skipped early on doesn't pull the learner back; skipped lessons
 * come round at the end.
 */
export function summarise(progress: Progress, lessons: string[], startLabel = 'Start course →'): ProgressSummary {
	const done = (l: string) => normalise(l) in progress;
	const count = lessons.filter(done).length;
	const completedAt = (l: string) => progress[normalise(l)] ?? 0;
	const latest = lessons.reduce((best, l, i) => (completedAt(l) > completedAt(lessons[best]) ? i : best), 0);
	const from = count ? latest + 1 : 0;
	const firstIncomplete = [...lessons.slice(from), ...lessons.slice(0, from)].find((l) => !done(l));
	return {
		count,
		total: lessons.length,
		started: count > 0,
		complete: lessons.length > 0 && count === lessons.length,
		next: lessons.length ? `${normalise(firstIncomplete ?? lessons[0])}/` : undefined,
		nextLabel: count === 0 ? startLabel : firstIncomplete ? 'Continue →' : 'Review from the start →',
	};
}
