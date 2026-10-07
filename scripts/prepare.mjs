// Prepares static files before `docusaurus start` and `docusaurus build` (npm's predev/prebuild):
//
// 1. /admin (Sveltia CMS):
//    - copies the pinned Sveltia CMS bundle from node_modules (self-hosted — no third-party CDN),
//      with its UI translations. Sveltia bundles only en-US and fetches other languages from
//      unpkg.com, which the admin CSP blocks; in a browser set to e.g. en-GB it then retried
//      endlessly and froze the page. So the package's locales/ are copied to /admin/locales/ and
//      the bundle's locale URL is pointed there. Likewise Immutable.js, which Sveltia fetches from
//      unpkg.com when a custom preview is registered (cms/preview.mjs needs it): the version
//      Sveltia asks for (a pinned devDependency) is copied to /admin/vendor/, and the bundle loads it
//      from there. Sveltia's other unpkg extras (image conversion, maps, …) stay blocked. Its UI
//      fonts (Source Sans 3, Noto Mono, and Material Symbols, which draws its icons) come from
//      jsDelivr; they're copied from the pinned @fontsource packages (devDependencies, the versions
//      the bundle names) to /admin/fonts/, so the editor needs nothing from the internet.
//    - renders the templates cms/config.yml and cms/index.html (the page, with its
//      Content-Security-Policy) into static/admin/, and copies cms/frame-guard.js there. ${VAR}
//      placeholders are filled from the environment, and only these variables are allowed (the
//      results are public): CI_SERVER_URL, CI_PROJECT_PATH, CI_DEFAULT_BRANCH, CMS_APP_ID,
//      SITE_URL; CMS_GITLAB_URL when browsers reach GitLab at another address than CI_SERVER_URL,
//      and CMS_BRANCH when the editor should commit to another branch than CI_DEFAULT_BRANCH.
// 2. The asciinema player's stylesheet, copied to /vendor/ so pages with a recording can load it on
//    demand (src/client/asciinema.ts) instead of every page carrying it.
// 3. src/head/preferences.js, copied to /head/: the script every page loads in <head> to apply this
//    browser's preferences before the page is drawn (an inline script would break the page policy).
// 4. The admin editor's preview (cms/preview.mjs and cms/preview.css), bundled with esbuild into
//    static/admin/preview.js and static/admin/preview/ (the site's stylesheets for the selected theme,
//    with their fonts). The block code it shares with the build is Node code: its few Node-only
//    imports get browser stand-ins here (the files a block names aren't checked in the preview).
import { copyFileSync, cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { selectedTheme, themeStylesheets } from './themes.mjs';

const root = new URL('../', import.meta.url);
const out = new URL('static/admin/', root);
const dist = new URL('node_modules/@sveltia/cms/dist/', root);

mkdirSync(out, { recursive: true });
cpSync(new URL('chunks/', dist), new URL('chunks/', out), {
	recursive: true,
	filter: (src) => !src.endsWith('.map'),
});
cpSync(new URL('node_modules/@sveltia/cms/locales/', root), new URL('locales/', out), { recursive: true });

// The locale base URL in the minified bundle is `${unpkgBase}@${version}/locales`. Replace it with
// the self-hosted copy. If a Sveltia update changes that code, fail here rather than ship a CMS
// that freezes non-en-US browsers: check the new bundle and update this pattern.
const LOCALE_BASE = /`\$\{\w+\}@\$\{\w+\}\/locales`/g;
const bundle = readFileSync(new URL('sveltia-cms.js', dist), 'utf8');
const matches = bundle.match(LOCALE_BASE)?.length ?? 0;
if (matches !== 1) {
	throw new Error(`[prepare] expected 1 Sveltia locale URL to self-host, found ${matches}: update LOCALE_BASE.`);
}
// Immutable.js from /admin/vendor/: Sveltia imports `${unpkg}/<package>@<version>/<file>`.
const UNPKG_BASE = '`https://unpkg.com/${e}`';
const immutableWanted = /\bimmutable:`\D?([\d.]+)`/.exec(bundle)?.[1];
const immutableHere = JSON.parse(readFileSync(new URL('node_modules/immutable/package.json', root), 'utf8')).version;
if (bundle.split(UNPKG_BASE).length !== 2 || !immutableWanted) {
	throw new Error('[prepare] Sveltia\'s package loader changed: update UNPKG_BASE (custom previews need Immutable.js self-hosted).');
}
if (immutableWanted !== immutableHere) {
	throw new Error(`[prepare] Sveltia wants immutable ${immutableWanted}, but ${immutableHere} is installed: npm install --save-dev --save-exact immutable@${immutableWanted}`);
}
mkdirSync(new URL(`vendor/immutable@${immutableHere}/dist/`, out), { recursive: true });
copyFileSync(new URL('node_modules/immutable/dist/immutable.es.js', root), new URL(`vendor/immutable@${immutableHere}/dist/immutable.es.js`, out));

// Sveltia's UI fonts: https://cdn.jsdelivr.net/fontsource/fonts/<id>[:vf]@<version>/<file>, where
// `:vf` is the variable font (@fontsource-variable/<id>, otherwise @fontsource/<id>).
const FONT_URL = /https:\/\/cdn\.jsdelivr\.net\/fontsource\/fonts\/([a-z0-9-]+)(:vf)?@([\d.]+)\/([\w-]+\.woff2)/g;
const fonts = [...bundle.matchAll(FONT_URL)];
if (fonts.length !== 3) throw new Error(`[prepare] expected Sveltia's 3 UI fonts on jsDelivr, found ${fonts.length}: update FONT_URL and the font devDependencies.`);
mkdirSync(new URL('fonts/', out), { recursive: true });
for (const [, id, variable, version, file] of fonts) {
	const pkg = `@fontsource${variable ? '-variable' : ''}/${id}`;
	const here = JSON.parse(readFileSync(new URL(`node_modules/${pkg}/package.json`, root), 'utf8')).version;
	if (here !== version) throw new Error(`[prepare] Sveltia wants ${pkg}@${version}, but ${here} is installed: npm install --save-dev --save-exact ${pkg}@${version}`);
	copyFileSync(new URL(`node_modules/${pkg}/files/${id}-${file}`, root), new URL(`fonts/${id}-${file}`, out));
}
writeFileSync(
	new URL('sveltia-cms.js', out),
	bundle
		.replace(LOCALE_BASE, '`/admin/locales`')
		.replace(UNPKG_BASE, '(e===`immutable`?`/admin/vendor/${e}`:`https://unpkg.com/${e}`)')
		.replace(FONT_URL, (_, id, variable, version, file) => `/admin/fonts/${id}-${file}`)
		// It also tells the browser to connect to jsDelivr early, which is now pointless.
		.replace('<link rel="preconnect" href="https://cdn.jsdelivr.net/"/>', '<link rel="preconnect" href="/"/>'),
);

// Defaults for builds outside the pipeline (e.g. a local build): placeholders, as the pipeline's own
// CI_* variables name the real GitLab and project.
const DEFAULTS = {
	CI_SERVER_URL: 'https://gitlab.example.com',
	CI_PROJECT_PATH: 'group/codex',
	CI_DEFAULT_BRANCH: 'main',
	CMS_APP_ID: 'set-CMS_APP_ID',
	SITE_URL: 'http://localhost:3000',
};
// The only variables the templates may use: what they render is published.
const ALLOWED = [...Object.keys(DEFAULTS), 'CMS_GITLAB_URL', 'CMS_BRANCH'];
const env = Object.fromEntries(ALLOWED.map((name) => [name, process.env[name] || DEFAULTS[name]]));
env.CMS_GITLAB_URL ||= env.CI_SERVER_URL;
env.CMS_BRANCH ||= env.CI_DEFAULT_BRANCH;
// It goes into the admin page's policy, so it must be just an origin, like https://gitlab.example.com.
if (new URL(env.CMS_GITLAB_URL).origin !== env.CMS_GITLAB_URL.replace(/\/$/, '')) {
	throw new Error(`[prepare] CMS_GITLAB_URL must be an origin like https://gitlab.example.com, not ${env.CMS_GITLAB_URL}`);
}
env.CMS_GITLAB_URL = env.CMS_GITLAB_URL.replace(/\/$/, '');

/** cms/<name> with its ${VAR} placeholders filled in (YAML comment lines are left as they are). */
function render(name) {
	return readFileSync(new URL(`cms/${name}`, root), 'utf8')
		.split('\n')
		.map((line) =>
			line.trimStart().startsWith('#')
				? line
				: line.replace(/\$\{(\w+)\}/g, (_, variable) => {
						if (!(variable in env)) throw new Error(`cms/${name} uses \${${variable}}, which isn't one of ${ALLOWED.join(', ')}`);
						return env[variable];
					}),
		)
		.join('\n');
}
writeFileSync(new URL('config.yml', out), render('config.yml'));
writeFileSync(new URL('index.html', out), render('index.html'));
copyFileSync(new URL('cms/frame-guard.js', root), new URL('frame-guard.js', out));

if (env.CMS_APP_ID === 'set-CMS_APP_ID') {
	console.warn('[prepare] CMS_APP_ID not set — /admin login will not work until it is.');
}

mkdirSync(new URL('static/vendor/', root), { recursive: true });
copyFileSync(new URL('node_modules/asciinema-player/dist/bundle/asciinema-player.css', root), new URL('static/vendor/asciinema-player.css', root));

mkdirSync(new URL('static/head/', root), { recursive: true });
copyFileSync(new URL('src/head/preferences.js', root), new URL('static/head/preferences.js', root));

// 4. The admin editor's preview.
const STAND_INS = {
	// Quiz ids: any stable short hash does in the preview.
	'node:crypto': `export function createHash() {
		let text = '';
		const hash = { update(value) { text += String(value); return hash; }, digest() {
			let out = '';
			for (let seed = 0; out.length < 64; seed++) {
				let h = 2166136261 ^ seed;
				for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
				out += (h >>> 0).toString(16).padStart(8, '0');
			}
			return out;
		} };
		return hash;
	}`,
	// Files aren't checked in the preview, and downloads show no size.
	'node:fs': 'export const existsSync = () => true; export const statSync = () => ({ isFile: () => true, size: undefined });',
	'node:path': "export const extname = (path) => /\\.[^./]*$/.exec(path)?.[0] ?? '';",
	'content.mjs': "export const STATIC_DIR = '/';",
};
const standIns = {
	name: 'browser-stand-ins',
	setup(builder) {
		builder.onResolve({ filter: /^node:(crypto|fs|path)$|[/]content[.]mjs$/ }, (args) => ({ path: args.path.replace(/^.*[/]/, ''), namespace: 'stand-in' }));
		builder.onLoad({ filter: /.*/, namespace: 'stand-in' }, (args) => ({ contents: STAND_INS[args.path], loader: 'js' }));
	},
};
const rootPath = fileURLToPath(root);
await build({
	entryPoints: [fileURLToPath(new URL('cms/preview.mjs', root))],
	outfile: fileURLToPath(new URL('static/admin/preview.js', root)),
	bundle: true,
	format: 'iife',
	platform: 'browser',
	target: 'es2020',
	minify: true,
	legalComments: 'none',
	logLevel: 'warning',
	plugins: [standIns],
});
const previewCss = new URL('static/admin/preview/', root);
rmSync(previewCss, { recursive: true, force: true });
const stylesheets = [...themeStylesheets(selectedTheme()), './cms/preview.css'].map((path) => (path.startsWith('./') ? fileURLToPath(new URL(path, root)) : path));
await build({
	stdin: { contents: stylesheets.map((path) => `@import ${JSON.stringify(path)};`).join('\n'), resolveDir: rootPath, loader: 'css' },
	outfile: fileURLToPath(new URL('preview.css', previewCss)),
	bundle: true,
	minify: true,
	loader: { '.woff2': 'file', '.woff': 'file' },
	assetNames: '[name]-[hash]',
	logLevel: 'warning',
});
