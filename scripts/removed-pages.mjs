// Course and lesson pages that were published and then disappeared. Learners' progress and their
// bookmarks and links are tied to each page's address, so a page that goes away without a redirect
// silently loses both. This finds every course or lesson file that git history shows was deleted or
// renamed, and plugins/lms-content.mjs fails the build for each one whose address is now nothing:
// not a current page, not an old address in some page's `aliases` (a redirect), and not listed as
// removed on purpose in content/settings/removed-pages.yml ("Site settings → Removed pages").
// Only changes on or after `checkFrom` in that file (the date the site went live) count: while a site
// is being set up, courses and lessons are renamed freely and no learner has progress to lose. With
// no `checkFrom`, nothing is checked yet (the build warns).
// It needs the full git history, which the pipeline clones (GIT_DEPTH: 0).
import { spawnSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname;

/** A course file's page address: docs/courses/<course>/index.md → /courses/<course>, lessons likewise. */
export function pagePath(file) {
	const m = /^docs\/courses\/(.+?)\.mdx?$/.exec(file);
	if (!m) return undefined;
	return `/courses/${m[1].replace(/\/index$/, '')}`;
}

/**
 * Course pages whose file was deleted, or renamed away, in the output of
 * `git log --diff-filter=DR --name-status --format='%x00%h %cs' -- docs/courses` (newest first):
 * page address → { file, commit } of the latest such change. With `since` (YYYY-MM-DD), only
 * commits made on or after that day count.
 */
export function parseDeletedPages(output, since) {
	const pages = new Map();
	for (const commit of output.split('\0').slice(1)) {
		const [header, ...lines] = commit.split('\n');
		const [hash, date = ''] = header.trim().split(' ');
		if (since && date < since) continue;
		for (const line of lines) {
			const [status, file] = line.split('\t');
			const path = status && /^[DR]/.test(status) ? pagePath(file) : undefined;
			if (path && !pages.has(path)) pages.set(path, { file, commit: hash });
		}
	}
	return pages;
}

/**
 * Pages this repository's history shows were removed on or after `since` (YYYY-MM-DD); undefined if
 * git or its history isn't available.
 */
export function deletedPages(since) {
	const shallow = spawnSync('git', ['rev-parse', '--is-shallow-repository'], { cwd: ROOT, encoding: 'utf-8' });
	if (shallow.status !== 0 || shallow.stdout.trim() === 'true') return undefined;
	const log = spawnSync('git', ['log', '--diff-filter=DR', '--name-status', '--format=%x00%h %cs', '--', 'docs/courses'], {
		cwd: ROOT,
		encoding: 'utf-8',
		maxBuffer: 64 * 1024 * 1024,
	});
	return log.status === 0 ? parseDeletedPages(log.stdout, since) : undefined;
}

/**
 * Problems (one per page): removed pages that are now nothing. `current` is every course and lesson
 * address, `aliases` the redirects ({ oldPath: newPath }), `removed` the addresses removed on
 * purpose (each also covers everything under it, e.g. a whole course).
 */
export function removedPageProblems({ deleted, current, aliases, removed }) {
	const covered = (path) => removed.some((r) => path === r || path.startsWith(`${r}/`));
	return [...deleted]
		.filter(([path]) => !current.has(path) && !Object.hasOwn(aliases, path) && !covered(path))
		.map(([path, { file, commit }]) => `${path} (${file}, removed in commit ${commit})`);
}
