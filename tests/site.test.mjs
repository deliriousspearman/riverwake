// Smaller helpers: the security policy (scripts/csp.mjs) and the raw HTML check
// (plugins/rehype-safe-html.mjs), banner contrast (scripts/banner.mjs),
// lesson summaries and sections (scripts/summary.mjs, scripts/sections.mjs), and themes
// (scripts/themes.mjs) against the CMS's theme list, and the visitor's colour themes
// (src/lib/palettes.ts, src/css/site/palettes.css).
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parse } from 'yaml';
import { bannerWarnings, contrastRatio } from '../scripts/banner.mjs';
import { elementProblems } from '../plugins/rehype-safe-html.mjs';
import { classifyScripts, externalEmbeds, withCsp } from '../scripts/csp.mjs';
import { parseGitHistory } from '../scripts/dates.mjs';
import { compareLessons, sectionTitle } from '../scripts/sections.mjs';
import { sizeReport } from '../scripts/site-size.mjs';
import { letterOf, lessonSummary } from '../scripts/summary.mjs';
import { selectedTheme, SITE_STYLESHEETS, THEMES } from '../scripts/themes.mjs';
import { importTs, tempDir, writeFiles } from './helpers.mjs';

const sha = (text) => `'sha256-${createHash('sha256').update(text).digest('base64')}'`;

test('each page gets a policy right after <meta charset>, allowing only Docusaurus\'s own inline scripts', () => {
	const theme = 'window.theme=1';
	const html =
		'<html><head><meta charset=UTF-8><script src="/a.js"></script>' +
		'<script type=application/ld+json>{"name":"x"}</script>' +
		'<meta property=og:title content="The <script>alert(1)</script> tag"></head>' +
		`<body><svg></svg><script>${theme}</script><div id=__docusaurus><p>Text</p></div></body></html>`;
	const out = withCsp(html);
	assert.match(out, /^<html><head><meta charset=UTF-8><meta http-equiv="content-security-policy"/);
	// Only the theme script: not JSON-LD, and not "<script>" inside an attribute.
	assert.ok(out.includes(`script-src 'self' 'wasm-unsafe-eval' ${sha(theme)};`));
	assert.equal(out.match(/sha256-/g).length, 1);
	assert.deepEqual(classifyScripts(html), { trusted: [theme], unexpected: [] });
	assert.equal(withCsp('<html><head></head></html>'), undefined);
});

test('inline scripts that page content could have put there are reported, not allowed', () => {
	// A title that broke out of the breadcrumb JSON-LD lands in <head>; raw HTML lands in the app root.
	const html =
		'<html><head><meta charset=UTF-8><script type=application/ld+json>{"name":"x</script><script>steal()</script>"}</script></head>' +
		'<body><script>theme()</script><div id=__docusaurus><article><script>alert(1)</script></article></div></body></html>';
	assert.deepEqual(classifyScripts(html), { trusted: ['theme()'], unexpected: ['steal()', 'alert(1)'] });
	assert.ok(!withCsp(html).includes(sha('steal()')));
	assert.ok(!withCsp(html).includes(sha('alert(1)')));
});

test('a page without the app root may only hold the redirect to a moved lesson', () => {
	const redirect = "\n    window.location.href = '/courses/demo/new/' + window.location.search + window.location.hash;\n  ";
	const page = (script) => `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><script>${script}</script></html>`;
	assert.deepEqual(classifyScripts(page(redirect)), { trusted: [redirect], unexpected: [] });
	const evil = "window.location.href = 'javascript:alert(1)' + window.location.search + window.location.hash;";
	assert.deepEqual(classifyScripts(page(evil)).unexpected, [evil]);
});

test('raw HTML that could run script fails, with what was wrong', () => {
	assert.deepEqual(elementProblems('p', [['className', ['note']]]), []);
	assert.deepEqual(elementProblems('a', [['href', 'https://example.com/']]), []);
	assert.deepEqual(elementProblems('img', [['src', 'data:image/png;base64,AAAA']]), []);
	assert.deepEqual(elementProblems('script', []), ["<script> isn't allowed in page content"]);
	assert.deepEqual(elementProblems('img', [['src', '/x.png'], ['onError', 'alert(1)']]), ["<img onError=…>: event handler attributes aren't allowed"]);
	assert.match(elementProblems('a', [['href', ' JavaScript:alert(1)']])[0], /script links aren't allowed/);
	assert.match(elementProblems('a', [['href', 'data:text/html,<script>alert(1)</script>']])[0], /only allowed for images/);
	assert.match(elementProblems('iframe', [['src', '/x/']])[0], /<iframe> isn't allowed/);
});

test('images and media from other sites are reported; links and same-site files are not', () => {
	const html = '<img src="https://evil.example/x.png"><img src="/images/ok.png"><video poster="//cdn.example/p.jpg"></video><a href="https://docs.example">docs</a><img src="https://learn.example/i.png">';
	assert.deepEqual(externalEmbeds(html, 'https://learn.example'), ['https://evil.example/x.png', '//cdn.example/p.jpg']);
});

test('banner colours need enough contrast', () => {
	assert.equal(Math.round(contrastRatio('#000000', '#ffffff')), 21);
	const base = { enabled: true, message: 'Hi', backgroundColor: '#ffaf00', textColor: '#0e1a02' };
	assert.deepEqual(bannerWarnings(base), []);
	assert.match(bannerWarnings({ ...base, textColor: '#ffffff' })[0], /contrast of 1\.\d:1/);
	assert.match(bannerWarnings({ ...base, message: ' ' })[0], /has no message/);
	assert.deepEqual(bannerWarnings({ ...base, enabled: false, message: '' }), []);
});

test('lesson counts and glossary letters', () => {
	assert.equal(lessonSummary([{}, {}, {}]), '3 lessons');
	assert.equal(lessonSummary([{}]), '1 lesson');
	assert.equal(letterOf('802.1X'), '#');
	assert.equal(letterOf('kerberos'), 'K');
});

test('section folders: titles from the name, ordered by number', () => {
	assert.equal(sectionTitle('02-getting-started'), 'Getting started');
	assert.equal(sectionTitle('02-web', { '02-web': 'The web' }), 'The web');
	const lessons = [
		{ section: '10-late', id: 'b' },
		{ section: '', id: 'z', order: 2 },
		{ section: '2-early', id: 'a' },
		{ section: '', id: 'y', order: 1 },
	];
	assert.deepEqual(lessons.sort(compareLessons).map((l) => l.id), ['y', 'z', 'a', 'b']);
});

test('every theme is in the CMS theme list, and the CMS lists no others', () => {
	const cms = parse(readFileSync(new URL('../cms/config.yml', import.meta.url), 'utf8'));
	const settings = cms.collections.find((c) => c.files?.some((f) => f.name === 'theme'));
	const field = settings.files.find((f) => f.name === 'theme').fields.find((f) => f.name === 'theme');
	assert.deepEqual(field.options.map((o) => o.value).sort(), Object.keys(THEMES).sort());
});

test('the theme setting falls back to Hacklab, and an unknown one fails', (t) => {
	const dir = tempDir(t);
	assert.equal(selectedTheme(new URL(`file://${dir}/missing.yml`)), 'hacklab');
	writeFiles(dir, { 'theme.yml': 'theme: nightshift\n', 'bad.yml': 'theme: neon\n' });
	assert.equal(selectedTheme(new URL(`file://${dir}/theme.yml`)), 'nightshift');
	assert.throws(() => selectedTheme(new URL(`file://${dir}/bad.yml`)), /Unknown theme "neon"/);
});

test('page dates from one git log: first added (following renames) and latest change', () => {
	// `git log --reverse -M --name-status --format=%x00%ct`, oldest commit first.
	const log = ['', '100\n\nA\tdocs/a.md\nA\tdocs/b.md', '200\n\nM\tdocs/a.md', '300\n\nR095\tdocs/b.md\tdocs/c.md', '400\n\nM\tdocs/c.md'].join('\0');
	const { added, latest } = parseGitHistory(log);
	const seconds = (date) => date && date.getTime() / 1000;
	assert.equal(seconds(added.get('docs/a.md')), 100);
	assert.equal(seconds(latest.get('docs/a.md')), 200);
	// Renamed: keeps the date it was first added under its old name.
	assert.equal(seconds(added.get('docs/c.md')), 100);
	assert.equal(seconds(latest.get('docs/c.md')), 400);
	assert.equal(added.get('docs/missing.md'), undefined);
});

test('every Docusaurus package is pinned to the same exact version', () => {
	// Mixed Docusaurus versions break the build, and a range (^3.10.2) lets one package move on its own.
	const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
	const versions = Object.entries({ ...pkg.dependencies, ...pkg.devDependencies }).filter(([name]) => name.startsWith('@docusaurus/'));
	for (const [name, version] of versions) assert.match(version, /^\d+\.\d+\.\d+$/, `${name} must be an exact version, not ${version}`);
	assert.equal(new Set(versions.map(([, v]) => v)).size, 1, `Docusaurus packages differ: ${versions.map(([n, v]) => `${n}@${v}`).join(', ')}`);
});

test('the site size check warns near the GitLab Pages limit and fails above it, naming the largest files', () => {
	const MB = 1024 * 1024;
	const site = (videoMb) => [
		{ path: 'index.html', size: 50_000 },
		{ path: 'assets/js/main.js', size: 5 * MB },
		{ path: 'videos/course/long.mp4', size: videoMb * MB },
	];
	assert.equal(sizeReport(site(10)).level, 'ok');
	const warning = sizeReport(site(80));
	assert.equal(warning.level, 'warning');
	assert.match(warning.message, /85\.0 MB, 85% of GitLab Pages' 100 MB limit/);
	const error = sizeReport(site(100));
	assert.equal(error.level, 'error');
	assert.match(error.message, /over GitLab Pages' 100 MB limit, so it can't be published/);
	assert.match(error.message, /Largest folders:\n {2}videos\/ +100\.0 MB/);
	assert.match(error.message, /Largest files:\n +100\.0 MB {2}videos\/course\/long\.mp4/);
	// A different limit (PAGES_MAX_MB).
	assert.equal(sizeReport(site(100), 250).level, 'ok');
});

test('every stylesheet in src/css/site/ is loaded, once, in the listed order', () => {
	const files = readdirSync(new URL('../src/css/site/', import.meta.url)).filter((f) => f.endsWith('.css')).map((f) => f.replace(/\.css$/, ''));
	assert.deepEqual([...SITE_STYLESHEETS].sort(), files.sort(), 'scripts/themes.mjs SITE_STYLESHEETS and src/css/site/ differ');
	assert.equal(new Set(SITE_STYLESHEETS).size, SITE_STYLESHEETS.length);
	assert.equal(SITE_STYLESHEETS[0], 'theme', 'theme.css (the variables) loads first');
});

test('every colour theme sets every colour, matches src/lib/palettes.ts, and keeps its text readable', async () => {
	const { PALETTES, SITE_PALETTES, STORED_PALETTES } = await importTs('src/lib/palettes.ts');
	const css = readFileSync(new URL('../src/css/site/palettes.css', import.meta.url), 'utf8');
	const blocks = Object.fromEntries(
		[...css.matchAll(/^:root\[data-theme\]\[data-lms-palette='(\w+)'\] \{([^}]*)\}/gm)].map(([, id, body]) => [
			id,
			Object.fromEntries([...body.matchAll(/--([\w-]+): (#[0-9a-f]{6});/g)].map(([, name, value]) => [name, value])),
		]),
	);
	assert.deepEqual(Object.keys(blocks).sort(), [...STORED_PALETTES].sort(), 'src/lib/palettes.ts and palettes.css list different palettes');
	assert.ok(Object.values(SITE_PALETTES).every((id) => PALETTES.some((palette) => palette.id === id)));
	for (const palette of PALETTES) assert.match(palette.id, /^[a-z0-9]{1,16}$/, 'src/head/preferences.js only sets plain values');
	// The navbar shows each one's name from the first frame (src/css/site/navbar.css).
	const navbar = readFileSync(new URL('../src/css/site/navbar.css', import.meta.url), 'utf8');
	for (const id of STORED_PALETTES) assert.ok(navbar.includes(`[data-lms-palette='${id}'] .lms-theme-select [data-palette='${id}']`), `navbar.css doesn't show the name of ${id}`);

	// Every colour variable theme.css sets for dark mode (gray-7 too, for a light palette).
	const theme = readFileSync(new URL('../src/css/site/theme.css', import.meta.url), 'utf8');
	const dark = theme.slice(theme.indexOf('/* Dark */'), theme.indexOf(":root[data-theme='light']"));
	const colours = [...dark.matchAll(/--([\w-]+): #[0-9a-f]{6};/g)].map(([, name]) => name);
	for (const [id, values] of Object.entries(blocks)) {
		const base = PALETTES.find((palette) => palette.id === id).base;
		const missing = [...colours, ...(base === 'light' ? ['sl-color-gray-7', 'lms-terminal-accent', 'lms-terminal-accent-soft'] : [])].filter((name) => !values[name]);
		assert.deepEqual(missing, [], `${id} doesn't set these`);
		// Reading text 4.5:1 (WCAG AA); colour cues (difficulty chips, aside headings, quiz marks) 3:1.
		const pairs = [
			[4.5, 'sl-color-gray-2', 'sl-color-black'],
			[4.5, 'sl-color-gray-2', 'lms-panel'],
			[4.5, 'sl-color-gray-3', 'lms-panel'],
			[4.5, 'lms-accent-text', 'sl-color-black'],
			[4.5, 'lms-accent-text', 'lms-panel'],
			[4.5, base === 'light' ? 'sl-color-accent' : 'sl-color-accent-high', 'sl-color-black'],
			[4.5, 'lms-on-accent', 'lms-accent'],
			[4.5, 'lms-on-accent', 'lms-accent-soft'],
			[4.5, 'lms-on-info', 'lms-info'],
			[4.5, 'lms-terminal-text', 'lms-terminal-bg'],
			[4.5, values['lms-terminal-accent'] ? 'lms-terminal-accent' : 'lms-accent', 'lms-terminal-deep'],
			...['easy', 'medium', 'hard', 'right', 'wrong'].map((name) => [3, `lms-${name}`, 'lms-panel']),
			...['info', 'tip', 'caution', 'danger'].map((name) => [3, `lms-${name}`, 'sl-color-black']),
		];
		for (const [min, text, background] of pairs) {
			const ratio = contrastRatio(values[text], values[background]);
			assert.ok(ratio >= min, `${id}: --${text} on --${background} is ${ratio.toFixed(1)}:1, under ${min}:1`);
		}
	}
});
