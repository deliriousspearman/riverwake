// Checks the files under static/, which are published as they are on the site's own address.
// The admin editor uploads there (images, downloads, captions), and a file a browser can run, such as
// an HTML page or an SVG with a script in it, would run as part of the site when opened directly:
// it could then read what the site keeps in the browser, including a signed-in editor's GitLab
// token. So each folder takes only its own file types, and SVGs must be plain pictures. draw.io
// diagrams (.drawio.svg) are checked by scripts/drawio-svg.mjs instead, as lessons show them inline:
// only drawing elements, and a copy of the diagram so they can be opened in draw.io again (the
// published copy is cleaned in the build, which drops draw.io's Google Fonts import).
// Images also have a size limit, and a warning below it: each is downloaded in full where shown.
// plugins/lms-content.mjs runs this with the other content checks, so a bad upload fails the build.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ATTACHMENT_TYPES, extensionOf } from './attachments.mjs';
import { STATIC_DIR } from './content.mjs';
import { DRAWIO_SVG, readDrawioSvg } from './drawio-svg.mjs';

const IMAGES = ['png', 'jpg', 'jpeg', 'webp', 'avif', 'gif', 'svg'];

// File types allowed in each top-level folder of static/ ('' is static/ itself).
export const STATIC_TYPES = {
	'': [...IMAGES, 'ico', 'txt'],
	images: IMAGES,
	files: Object.keys(ATTACHMENT_TYPES),
	captions: ['vtt'],
	casts: ['cast'],
	videos: ['mp4', 'webm'],
};
// Written by scripts/prepare.mjs from cms/ and node_modules, not uploaded.
const GENERATED = new Set(['admin', 'vendor', 'head']);

// Images are downloaded in full wherever they're shown (no resizing on the way). Above the warning
// size the build says so; above the limit it fails. Keep IMAGE_MAX_KB in step with the media
// library's `max_file_size` in cms/config.yml. (Course pictures have their own, smaller limit.)
export const IMAGE_WARN_KB = 500;
export const IMAGE_MAX_KB = 1024;
const RESIZE = 'resize it (about 1600px wide is plenty for a lesson) or save it as WebP or a compressed JPEG';

// Things in an SVG that can run script or load from elsewhere when it's opened as a page.
const SVG_RISKS = [
	[/<script\b/i, 'a <script>'],
	[/<(foreignObject|iframe|embed|object)\b/i, 'embedded HTML (<foreignObject>, <iframe>, <embed> or <object>)'],
	[/\son[a-z]+\s*=/i, 'an event handler attribute (on…=)'],
	[/(java|vb)script:/i, 'a javascript: link'],
	[/\s(xlink:)?href\s*=\s*["']\s*(https?:)?\/\//i, 'a link to another site (href="https://…")'],
	[/@import\b|url\(\s*["']?\s*(https?:)?\/\//i, 'a stylesheet import or url() from another site'],
];

/** Problems with an SVG's contents (empty if it's a plain picture). */
export function svgProblems(svg) {
	return SVG_RISKS.filter(([pattern]) => pattern.test(svg)).map(([, what]) => what);
}

/** Every file under `dir`, as a path relative to it. */
export function* filesUnder(dir, prefix = '') {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
		if (entry.isDirectory()) yield* filesUnder(join(dir, entry.name), rel);
		else yield rel;
	}
}

/** Problems with the files under static/ (`staticDir` is for tests), each naming the file. */
export function staticFileProblems(staticDir = STATIC_DIR) {
	const problems = [];
	for (const rel of filesUnder(staticDir)) {
		const folder = rel.includes('/') ? rel.slice(0, rel.indexOf('/')) : '';
		if (GENERATED.has(folder)) continue;
		const allowed = STATIC_TYPES[folder];
		const ext = extensionOf(rel);
		if (!allowed) {
			problems.push(`static/${rel}: static/${folder}/ isn't a folder the site uses (${Object.keys(STATIC_TYPES).filter(Boolean).join(', ')})`);
		} else if (ext === 'drawio' && allowed.includes('svg')) {
			problems.push(`static/${rel}: draw.io diagrams go on the site as .drawio.svg, which is both the picture and the diagram: in draw.io, File → Export as → SVG, with “Include a copy of my diagram” ticked, and name it <name>.drawio.svg`);
		} else if (!allowed.includes(ext)) {
			problems.push(`static/${rel}: .${ext || '(no extension)'} files aren't allowed in static/${folder ? `${folder}/` : ''} (allowed: ${allowed.join(', ')})`);
		} else if (DRAWIO_SVG.test(rel)) {
			const { problems: issues } = readDrawioSvg(readFileSync(join(staticDir, rel), 'utf8'));
			if (issues.length) problems.push(`static/${rel}: this draw.io diagram has ${issues.join('; ')}`);
		} else if (ext === 'svg') {
			const risks = svgProblems(readFileSync(join(staticDir, rel), 'utf8'));
			if (risks.length) problems.push(`static/${rel}: this SVG contains ${risks.join(', ')}; export it as a plain picture or use PNG/WebP`);
		}
		if (folder === 'images' && kb(staticDir, rel) > IMAGE_MAX_KB) {
			problems.push(`static/${rel}: ${kb(staticDir, rel)} KB is over the ${IMAGE_MAX_KB} KB limit for images; ${RESIZE}`);
		}
	}
	return problems;
}

const kb = (staticDir, rel) => Math.round(statSync(join(staticDir, rel)).size / 1024);

/** Images big enough to slow pages down, but under the limit: build-log warnings. */
export function staticFileWarnings(staticDir = STATIC_DIR) {
	return [...filesUnder(staticDir)]
		.filter((rel) => rel.startsWith('images/') && STATIC_TYPES.images.includes(extensionOf(rel)))
		.map((rel) => [rel, kb(staticDir, rel)])
		.filter(([, size]) => size > IMAGE_WARN_KB && size <= IMAGE_MAX_KB)
		.map(([rel, size]) => `static/${rel} is ${size} KB, and is downloaded in full wherever it's shown: ${RESIZE}.`);
}

