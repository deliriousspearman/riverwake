// draw.io diagrams (.drawio.svg): the allowlist reader (scripts/drawio-svg.mjs), the page plugin
// that puts them into pages (plugins/remark-drawio.mjs), the upload check (scripts/static-files.mjs),
// and the templates (templates/drawio/), whose labels must export as SVG text.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { inflateRawSync } from 'node:zlib';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { drawioFigure, drawioSvgFile, readDrawioSvg } from '../scripts/drawio-svg.mjs';
import { staticFileProblems } from '../scripts/static-files.mjs';
import remarkDrawio from '../plugins/remark-drawio.mjs';
import { tempDir, writeFiles } from './helpers.mjs';

/** A small SVG the way draw.io exports one (fonts import, light-dark() styles, bookkeeping, a link). */
const svg = (body = '', rootAttrs = 'content="&lt;mxfile&gt;&lt;/mxfile&gt;"') => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="200px" height="100px" viewBox="-0.5 -0.5 200 100" ${rootAttrs} style="background: transparent;"><defs><style type="text/css">@import url(https://fonts.googleapis.com/css2?family=JetBrains+Mono);</style><clipPath id="c1"><rect width="10" height="10"/></clipPath></defs><g data-cell-id="0"><rect x="1" y="1" width="198" height="98" fill="#1a2332" stroke="#2c3a52" pointer-events="all" style="fill: light-dark(#1a2332, #cccccc);" clip-path="url(#c1)"/><g fill="#e4e9f4" font-family="'JetBrains Mono'" font-size="13px"><text x="10" y="20">web01</text></g><a xlink:href="#c1"><path d="M0 0L10 10"/></a>${body}</g></svg>`;

/** The first element of `tagName` in a hast tree. */
function find(node, tagName) {
	if (node.tagName === tagName) return node;
	for (const child of node.children ?? []) {
		const found = find(child, tagName);
		if (found) return found;
	}
}

test('a draw.io SVG is read into drawing elements only, ids local to the diagram', () => {
	const read = readDrawioSvg(svg());
	assert.deepEqual(read.problems, []);
	assert.equal(read.width, 200);
	assert.equal(read.viewBox, '-0.5 -0.5 200 100');
	assert.equal(read.diagram, '<mxfile></mxfile>');

	const figure = drawioFigure(read, { alt: 'The office network', caption: 'Figure 1', idPrefix: 'd1-' });
	assert.deepEqual(figure.properties.className, ['lms-drawio', 'not-content']);
	const root = find(figure, 'svg');
	assert.equal(root.properties.role, 'img');
	assert.equal(root.properties.ariaLabel, 'The office network');
	assert.equal(root.properties.style, 'max-width:200px', 'its own width, for click to enlarge');
	// draw.io's <style> (Google Fonts), style attributes and bookkeeping are left out; colours stay.
	assert.equal(find(figure, 'style'), undefined);
	const rect = find(find(figure, 'g'), 'rect');
	assert.deepEqual(rect.properties, { x: '1', y: '1', width: '198', height: '98', fill: '#1a2332', stroke: '#2c3a52', clipPath: 'url(#d1-c1)' });
	assert.equal(find(figure, 'clipPath').properties.id, 'd1-c1');
	// The link is unwrapped, its contents kept; fonts get a fallback.
	assert.equal(find(figure, 'a'), undefined);
	assert.ok(find(figure, 'path'));
	assert.equal(find(figure, 'text').children[0].value, 'web01');
	assert.equal(figure.children.at(-1).tagName, 'figcaption');
	const fonts = JSON.stringify(figure).match(/"fontFamily":"[^"]*"/g);
	assert.deepEqual(fonts, ['"fontFamily":"\'JetBrains Mono\', monospace"']);
});

test('the published copy of a diagram is clean but still opens in draw.io', () => {
	const file = drawioSvgFile(readDrawioSvg(svg()));
	assert.match(file, /^<\?xml[^>]*>\n<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="200" height="100" viewBox="-0\.5 -0\.5 200 100" content="&lt;mxfile&gt;&lt;\/mxfile&gt;">/);
	assert.doesNotMatch(file, /<style|googleapis|light-dark|data-cell-id|pointer-events/);
	assert.deepEqual(readDrawioSvg(file).problems, [], 'and reads back the same way');
});

test('a diagram that could run or load something, or that draw.io could not open again, is a problem', () => {
	const problems = (body, rootAttrs) => readDrawioSvg(svg(body, rootAttrs)).problems;
	assert.match(problems('<foreignObject><div>web01</div></foreignObject>')[0], /labels drawn as HTML: .*Formatted Text/);
	assert.deepEqual(problems('<script>alert(1)</script>'), ['a <script>']);
	assert.deepEqual(problems('<rect onclick="alert(1)"/>'), ['an event handler attribute (on…=)']);
	assert.deepEqual(problems('<rect fill="javascript:alert(1)"/>'), ['a javascript: link']);
	assert.match(problems('<image href="https://tracker.example/x.png"/>')[0], /a link to another file or site/);
	assert.match(problems('<rect fill="url(https://tracker.example/x)"/>')[0], /a url\(\) that isn't inside the picture/);
	assert.match(problems('<iframe src="/"/>')[0], /a <iframe> element/);
	assert.match(problems('', '')[0], /no copy of the diagram/);
	assert.deepEqual(problems('<image href="data:image/png;base64,AAAA"/>'), [], 'pictures inside the file are fine');
	assert.deepEqual(readDrawioSvg('<p>not a picture</p>').problems, ["it isn't an SVG picture"]);
});

const transform = (markdown) => {
	const tree = fromMarkdown(markdown);
	remarkDrawio()(tree, { path: 'docs/courses/web/lesson.md' });
	return tree;
};
const EXAMPLE = '/images/guide/network-diagram-example.drawio.svg';

test('a diagram on a line of its own becomes the figure, as Markdown or as an <img>', () => {
	for (const markdown of [`![The office network](${EXAMPLE} "Caption")`, `<img src="${EXAMPLE}" alt="The office network" title="Caption" />`]) {
		const [node] = transform(`Before.\n\n${markdown}\n\nAfter.`).children.slice(1, 2);
		assert.equal(node.type, 'mdxJsxFlowElement');
		assert.equal(node.name, 'figure');
		const [svgNode, caption] = node.children;
		assert.equal(svgNode.name, 'svg');
		assert.equal(svgNode.attributes.find((a) => a.name === 'aria-label').value, 'The office network');
		assert.equal(caption.name, 'figcaption');
	}
});

test('a diagram in the middle of text, without alt text or outside static/ fails with the page and the problem', () => {
	assert.throws(() => transform(`See ![The network](${EXAMPLE}) here.`), /lesson\.md: the diagram .* must be on a line of its own/);
	assert.throws(() => transform(`![](${EXAMPLE})`), /needs alt text/);
	assert.throws(() => transform('![Net](images/net.drawio.svg)'), /needs its address on the site, starting with \//);
	assert.throws(() => transform('![Net](/images/missing.drawio.svg)'), /isn't in static\/ \(looked for static\/images\/missing\.drawio\.svg\)/);
	assert.throws(() => transform('![Net](/../package.drawio.svg)'), /isn't in static\//);
	// Other images are left alone.
	assert.equal(transform('![Screenshot](/images/guide/shot.png)').children[0].children[0].type, 'image');
});

test('uploads: a .drawio file is pointed to .drawio.svg; a .drawio.svg is checked by the diagram reader', (t) => {
	const staticDir = writeFiles(tempDir(t), {
		'images/net/plain.drawio.svg': svg(),
		'images/net/html-labels.drawio.svg': svg('<foreignObject><div>x</div></foreignObject>'),
		'images/net/source.drawio': '<mxfile/>',
	});
	const problems = staticFileProblems(staticDir).sort();
	assert.equal(problems.length, 2, problems.join('\n'));
	assert.match(problems[0], /^static\/images\/net\/html-labels\.drawio\.svg: this draw.io diagram has labels drawn as HTML/);
	assert.match(problems[1], /^static\/images\/net\/source\.drawio: draw\.io diagrams go on the site as \.drawio\.svg/);
});

test('the draw.io templates and library use plain-text labels, so they export as SVG text', () => {
	const dir = new URL('../templates/drawio/', import.meta.url);
	const files = readdirSync(dir).filter((f) => /\.(drawio|xml)$/.test(f));
	assert.ok(files.length >= 8);
	for (const file of files) {
		let xml = readFileSync(new URL(file, dir), 'utf8');
		// The library's shapes are compressed, as draw.io stores them.
		if (file.endsWith('.xml')) {
			const entries = JSON.parse(xml.replace(/^<mxlibrary>|<\/mxlibrary>\s*$/g, '').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));
			xml = entries.map((e) => decodeURIComponent(inflateRawSync(Buffer.from(e.xml, 'base64')).toString())).join('\n');
		}
		assert.doesNotMatch(xml, /html=1|whiteSpace=wrap/, `${file}: a formatted or wrapping label exports as HTML`);
		assert.doesNotMatch(xml, /&lt;(b|br|font)\b/, `${file}: HTML in a label`);
	}
});
