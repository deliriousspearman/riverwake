// Remark plugin: draw.io diagrams in pages. An image whose file is a `.drawio.svg` under static/,
// on a line of its own, is put into the page as the SVG itself instead of an <img>, so its text can
// be selected, copied and found, and is drawn in the site's fonts:
//
//   ![Alt text for screen readers](/images/networks/office.drawio.svg "Optional caption")
//   <img src="/images/networks/office.drawio.svg" alt="Alt text for screen readers" />
//
// (The <img> form, for long alt text, is HTML in .md pages and JSX in .mdx ones: both work.)
//
// The file is read through scripts/drawio-svg.mjs, which keeps only an allowlist of drawing
// elements and attributes; a diagram with anything else in it, or without alt text, or in the
// middle of a sentence, fails the build with the page and the problem. The figure is explicit MDX
// JSX (see plugins/remark-lms-blocks.mjs), styled by src/css/site/drawio.css, and enlarged on click
// by src/client/zoom.ts when it's shown smaller than its real size.
import { existsSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { parseFragment } from 'parse5';
import { visit, SKIP } from 'unist-util-visit';
import { STATIC_DIR } from '../scripts/content.mjs';
import { DRAWIO_SVG, drawioFigure, readDrawioSvgFile } from '../scripts/drawio-svg.mjs';
import { toJsx } from './remark-lms-blocks.mjs';

/** An <img> written as JSX in the page: its literal src, alt and title, if it has them. */
function jsxImage(node) {
	if (node.name !== 'img') return undefined;
	const attr = (name) => {
		const found = node.attributes?.find((a) => a.type === 'mdxJsxAttribute' && a.name === name);
		return typeof found?.value === 'string' ? found.value : undefined;
	};
	return { url: attr('src') ?? '', alt: attr('alt') ?? '', title: attr('title') };
}

/** An <img> written as HTML in a Markdown (.md) page: its src, alt and title, if it's one alone. */
function htmlImage(node) {
	if (!/^\s*<img\b/i.test(node.value)) return undefined;
	const elements = parseFragment(node.value).childNodes.filter((n) => n.tagName);
	if (elements.length !== 1 || elements[0].tagName !== 'img') return undefined;
	const attr = (name) => elements[0].attrs.find((a) => a.name === name)?.value;
	return { url: attr('src') ?? '', alt: attr('alt') ?? '', title: attr('title') };
}

/** The image a node shows, as { url, alt, title }, if it's an image at all. */
function imageOf(node) {
	if (node.type === 'image') return { url: node.url, alt: node.alt ?? '', title: node.title ?? undefined };
	if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') return jsxImage(node);
	if (node.type === 'html') return htmlImage(node);
	return undefined;
}
const isDiagram = (node) => DRAWIO_SVG.test(imageOf(node)?.url ?? '');
const isBlank = (node) => node.type === 'text' && !node.value.trim();

/** The figure for one diagram, or throws with what's wrong. */
function figure({ url, alt, title }, idPrefix, page) {
	const fail = (problem) => {
		throw new Error(`${page}: the diagram ${url} ${problem}`);
	};
	if (!url.startsWith('/')) fail("needs its address on the site, starting with / (for a file in static/images/networks/, that's /images/networks/…)");
	const path = resolve(join(STATIC_DIR, decodeURIComponent(url)));
	if (!path.startsWith(STATIC_DIR + sep) || !existsSync(path)) fail(`isn't in static/ (looked for static${url})`);
	if (!alt.trim()) fail('needs alt text: describe what it shows, for people who can’t see it');
	const svg = readDrawioSvgFile(path);
	if (svg.problems.length) fail(`can't be shown: it has ${svg.problems.join('; ')}`);
	return toJsx(drawioFigure(svg, { alt: alt.trim(), caption: title?.trim(), idPrefix }));
}

export default function remarkDrawio() {
	return (tree, file) => {
		const page = relative(process.cwd(), file.path ?? 'the page');
		let count = 0;
		// A paragraph holding just the diagram (and spaces) becomes the figure, as does a JSX <img> on its own line.
		visit(tree, (node, index, parent) => {
			if (!parent || index === undefined) return;
			if (node.type === 'paragraph') {
				const content = node.children.filter((child) => !isBlank(child));
				if (content.length === 1 && isDiagram(content[0])) {
					parent.children[index] = figure(imageOf(content[0]), `drawio${++count}-`, page);
					return SKIP;
				}
			} else if ((node.type === 'mdxJsxFlowElement' || node.type === 'html') && isDiagram(node)) {
				parent.children[index] = figure(imageOf(node), `drawio${++count}-`, page);
				return SKIP;
			}
		});
		// Any left were in the middle of other text, a link, a table…
		visit(tree, (node) => {
			if (isDiagram(node)) throw new Error(`${page}: the diagram ${imageOf(node).url} must be on a line of its own, with a blank line before and after it`);
		});
	};
}
