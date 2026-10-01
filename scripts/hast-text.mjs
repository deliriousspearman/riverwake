// Tiny text → hast renderer for the YAML-based content blocks (quiz, exercise). Supports what
// those blocks need and nothing more:
//   blocks:  paragraphs (separated by blank lines) and "- " bullet lists. A list can follow a
//            line of text directly, and an indented line continues the list item above it.
//   inline:  `code`, **bold**, *italic* / _italic_, [text](https://… | /path | #anchor); URLs may
//            contain parentheses, e.g. https://en.wikipedia.org/wiki/Salt_(cryptography)
// All text is emitted as text nodes, so nothing an author writes is interpreted as raw HTML.
// Also the shared YAML reader and error helper for the YAML-based blocks (quiz, exercise, asciinema).
// plugins/remark-lms-blocks.mjs turns the hast into explicit MDX JSX, so it renders exactly as built.
import { parse } from 'yaml';

export const el = (tagName, properties = {}, children = []) => ({ type: 'element', tagName, properties, children });
export const text = (value) => ({ type: 'text', value });

const INLINE = /`([^`]+)`|\*\*(.+?)\*\*|(?<![\w*])\*(?!\s)(.+?)\*(?!\w)|(?<!\w)_(?!\s)(.+?)_(?!\w)|\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/g;
const SAFE_URL = /^(https?:\/\/|\/|#)/;

export function inline(source) {
	const out = [];
	let last = 0;
	for (const m of String(source).matchAll(INLINE)) {
		if (m.index > last) out.push(text(source.slice(last, m.index)));
		const [, code, bold, em1, em2, linkText, href] = m;
		if (code !== undefined) out.push(el('code', {}, [text(code)]));
		else if (bold !== undefined) out.push(el('strong', {}, inline(bold)));
		else if (em1 !== undefined || em2 !== undefined) out.push(el('em', {}, inline(em1 ?? em2)));
		else if (SAFE_URL.test(href)) out.push(el('a', { href }, inline(linkText)));
		else out.push(text(m[0]));
		last = m.index + m[0].length;
	}
	if (last < source.length) out.push(text(source.slice(last)));
	return out;
}

/** Paragraphs and bullet lists → array of hast elements. */
export function blocks(source) {
	const out = [];
	for (const chunk of String(source).trim().split(/\n\s*\n/)) {
		// Runs of text lines become a paragraph, runs of "- " lines a list.
		let paragraph = [];
		let items = [];
		const flush = () => {
			if (paragraph.length) out.push(el('p', {}, inline(paragraph.join(' '))));
			if (items.length) out.push(el('ul', {}, items.map((item) => el('li', {}, inline(item.join(' '))))));
			paragraph = [];
			items = [];
		};
		for (const raw of chunk.split('\n')) {
			const line = raw.trim();
			if (line.startsWith('- ')) {
				if (paragraph.length) flush();
				items.push([line.slice(2)]);
			} else if (items.length && /^\s/.test(raw)) {
				items.at(-1).push(line);
			} else {
				if (items.length) flush();
				paragraph.push(line);
			}
		}
		flush();
	}
	return out;
}

/**
 * Parses a block's YAML body, which must be "key: value" lines, and rejects top-level keys not in
 * `fields` (when given). Returns the parsed object and a `fail(message)` that names the file.
 */
export function readYamlBlock(kind, codeBlock, fields) {
	const fail = failer(kind, codeBlock);
	let config;
	try {
		config = parse(codeBlock.code) ?? {};
	} catch (error) {
		fail(`invalid YAML (${error.message})`);
	}
	if (typeof config !== 'object' || Array.isArray(config)) fail('expected "key: value" lines');
	if (fields) {
		const unknown = unknownFields(config, fields);
		if (unknown) fail(unknown);
	}
	return { config, fail };
}

/** "unknown field(s): a, b (allowed: …)" for keys of `object` not in `allowed`, or undefined. */
export function unknownFields(object, allowed) {
	const unknown = Object.keys(object).filter((key) => !allowed.includes(key));
	return unknown.length ? `unknown field(s): ${unknown.join(', ')} (allowed: ${allowed.join(', ')})` : undefined;
}

/** Error helper that names the source file. */
export function failer(kind, codeBlock) {
	const where = codeBlock.parentDocument?.sourceFilePath ?? 'unknown file';
	return (message) => {
		throw new Error(`${kind} block in ${where}: ${message}`);
	};
}
