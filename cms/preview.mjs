// The admin editor's preview pane for pages (courses, lessons, labs, guide): the page text as the
// site shows it, including the site's own blocks (quiz, exercise, timeline, recording, terminal),
// rendered by the same code as the build (plugins/remark-lms-blocks.mjs, renderCodeBlock) and styled
// by the site's CSS (preview.css, registered below). A block the build would reject shows the
// build's own message instead, so editors see the problem before they save, rather than as a failed
// pipeline afterwards.
//
// scripts/prepare.mjs bundles this (esbuild) into static/admin/preview.js, loaded by cms/index.html
// after Sveltia CMS. Sveltia provides CMS, createClass and h (React.createElement) as globals.
//
// Safety: the editor's GitLab sign-in is kept on this page, so the preview never runs anything from
// content. Markdown is turned into an element tree (mdast → hast) and then into DOM nodes; raw HTML in
// the text is dropped (not rendered), text is only ever text, event handler attributes and
// javascript: links are skipped.
import { directive } from 'micromark-extension-directive';
import { gfm } from 'micromark-extension-gfm';
import { directiveFromMarkdown } from 'mdast-util-directive';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { defaultHandlers, toHast } from 'mdast-util-to-hast';
import { renderCodeBlock } from '../plugins/remark-lms-blocks.mjs';
import { SHELL_LANGUAGES, titleFromMeta, windowBar } from '../scripts/terminal.mjs';

const BLOCK_NAMES = { quiz: 'quiz', exercise: 'exercise', asciinema: 'recording', timeline: 'timeline' };
const ADMONITIONS = new Set(['note', 'tip', 'info', 'caution', 'warning', 'danger']);

// Quizzes and the other YAML blocks so far on the page (quiz ids need it), counted per preview.
let blockCount = 0;

const element = (tagName, properties, children) => ({ type: 'element', tagName, properties, children });
const textNode = (value) => ({ type: 'text', value });

/** What the preview shows for a block the build would reject. */
function problem(lang, error) {
	return element('div', { className: ['lms-preview-problem'] }, [
		element('p', {}, [element('strong', {}, [textNode(`This ${BLOCK_NAMES[lang] ?? `${lang} block`} has a problem, so the site won’t publish until it’s fixed:`)])]),
		// The build's message, less its "quiz block in <file>:" start, which the line above says.
		element('pre', {}, [textNode(String(error?.message ?? error).replace(/^[\w-]+ block in this page:\s*/, ''))]),
	]);
}

/** Code blocks: the site's own blocks as built; shell code in its terminal frame; Mermaid noted. */
function code(state, node) {
	const lang = node.lang ?? '';
	let hast;
	try {
		hast = renderCodeBlock({ lang, meta: node.meta, code: node.value, position: blockCount++, sourceFilePath: 'this page' });
	} catch (error) {
		return problem(lang, error);
	}
	if (hast) return hast;
	const plain = defaultHandlers.code(state, node);
	if (SHELL_LANGUAGES.has(lang)) return element('figure', { className: ['lms-shell', 'not-content'] }, [windowBar(titleFromMeta(node.meta ?? ''), false), plain]);
	if (lang === 'mermaid') return element('div', {}, [element('p', { className: ['lms-preview-note'] }, [textNode('Mermaid diagram: drawn on the published page.')]), plain]);
	return plain;
}

/** :::note … ::: (Docusaurus admonitions), with the site's admonition classes. */
function containerDirective(state, node) {
	if (!ADMONITIONS.has(node.name)) return element('div', {}, state.all(node));
	const label = node.children[0]?.data?.directiveLabel ? node.children[0] : undefined;
	const body = label ? node.children.slice(1) : node.children;
	return element('div', { className: ['theme-admonition', `theme-admonition-${node.name}`, 'alert'] }, [
		element('div', { className: ['admonitionHeading_preview'] }, label ? state.all(label) : [textNode(node.name)]),
		element('div', { className: ['admonitionContent_preview'] }, state.all({ type: 'root', children: body })),
	]);
}

/** `:name` in ordinary text ("see 10:30", "Note:this") isn't a directive here: put it back as text. */
function textDirective(state, node) {
	return [textNode(`:${node.name}`), ...state.all(node)];
}

/** A page's Markdown → hast, as the site would show it. */
export function pageHast(markdown) {
	const mdast = fromMarkdown(markdown, { extensions: [gfm(), directive()], mdastExtensions: [gfmFromMarkdown(), directiveFromMarkdown()] });
	blockCount = 0;
	return toHast(mdast, { handlers: { code, containerDirective, leafDirective: textDirective, textDirective } });
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** A hast property name → its HTML attribute name. */
function attributeName(key) {
	if (key === 'className') return 'class';
	if (key === 'htmlFor') return 'for';
	if (/^(data|aria)[A-Z]/.test(key)) return key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
	return key;
}

/** hast → DOM nodes in `doc`: elements and text only, nothing that could run. */
export function toDom(node, doc, resolve = (url) => url, inSvg = false) {
	if (node.type === 'text') return doc.createTextNode(node.value);
	if (node.type === 'root') {
		const fragment = doc.createDocumentFragment();
		for (const child of node.children) if (child.type === 'element' || child.type === 'text') fragment.append(toDom(child, doc, resolve, inSvg));
		return fragment;
	}
	const svg = inSvg || node.tagName === 'svg';
	const el = svg ? doc.createElementNS(SVG_NS, node.tagName) : doc.createElement(node.tagName);
	for (const [key, value] of Object.entries(node.properties ?? {})) {
		const name = attributeName(key);
		if (value === false || value === null || value === undefined || /^on/i.test(name)) continue;
		let string = value === true ? '' : Array.isArray(value) ? value.join(' ') : String(value);
		if (/^(href|src|xlink:href|action|formaction)$/i.test(name)) {
			if (/^\s*(javascript|vbscript|data):/i.test(string)) continue;
			string = resolve(string);
		}
		el.setAttribute(name, string);
	}
	for (const child of node.children ?? []) if (child.type === 'element' || child.type === 'text') el.append(toDom(child, doc, resolve, svg));
	return el;
}

// ---------------------------------------------------------------------------------------------
// Sveltia CMS registration (in the browser only).

function registerPreviews() {
	const { CMS, createClass, h } = window;
	const Preview = createClass({
		componentDidMount() {
			this.fill();
		},
		componentDidUpdate() {
			this.fill();
		},
		fill() {
			const { entry, document: doc, getAsset } = this.props;
			const data = (key) => entry.getIn(['data', key]);
			// Files picked in the editor but not saved yet have a temporary address.
			const resolve = (url) => {
				const asset = url.startsWith('/') ? getAsset?.(url) : undefined;
				return (asset && (asset.url ?? asset.blobURL)) || url;
			};
			let body;
			try {
				body = toDom(pageHast(String(data('body') ?? '')), doc ?? document, resolve);
			} catch (error) {
				body = toDom(problem('page', error), doc ?? document);
			}
			const title = (doc ?? document).createElement('h1');
			title.textContent = String(data('title') ?? '');
			const header = this.header;
			header.replaceChildren(title);
			const description = data('description');
			if (description) {
				const p = (doc ?? document).createElement('p');
				p.className = 'lms-preview-description';
				p.textContent = String(description);
				header.append(p);
			}
			this.body.replaceChildren(body);
		},
		render() {
			return h('article', { className: 'lms-preview lms-doc' }, [
				h('header', { key: 'header', className: 'lms-page-header', ref: (el) => (this.header = el) }),
				h('div', { key: 'body', className: 'theme-doc-markdown markdown', ref: (el) => (this.body = el) }),
			]);
		},
	});
	for (const collection of ['courses', 'lessons', 'labs', 'guide']) CMS.registerPreviewTemplate(collection, Preview);
	CMS.registerPreviewStyle('/admin/preview/preview.css');
}

if (typeof window !== 'undefined' && window.CMS) registerPreviews();
