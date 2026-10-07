// Remark plugin: the site's custom code blocks.
//
//   ```quiz / ```exercise / ```asciinema   validated YAML → the block's markup (scripts/blocks.mjs)
//   ```timeline                            validated YAML → a vertical, horizontal or snake timeline
//   ```attachment                          validated YAML → downloads where the block is
//   ```terminal, ```terminal-<colour>      terminal window, coloured at build time (scripts/terminal.mjs)
//   ```sh (and other shell languages)      the usual highlighted code block, in a terminal frame
//
// The rendered hast is put into the page as *explicit* MDX JSX (`_mdxExplicitJsx`), so MDX leaves
// the elements alone instead of swapping in Docusaurus's theme components (its <Details>, <pre>
// code blocks, …), and the site's CSS and scripts (src/client/) apply to it unchanged.
// Invalid blocks throw, which fails the build with the file and the problem.
import { visit, SKIP } from 'unist-util-visit';
import { readAttachment, readConfig, readExercise, readQuiz, readTimeline, quizId, renderAttachment, renderCast, renderExercise, renderQuiz, renderTimeline } from '../scripts/blocks.mjs';
import { PALETTES, renderTerminal, SHELL_LANGUAGES, titleFromMeta, windowBar } from '../scripts/terminal.mjs';

/** hast property name → JSX attribute name. */
function attributeName(key) {
	if (key === 'className') return 'className';
	if (/^(data|aria)[A-Z]/.test(key)) return key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
	return key;
}

/** `style="--a:1;color:red"` → a JSX `style={{ '--a': '1', color: 'red' }}` expression. */
function styleAttribute(style) {
	const properties = style
		.split(';')
		.map((rule) => rule.split(/:(.*)/s).map((part) => part?.trim()))
		.filter(([name, value]) => name && value)
		.map(([name, value]) => ({
			type: 'Property',
			key: { type: 'Literal', value: name.startsWith('--') ? name : name.replace(/-([a-z])/g, (_, c) => c.toUpperCase()) },
			value: { type: 'Literal', value },
			kind: 'init',
			computed: false,
			method: false,
			shorthand: false,
		}));
	const expression = { type: 'ObjectExpression', properties };
	return {
		type: 'mdxJsxAttribute',
		name: 'style',
		value: {
			type: 'mdxJsxAttributeValueExpression',
			value: JSON.stringify(Object.fromEntries(properties.map((p) => [p.key.value, p.value.value]))),
			data: { estree: { type: 'Program', sourceType: 'module', body: [{ type: 'ExpressionStatement', expression }] } },
		},
	};
}

/** hast → explicit MDX JSX nodes (mdast), recursively. */
export function toJsx(node) {
	if (node.type === 'text') return { type: 'text', value: node.value };
	const attributes = Object.entries(node.properties ?? {}).flatMap(([key, value]) => {
		if (value === false || value === undefined || value === null) return [];
		if (key === 'style') return [styleAttribute(value)];
		const name = attributeName(key);
		if (value === true) return [{ type: 'mdxJsxAttribute', name, value: null }];
		return [{ type: 'mdxJsxAttribute', name, value: Array.isArray(value) ? value.join(' ') : String(value) }];
	});
	return {
		type: 'mdxJsxFlowElement',
		name: node.tagName,
		attributes,
		children: (node.children ?? []).map(toJsx),
		data: { _mdxExplicitJsx: true },
	};
}

const RENDERERS = {
	quiz: (codeBlock, position) => renderQuiz(readQuiz(codeBlock), quizId(codeBlock.code, position)),
	exercise: (codeBlock) => renderExercise(readExercise(codeBlock)),
	asciinema: (codeBlock) => renderCast(readConfig(codeBlock)),
	timeline: (codeBlock) => renderTimeline(readTimeline(codeBlock)),
	attachment: (codeBlock) => renderAttachment(readAttachment(codeBlock)),
};

/**
 * The hast for one of the site's own blocks (quiz, exercise, asciinema, timeline, attachment, terminal[-colour]),
 * or undefined for any other language. Throws, with the problem, if the block is invalid. Also used
 * by the admin editor's preview (cms/preview.mjs), so it shows blocks exactly as the site does.
 * `position` counts the quizzes and other YAML blocks on the page so far (for quiz ids).
 */
export function renderCodeBlock({ lang, meta, code, position = 0, sourceFilePath }) {
	// The shape the block readers in scripts/blocks.mjs take.
	const codeBlock = { code, parentDocument: { sourceFilePath } };
	if (Object.hasOwn(RENDERERS, lang)) return RENDERERS[lang](codeBlock, position);
	if (Object.hasOwn(PALETTES, lang)) return renderTerminal({ language: lang, title: titleFromMeta(meta ?? ''), code });
	return undefined;
}

export default function remarkLmsBlocks() {
	return (tree, file) => {
		let position = 0;
		visit(tree, 'code', (node, index, parent) => {
			if (!parent || index === undefined) return;
			const lang = node.lang ?? '';
			const hast = renderCodeBlock({ lang, meta: node.meta, code: node.value, position, sourceFilePath: file.path });
			if (hast) {
				if (Object.hasOwn(RENDERERS, lang)) position++;
				parent.children[index] = toJsx(hast);
				return SKIP;
			}
			if (SHELL_LANGUAGES.has(lang)) {
				// The title goes in the frame's bar, not above the code.
				const title = titleFromMeta(node.meta ?? '');
				const meta = (node.meta ?? '').replace(/\btitle=(["']).*?\1/, '').trim();
				const wrapper = toJsx({ type: 'element', tagName: 'figure', properties: { className: ['lms-shell', 'not-content'] }, children: [windowBar(title, false)] });
				// Docusaurus renders the code (highlighting, copy button) inside the frame.
				wrapper.children.push({ ...node, meta: meta || null });
				parent.children[index] = wrapper;
				return SKIP;
			}
		});
	};
}
