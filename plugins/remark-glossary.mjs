// Remark plugin: on lesson and lab pages, the first use of each glossary term (content/glossary/)
// becomes a button with the term's definition in a tip and a link to /glossary/. The marks are in
// the built HTML; the browser only shows and hides the tips (src/client/glossary.ts).
//
// Matching is scripts/glossary.mjs (whole words, optional plural, longest name first, acronyms
// case-sensitive). Never marked: code, headings, links, admonition titles, and the
// quiz, exercise and other blocks (explicit JSX). A page opts out with `glossary: false`.
//
// In `npm run dev`, a glossary change re-marks the pages without a restart: plugins/lms-content.mjs
// recompiles them, and the terms are read again when the glossary has changed.
import { relative } from 'node:path';
import { DOCS_DIR, glossaryVersion, readGlossary } from '../scripts/content.mjs';
import { glossaryMatcher } from '../scripts/glossary.mjs';

const SKIP = new Set(['heading', 'link', 'linkReference', 'inlineCode', 'code', 'html', 'mdxJsxFlowElement', 'mdxJsxTextElement', 'mdxFlowExpression', 'mdxTextExpression', 'mdxjsEsm', 'definition']);

/** Lesson (not overview) and lab pages, by path relative to docs/. */
const markable = (rel) => /^labs\/[^/]+\.mdx?$/.test(rel) || (/^courses\/[^/]+\/.+\.mdx?$/.test(rel) && !/^courses\/[^/]+\/index\.mdx?$/.test(rel));

const jsx = (name, attributes, children) => ({
	type: 'mdxJsxTextElement',
	name,
	attributes: Object.entries(attributes).map(([key, value]) => ({ type: 'mdxJsxAttribute', name: key, value })),
	children,
	data: { _mdxExplicitJsx: true },
});
const text = (value) => ({ type: 'text', value });

/** The mark for one term: button + hidden tip, as mdast. */
function mark(entry, shown, n) {
	const tip = `glossary-tip-${n}`;
	return jsx('span', { className: 'glossary-mark' }, [
		jsx('button', { type: 'button', className: 'glossary-term', 'aria-expanded': 'false', 'aria-controls': tip }, [text(shown)]),
		jsx('span', { className: 'glossary-tip', id: tip, hidden: null }, [
			jsx('strong', {}, [text(entry.term)]),
			jsx('span', { className: 'glossary-definition' }, [text(entry.definition)]),
			// A Markdown link, so Docusaurus renders it as its Link: no page reload, and the build's link
			// check covers it (GlossaryList registers the entries' anchors).
			{ type: 'link', url: `/glossary/#${entry.id}`, children: [text('In the glossary →')] },
		]),
	]);
}

/**
 * The terms and their matcher, read again whenever a glossary file is added, removed or edited (in
 * `npm run dev`). A production build reads them once: the glossary can't change during it.
 */
let cache;
function glossary() {
	if (cache && process.env.NODE_ENV === 'production') return cache;
	const version = glossaryVersion();
	if (cache?.version !== version) {
		// The lms-content plugin validates the entries and fails the build on problems.
		const terms = readGlossary().map(({ id, data }) => ({ id, term: data.term, aliases: data.aliases ?? [], definition: data.definition }));
		cache = { version, terms, byId: new Map(terms.map((t) => [t.id, t])), matcher: glossaryMatcher(terms) };
	}
	return cache;
}

export default function remarkGlossary() {
	return (tree, file) => {
		const rel = relative(DOCS_DIR, file.path ?? '').split('\\').join('/');
		const { terms, byId, matcher } = glossary();
		if (!terms.length || !markable(rel) || file.data.frontMatter?.glossary === false) return;
		const seen = new Set();
		let n = 0;

		const walk = (node) => {
			if (seen.size === terms.length) return;
			if (!node.children || SKIP.has(node.type) || node.data?.directiveLabel) return;
			for (let i = 0; i < node.children.length; i++) {
				const child = node.children[i];
				if (child.type !== 'text') {
					walk(child);
					continue;
				}
				// A text node can hold several first uses: split off each one, then carry on after it.
				const found = matcher.first(child.value, seen);
				if (!found) continue;
				seen.add(found.id);
				const before = child.value.slice(0, found.index);
				const shown = child.value.slice(found.index, found.index + found.length);
				const after = child.value.slice(found.index + found.length);
				const replacement = [...(before ? [text(before)] : []), mark(byId.get(found.id), shown, n++), ...(after ? [text(after)] : [])];
				node.children.splice(i, 1, ...replacement);
				// Continue with the remaining text (the next loop step lands on `after`).
				i += replacement.length - (after ? 2 : 1);
			}
		};
		walk(tree);
	};
}
