// Docusaurus plugin: adds the per-page Content-Security-Policy <meta> after the build, in
// Docusaurus's postBuild hook, and fails the build on inline scripts that aren't Docusaurus's own and
// on embeds from other sites (scripts/csp.mjs). The CMS under admin/ has its own, looser <meta>
// policy (static/admin/index.html), so it's skipped.
//
// It also stops the bundler from inlining small font files as data: URIs, which `font-src 'self'`
// would block.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { classifyScripts, externalEmbeds, withCsp } from '../scripts/csp.mjs';

function* htmlFiles(dir) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) yield* htmlFiles(path);
		else if (entry.name.endsWith('.html')) yield path;
	}
}

/** @type {import('@docusaurus/types').PluginModule} */
export default function lmsCsp(context, { exclude = ['admin/'] } = {}) {
	return {
		name: 'lms-csp',
		configureWebpack(config) {
			for (const rule of config.module?.rules ?? []) {
				if (!(rule?.test instanceof RegExp) || !rule.test.test('font.woff2') || !Array.isArray(rule.use)) continue;
				for (const use of rule.use) if (use?.options && 'limit' in use.options) use.options.limit = false;
			}
			return {};
		},
		async postBuild({ outDir }) {
			const siteOrigin = process.env.SITE_URL ? new URL(process.env.SITE_URL).origin : undefined;
			const external = [];
			const scripts = [];
			let count = 0;
			for (const file of htmlFiles(outDir)) {
				if (exclude.some((prefix) => relative(outDir, file).startsWith(prefix))) continue;
				const html = readFileSync(file, 'utf8');
				for (const url of externalEmbeds(html, siteOrigin)) external.push(`  ${relative(outDir, file)}: ${url}`);
				for (const body of classifyScripts(html).unexpected) scripts.push(`  ${relative(outDir, file)}: <script>${body.trim().slice(0, 80)}…`);
				const out = withCsp(html);
				if (!out) throw new Error(`lms-csp: no <meta charset> found in ${file}`);
				writeFileSync(file, out);
				count++;
			}
			console.log(`[lms-csp] Added a Content-Security-Policy to ${count} pages`);
			if (scripts.length) {
				throw new Error(
					`lms-csp: pages contain inline scripts that aren't Docusaurus's own, which the Content-Security-Policy won't allow:\n${scripts.join('\n')}\n` +
						'Pages can\'t run their own scripts: remove the <script> from the page (or the "</script>" from its title).',
				);
			}
			if (external.length) {
				throw new Error(
					`lms-csp: pages embed files from other sites, which the Content-Security-Policy blocks:\n${external.join('\n')}\n` +
						'Download the file into static/ (e.g. static/images/) and link to it with a path like /images/<name>.png.',
				);
			}
		},
	};
}
