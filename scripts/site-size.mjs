// Checks the built site's size after `npm run build` (npm's postbuild). GitLab Pages refuses a site
// above its size limit (100 MB unless a GitLab admin changed it: Admin → Settings → Preferences →
// Pages, and the job artifact limit), and then the deploy fails with a message that doesn't say why
// the site got big, and every later save fails too. So: a warning from 80% of the limit, and above
// it the build fails here, with the folders and the largest files, before the deploy is tried.
//
// PAGES_MAX_MB sets the limit (a CI/CD variable, if this GitLab's differs). Sizes are of the files
// as built, which is at least what GitLab counts.
import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = new URL('..', import.meta.url).pathname;
export const DEFAULT_LIMIT_MB = 100;
export const WARN_SHARE = 0.8;
const MB = 1024 * 1024;

/** Every file under `dir`, with its size and its path relative to `dir`. */
export function filesIn(dir, base = dir) {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) return filesIn(path, base);
		return entry.isFile() ? [{ path: relative(base, path).split(sep).join('/'), size: statSync(path).size }] : [];
	});
}

const mb = (bytes) => `${(bytes / MB).toFixed(1)} MB`;

/**
 * What to say about a site of these files: nothing below the warning size, otherwise a message, and
 * whether it's over the limit. Lists the top-level folders by size and the largest files.
 */
export function sizeReport(files, limitMb = DEFAULT_LIMIT_MB) {
	const total = files.reduce((sum, file) => sum + file.size, 0);
	const limit = limitMb * MB;
	if (total < limit * WARN_SHARE) return { total, level: 'ok' };
	const folders = new Map();
	for (const file of files) {
		const top = file.path.includes('/') ? `${file.path.split('/')[0]}/` : '(top level)';
		folders.set(top, (folders.get(top) ?? 0) + file.size);
	}
	const byFolder = [...folders].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, size]) => `  ${name.padEnd(14)} ${mb(size)}`);
	const largest = [...files].sort((a, b) => b.size - a.size).slice(0, 8).map((file) => `  ${mb(file.size).padStart(9)}  ${file.path}`);
	const over = total > limit;
	const headline = over
		? `The built site is ${mb(total)}, over GitLab Pages' ${limitMb} MB limit, so it can't be published.`
		: `The built site is ${mb(total)}, ${Math.round((total / limit) * 100)}% of GitLab Pages' ${limitMb} MB limit.`;
	const message = [
		headline,
		'Largest folders:',
		...byFolder,
		'Largest files:',
		...largest,
		'Videos are usually the cause: keep them short and compressed (see the guide, "Images, downloads and video"), or host long ones elsewhere.',
	].join('\n');
	return { total, level: over ? 'error' : 'warning', message };
}

function main() {
	const limitMb = Number(process.env.PAGES_MAX_MB) || DEFAULT_LIMIT_MB;
	const report = sizeReport(filesIn(join(ROOT, 'build')), limitMb);
	if (report.level === 'ok') {
		console.log(`[site-size] The built site is ${mb(report.total)} (GitLab Pages' limit: ${limitMb} MB).`);
		return;
	}
	if (report.level === 'warning') {
		console.warn(`[site-size] Warning: ${report.message}`);
		return;
	}
	console.error(`[site-size] ${report.message}`);
	process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
