// Rehype plugin: fails the build when a page's own HTML could run script or change how the page
// loads. Docusaurus keeps raw HTML written in .md files (and JSX in .mdx), so without this a lesson
// could carry a <script>, an event handler such as onerror="…", or a javascript: link. The page's
// Content-Security-Policy (scripts/csp.mjs) blocks most of that too; this names the file instead.
//
// Rejected: <script>, <iframe>, <frame>, <frameset>, <object>, <embed>, <applet>, <form>, <base>,
// <meta> and <link> elements; on… attributes; javascript:/vbscript: URLs; data: URLs except images.
// The site's own blocks (quiz, exercise, …; plugins/remark-lms-blocks.mjs) only make safe markup.
import { relative } from 'node:path';
import { visit } from 'unist-util-visit';

const BLOCKED_ELEMENTS = new Set(['script', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'form', 'base', 'meta', 'link']);
const URL_ATTRIBUTES = new Set(['href', 'src', 'action', 'formaction', 'poster', 'data', 'xlinkhref', 'xlink:href', 'srcset', 'background']);
const SCRIPT_URL = /^\s*(javascript|vbscript):/i;
const DATA_URL = /^\s*data:/i;
const DATA_IMAGE_URL = /^\s*data:image\/(png|jpe?g|gif|webp|avif);/i;

/** Problems with one element (`name`, and its attributes as [name, value] pairs). */
export function elementProblems(name, attributes) {
	const problems = [];
	const tag = String(name).toLowerCase();
	if (BLOCKED_ELEMENTS.has(tag)) problems.push(`<${tag}> isn't allowed in page content`);
	for (const [attrName, value] of attributes) {
		const key = String(attrName).toLowerCase();
		if (/^on/.test(key)) problems.push(`<${tag} ${attrName}=…>: event handler attributes aren't allowed`);
		if (!URL_ATTRIBUTES.has(key) || typeof value !== 'string') continue;
		if (SCRIPT_URL.test(value)) problems.push(`<${tag} ${attrName}="${value.trim().slice(0, 40)}…">: script links aren't allowed`);
		else if (DATA_URL.test(value) && !(tag === 'img' && key === 'src' && DATA_IMAGE_URL.test(value))) {
			problems.push(`<${tag} ${attrName}="data:…">: data: URLs are only allowed for images`);
		}
	}
	return problems;
}

/** Attribute [name, value] pairs of a hast element or an MDX JSX element. */
function attributesOf(node) {
	if (node.type === 'element') {
		return Object.entries(node.properties ?? {}).map(([key, value]) => [key, Array.isArray(value) ? value.join(' ') : value]);
	}
	return (node.attributes ?? []).filter((a) => a.type === 'mdxJsxAttribute').map((a) => [a.name, a.value]);
}

export default function rehypeSafeHtml() {
	return (tree, file) => {
		const problems = [];
		visit(tree, (node) => {
			if (node.type === 'element') problems.push(...elementProblems(node.tagName, attributesOf(node)));
			// Lower-case JSX names are HTML elements (capitalised ones are React components).
			else if ((node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') && /^[a-z]/.test(node.name ?? '')) {
				problems.push(...elementProblems(node.name, attributesOf(node)));
			}
		});
		if (problems.length) {
			const where = file.path ? relative(process.cwd(), file.path) : 'unknown file';
			throw new Error(`${where}: unsafe HTML in the page:\n${[...new Set(problems)].map((p) => `  - ${p}`).join('\n')}`);
		}
	};
}
