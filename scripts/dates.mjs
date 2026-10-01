// Page dates. "Created" comes from the `created`
// frontmatter field, or else the file's first git commit (following renames). "Last updated" comes
// from the `lastUpdated` frontmatter field, or else the file's latest commit; for a course overview
// it's the newest of the overview and all of its lessons. Both need the full git history at build
// time; files that aren't committed yet have no dates.
//
// The whole history is read with one `git log` the first time a date is needed (rather than two per
// page), giving every file's first and latest commit. If that fails, each file gets its own
// `git log`, as before.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, relative } from 'node:path';

const cache = new Map();
const ROOT = new URL('..', import.meta.url).pathname;

// The pages' dates from before they were added to this repository (content/imported-dates.json:
// Unix seconds, and the file's sha256 when imported). Without them, every page that came with the
// original content would show the date it was committed here.
const IMPORTED_DATES_FILE = new URL('../content/imported-dates.json', import.meta.url);
const importedDates = existsSync(IMPORTED_DATES_FILE) ? JSON.parse(readFileSync(IMPORTED_DATES_FILE, 'utf8')) : {};
const imported = (filePath, key) => {
	const seconds = importedDates[relative(ROOT, filePath)]?.[key];
	return seconds ? new Date(seconds * 1000) : undefined;
};
/** Whether the file is still exactly as it was when imported (checked once per file). */
const unchanged = new Map();
const unchangedSinceImport = (filePath) => {
	if (!unchanged.has(filePath)) {
		const hash = importedDates[relative(ROOT, filePath)]?.sha256;
		unchanged.set(filePath, hash !== undefined && createHash('sha256').update(readFileSync(filePath)).digest('hex') === hash);
	}
	return unchanged.get(filePath);
};

/**
 * Every file's first and latest commit dates, by path from the repository's top folder, from the
 * output of `git log --reverse -M --name-status --format=%x00%ct` (oldest first). A file's first date
 * follows renames (a renamed file keeps the date it was first added under its old name), like
 * `git log --follow`.
 */
export function parseGitHistory(output) {
	const added = new Map();
	const latest = new Map();
	for (const commit of output.split('\0').slice(1)) {
		const [time, ...lines] = commit.split('\n');
		const date = new Date(Number(time) * 1000);
		for (const line of lines) {
			const [status, ...paths] = line.split('\t');
			if (!status) continue;
			const path = paths.at(-1);
			if (status.startsWith('R')) added.set(path, added.get(paths[0]) ?? date);
			else if (status === 'A' && !added.has(path)) added.set(path, date);
			latest.set(path, date);
		}
	}
	return { added, latest };
}

/** This repository's history (parseGitHistory), read once; null if git fails. */
let history;
function repoHistory() {
	if (history !== undefined) return history;
	const top = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: ROOT, encoding: 'utf-8' });
	const log = spawnSync('git', ['log', '--reverse', '-M', '--name-status', '--format=%x00%ct'], {
		cwd: ROOT,
		encoding: 'utf-8',
		maxBuffer: 256 * 1024 * 1024,
	});
	if (top.status !== 0 || log.status !== 0) return (history = null);
	return (history = { top: top.stdout.trim(), ...parseGitHistory(log.stdout) });
}

/** Run `git log` for one file and return the date on the last line of output, if any. */
function gitDate(filePath, args) {
	const key = `${args.join(' ')}\0${filePath}`;
	if (cache.has(key)) return cache.get(key);
	const result = spawnSync('git', ['log', ...args, '--format=%ct', '--', basename(filePath)], {
		cwd: dirname(filePath),
		encoding: 'utf-8',
	});
	const timestamp = Number(result.stdout?.trim().split('\n').at(-1));
	const date = result.status === 0 && timestamp > 0 ? new Date(timestamp * 1000) : undefined;
	cache.set(key, date);
	return date;
}

/** First commit that added the file, following renames (git lists newest first, so the last line). */
export function firstCommitDate(filePath) {
	const h = repoHistory();
	return h ? h.added.get(relative(h.top, filePath)) : gitDate(filePath, ['--follow', '--diff-filter=A']);
}

/** Latest commit that touched the file. */
export function lastCommitDate(filePath) {
	const h = repoHistory();
	return h ? h.latest.get(relative(h.top, filePath)) : gitDate(filePath, ['--max-count=1']);
}

/** `data` is the page's validated frontmatter (scripts/schema.mjs). */
export function createdDate(filePath, data) {
	return data.created ?? imported(filePath, 'created') ?? firstCommitDate(filePath);
}

/** A page's own last-updated date. `lastUpdated: false` in frontmatter hides it. */
export function updatedDate(filePath, data) {
	if (data.lastUpdated instanceof Date) return data.lastUpdated;
	if (data.lastUpdated === false) return undefined;
	// Unchanged since the import: its original date. Edited since: this repository's latest commit.
	return (unchangedSinceImport(filePath) && imported(filePath, 'updated')) || lastCommitDate(filePath);
}

/** The newest of several dates (a course overview and its lessons), if any. */
export function newest(dates) {
	const known = dates.filter((d) => d !== undefined);
	return known.length ? new Date(Math.max(...known.map(Number))) : undefined;
}
