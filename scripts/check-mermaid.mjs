// Checks every ```mermaid diagram in docs/ before a build (npm's prebuild, after prepare.mjs), so a
// mistake fails the build with the file and line, like a broken quiz or timeline, instead of showing
// learners an error box where the diagram should be. Diagrams are still drawn in the browser
// (src/theme/Mermaid); this only parses them, with the Mermaid the site uses.
//
// It runs as its own Node script rather than inside the Docusaurus build: Docusaurus loads plugins
// with its own module loader, where loading Mermaid (an ES module) doesn't work.
//
// Pages are read with the Markdown parser, so a diagram shown as an example inside a ````md block
// isn't checked. Parsing needs no HTML sanitising, but Mermaid sets up DOMPurify while parsing some
// diagram types, and DOMPurify has no browser window in Node: its hooks and sanitize get no-op
// stand-ins here, in this script only.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { visit } from 'unist-util-visit';

const ROOT = new URL('..', import.meta.url).pathname;
const DOCS = join(ROOT, 'docs');

let mermaidPromise;
function loadMermaid() {
	mermaidPromise ??= (async () => {
		const { default: DOMPurify } = await import('dompurify');
		for (const name of ['addHook', 'removeHook', 'removeHooks', 'removeAllHooks']) DOMPurify[name] ??= () => {};
		DOMPurify.sanitize ??= (text) => text;
		const { default: mermaid } = await import('mermaid');
		return mermaid;
	})();
	return mermaidPromise;
}

/**
 * The message of a Mermaid parse error, with its diagram line turned into the file's line. Mermaid
 * reports a mistake it only notices at the end (an unclosed bracket) on the line after the last.
 */
export function describeError(error, fenceLine, lineCount) {
	const message = String(error?.message ?? error);
	const reported = Number(/line (\d+)/i.exec(message)?.[1]);
	const line = reported ? Math.min(reported, lineCount) : 0;
	// The diagram's first line is the one after the ```mermaid fence.
	const at = line ? `line ${fenceLine + line}` : `the diagram starting on line ${fenceLine + 1}`;
	const detail = message
		.split('\n')
		.map((l) => l.trim())
		.filter(Boolean)
		.slice(0, 3)
		.join(' ');
	return `${at}: ${detail}`;
}

/** Problems with the diagrams in one page's Markdown, as "line N: …" (empty if they're fine). */
export async function diagramProblems(markdown) {
	const diagrams = [];
	visit(fromMarkdown(markdown), 'code', (node) => {
		if (node.lang === 'mermaid') diagrams.push(node);
	});
	if (!diagrams.length) return [];
	const mermaid = await loadMermaid();
	const problems = [];
	for (const node of diagrams) {
		try {
			await mermaid.parse(node.value);
		} catch (error) {
			problems.push(describeError(error, node.position.start.line, node.value.split('\n').length));
		}
	}
	return problems;
}

function* pages(dir) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) yield* pages(path);
		else if (/\.mdx?$/.test(entry.name)) yield path;
	}
}

async function main() {
	const problems = [];
	for (const file of pages(DOCS)) {
		const markdown = readFileSync(file, 'utf8');
		if (!markdown.includes('```mermaid')) continue;
		for (const problem of await diagramProblems(markdown)) problems.push(`${relative(ROOT, file)}, ${problem}`);
	}
	if (problems.length) {
		console.error(`[check-mermaid] Mermaid diagrams that can't be drawn:\n${problems.map((p) => `  - ${p}`).join('\n')}\nTry each in the Mermaid live editor (https://mermaid.live) to see what's wrong.`);
		process.exit(1);
	}
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
