// Per-page Content-Security-Policy: after the build, every page gets a <meta> policy that allows
// only same-origin scripts plus Docusaurus's own inline scripts on that page (by SHA-256 hash).
// plugins/lms-csp.mjs runs it in Docusaurus's postBuild step.
//
// Only inline scripts where page content can't put them are trusted:
// - on site pages, the ones between <body> and the app root (<div id="__docusaurus">), which only
//   plugins write (the theme's colour-mode script);
// - on pages without the app root, only the redirect line that @docusaurus/plugin-client-redirects
//   writes (`window.location.href = '/path/' …`). Its own redirect pages are written after this
//   step and get no policy; they hold nothing but that line, to a validated `aliases` path.
// Any other inline script (e.g. raw <script> in a lesson, or one that a page title broke out of
// the breadcrumb JSON-LD) fails the build, so it's never given a hash. JSON-LD isn't run, so it
// isn't hashed either.
//
// It also fails the build if a page embeds an image, video, audio or frame from another site: the
// policy would block it, and the author would only see a broken image (e.g. a lesson image pasted
// into the CMS as a link to someone else's site). Links (<a href>) to other sites are fine.
// Headers that can't be set from a <meta> (frame-ancestors, HSTS, nosniff, …) come from the GitLab
// Pages server (`gitlab_pages['headers']`, README → Security checklist).
import { createHash } from 'node:crypto';
import { parse } from 'parse5';

// Script types a browser runs (no type, a JavaScript type, or a module).
const EXECUTABLE = /^(|module|(text|application)\/(x-)?(java|ecma)script)$/i;
// @docusaurus/plugin-client-redirects' redirect page script; targets are site paths (`aliases`).
const REDIRECT = /^\s*window\.location\.href = '\/[\w./-]*' \+ window\.location\.search \+ window\.location\.hash;\s*$/;

const attr = (node, name) => node.attrs?.find((a) => a.name === name)?.value;
const isInlineScript = (node) =>
	node.tagName === 'script' && attr(node, 'src') === undefined && EXECUTABLE.test((attr(node, 'type') ?? '').trim());
const scriptText = (node) => node.childNodes.map((child) => child.value ?? '').join('');

function* elements(node) {
	for (const child of node.childNodes ?? []) {
		if (child.tagName) yield child;
		yield* elements(child.content ?? child);
	}
}

/**
 * Splits a page's runnable inline scripts (by their text, as browsers hash it) into Docusaurus's own
 * (`trusted`) and any others (`unexpected`). The HTML is parsed, so "<script>" inside an attribute
 * or text doesn't count.
 */
export function classifyScripts(html) {
	const doc = parse(html);
	const all = [...elements(doc)];
	const body = all.find((node) => node.tagName === 'body');
	const root = all.find((node) => node.tagName === 'div' && attr(node, 'id') === '__docusaurus');
	const trusted = new Set();
	if (root && body) {
		// Plugins' pre-body tags: the body's own children before the app root.
		for (const node of body.childNodes) {
			if (node === root) break;
			if (isInlineScript(node)) trusted.add(node);
		}
	} else {
		// No app root: a redirect page, whose only script is the redirect.
		for (const node of all) if (isInlineScript(node) && REDIRECT.test(scriptText(node))) trusted.add(node);
	}
	const scripts = all.filter(isInlineScript);
	return {
		trusted: scripts.filter((node) => trusted.has(node)).map(scriptText),
		unexpected: scripts.filter((node) => !trusted.has(node)).map(scriptText),
	};
}

// src attributes of elements that load content (`srcset` isn't generated for external files).
const EMBED_SRC = /<(img|video|audio|source|track|iframe|embed)\b[^>]*?\s(?:src|poster)=["']?((?:https?:)?\/\/[^"'\s>]+)/gi;

/** Embedded URLs on another origin than the site's own (SITE_URL, if set). */
export function externalEmbeds(html, siteOrigin) {
	return [...html.matchAll(EMBED_SRC)]
		.map((m) => m[2])
		.filter((url) => new URL(url, 'https://placeholder.invalid').origin !== siteOrigin);
}

const hash = (text) => `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;

export function policy(scriptHashes) {
	return [
		"default-src 'self'",
		// The asciinema player runs as WebAssembly.
		`script-src 'self' 'wasm-unsafe-eval' ${scriptHashes.join(' ')}`.trim(),
		// Docusaurus and the site's markup use inline style attributes; inline CSS on a static site is low risk.
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data:",
		"media-src 'self'",
		"font-src 'self'",
		"connect-src 'self'",
		"object-src 'none'",
		"base-uri 'self'",
		"form-action 'self'",
	].join('; ');
}

/**
 * The page with its CSP <meta> straight after <meta charset> (it must precede any script), allowing
 * only Docusaurus's own inline scripts. Undefined if the page has no <meta charset>.
 */
export function withCsp(html) {
	const hashes = [...new Set(classifyScripts(html).trusted.map(hash))];
	const meta = `<meta http-equiv="content-security-policy" content="${policy(hashes)}">`;
	// Docusaurus minifies its HTML, so the charset may be unquoted (<meta charset=UTF-8>).
	const out = html.replace(/(<head[^>]*>\s*<meta charset=(?:"[^"]*"|[^\s>]+)\s*\/?>)/i, `$1${meta}`);
	return out === html ? undefined : out;
}
