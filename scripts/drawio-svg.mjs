// Diagrams saved from draw.io as `<name>.drawio.svg` (static/images/…): a plain SVG picture that
// also carries the whole diagram (its `content` attribute), so the same file opens in draw.io to be
// changed. Lessons show them inline, as part of the page (plugins/remark-drawio.mjs), so their
// text can be selected, copied and found, and is drawn in the site's fonts; an <img> SVG can't do that.
//
// Being part of the page, a diagram runs with the page's rights, on the address where the admin
// editor keeps an editor's GitLab token. So nothing is copied as it is: each file is read into a
// tree of an allowlist of drawing elements and attributes, and anything that could run or load
// something (scripts, handlers, embedded HTML, links to other files or sites) is a problem that
// fails the build. Also left out, silently: <style> (draw.io puts its Google Fonts imports there),
// `style` attributes (draw.io's `light-dark()` colours, which would swap the colours on a dark page;
// every shape also has plain fill and stroke attributes), and draw.io's own bookkeeping
// (data-cell-id, pointer-events, …).
//
// Used by the upload check (scripts/static-files.mjs), the page plugin, and the build's copy of
// each file (plugins/lms-content.mjs postBuild writes the cleaned SVG, diagram copy kept, over the
// published one, so the file at the site's address is clean too).
import { readFileSync, statSync } from 'node:fs';
import { parseFragment } from 'parse5';

export const DRAWIO_SVG = /\.drawio\.svg$/i;

// Elements kept; <a> and <switch> are replaced by their contents; the rest of DROPPED are left out.
const ELEMENTS = new Set([
	'svg', 'g', 'defs', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'path', 'text', 'tspan', 'image',
	'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask', 'pattern', 'marker', 'symbol', 'use',
	'filter', 'feGaussianBlur', 'feOffset', 'feFlood', 'feComposite', 'feMerge', 'feMergeNode', 'feColorMatrix', 'feBlend', 'feDropShadow',
]);
const UNWRAP = new Set(['a', 'switch']);
const DROPPED = new Set(['style', 'title', 'desc', 'metadata']);

// Attributes kept (as SVG names); any other is left out, except those that are a problem (below).
const ATTRIBUTES = new Set([
	'id', 'x', 'y', 'width', 'height', 'rx', 'ry', 'cx', 'cy', 'r', 'x1', 'y1', 'x2', 'y2', 'points', 'd', 'transform',
	'viewBox', 'preserveAspectRatio', 'dx', 'dy', 'rotate', 'textLength', 'lengthAdjust', 'href',
	'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap',
	'stroke-linejoin', 'stroke-miterlimit', 'stroke-opacity', 'opacity', 'visibility', 'clip-rule', 'clip-path', 'mask', 'filter',
	'marker-start', 'marker-mid', 'marker-end',
	'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor', 'dominant-baseline', 'alignment-baseline',
	'text-decoration', 'letter-spacing', 'word-spacing', 'baseline-shift', 'writing-mode',
	'offset', 'stop-color', 'stop-opacity', 'gradientUnits', 'gradientTransform', 'spreadMethod', 'fx', 'fy', 'fr',
	'clipPathUnits', 'maskUnits', 'maskContentUnits', 'patternUnits', 'patternContentUnits', 'patternTransform',
	'markerWidth', 'markerHeight', 'refX', 'refY', 'orient', 'markerUnits',
	'in', 'in2', 'stdDeviation', 'result', 'mode', 'operator', 'k1', 'k2', 'k3', 'k4', 'values', 'type',
	'flood-color', 'flood-opacity', 'filterUnits', 'primitiveUnits', 'color-interpolation-filters',
]);
// Where a value may point: another element in the same file, or a picture inside it.
const LOCAL_REF = /^#[\w.:-]+$/;
const LOCAL_URL = /^url\(\s*['"]?#([\w.:-]+)['"]?\s*\)$/;
const DATA_IMAGE = /^data:image\/(png|jpe?g|gif|webp|svg\+xml)[;,]/i;

/**
 * Reads a draw.io SVG. `problems` (empty if it's fine) say what's wrong in words for an editor;
 * `root` is the cleaned tree ({ name, attrs: [[name, value]], children } and text strings), with
 * its size, and `diagram` the draw.io diagram it carries (undefined if it was saved without one).
 */
export function readDrawioSvg(source) {
	const problems = new Set();
	const fragment = parseFragment(String(source));
	const top = fragment.childNodes.filter((n) => n.tagName);
	const svg = top.find((n) => n.tagName === 'svg');
	if (!svg || top.length !== 1) return { problems: ["it isn't an SVG picture"] };

	const read = (node, inText) => {
		if (node.nodeName === '#text') return inText || node.value.trim() ? [node.value] : [];
		if (!node.tagName) return []; // comments, <?xml …?>
		const name = node.tagName;
		if (name === 'foreignObject') {
			problems.add('labels drawn as HTML: in draw.io, select everything and untick Text → Formatted Text, and Word wrap, then save again');
			return [];
		}
		if (name === 'script') {
			problems.add('a <script>');
			return [];
		}
		if (DROPPED.has(name)) return [];
		const children = (node.childNodes ?? []).flatMap((child) => read(child, inText || name === 'text'));
		if (UNWRAP.has(name)) return children;
		if (!ELEMENTS.has(name)) {
			problems.add(`a <${name}> element, which diagrams on the site can't use`);
			return [];
		}
		const attrs = [];
		for (const attr of node.attrs ?? []) {
			const attrName = attr.prefix === 'xlink' && attr.name === 'href' ? 'href' : attr.name;
			const value = attr.value.trim();
			if (/^on/i.test(attrName)) problems.add('an event handler attribute (on…=)');
			else if (/(java|vb)script:/i.test(value)) problems.add('a javascript: link');
			else if (!ATTRIBUTES.has(attrName) || attr.prefix) continue;
			else if (attrName === 'href' && !LOCAL_REF.test(value) && !(name === 'image' && DATA_IMAGE.test(value))) {
				problems.add(`a link to another file or site (${value.slice(0, 60)})`);
			} else if (/url\(/i.test(value) && !LOCAL_URL.test(value)) {
				problems.add(`a url() that isn't inside the picture (${value.slice(0, 60)})`);
			} else attrs.push([attrName, value]);
		}
		return [{ name, attrs, children }];
	};

	const [root] = read(svg, false);
	const attr = (name) => svg.attrs.find((a) => a.name === name && !a.prefix)?.value;
	const number = (value) => (value === undefined ? NaN : parseFloat(value));
	let viewBox = attr('viewBox')?.trim().split(/[\s,]+/).map(Number);
	let [width, height] = [number(attr('width')), number(attr('height'))];
	if (!viewBox && width > 0 && height > 0) viewBox = [0, 0, width, height];
	if (!(viewBox?.length === 4 && viewBox.every(Number.isFinite) && viewBox[2] > 0 && viewBox[3] > 0)) problems.add('no size (viewBox, or width and height)');
	else if (!(width > 0 && height > 0)) [width, height] = [viewBox[2], viewBox[3]];
	const diagram = attr('content');
	if (!diagram) problems.add("no copy of the diagram, so it can't be opened in draw.io again: export it again (File → Export as → SVG) with “Include a copy of my diagram” ticked");
	if (root) root.attrs = root.attrs.filter(([name]) => !['x', 'y', 'width', 'height', 'viewBox'].includes(name));
	return { problems: [...problems], root, width, height, viewBox: viewBox?.join(' '), diagram };
}

const cache = new Map();
/** readDrawioSvg for a file, cached by its modification time and size. */
export function readDrawioSvgFile(path) {
	const { mtimeMs, size } = statSync(path);
	const key = `${mtimeMs}:${size}`;
	const hit = cache.get(path);
	if (hit?.key === key) return hit.value;
	const value = readDrawioSvg(readFileSync(path, 'utf8'));
	cache.set(path, { key, value });
	return value;
}

/** SVG attribute name → React/hast property name (stroke-width → strokeWidth). */
const property = (name) => name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

// draw.io names one family per label ('JetBrains Mono'); a fallback keeps the text readable if the
// site's theme doesn't load that font.
function withFallback(family) {
	if (/\b(serif|sans-serif|monospace|system-ui)\s*$/i.test(family)) return family;
	return `${family}, ${/mono|code|courier|consol/i.test(family) ? 'monospace' : 'sans-serif'}`;
}

/** Ids made unique to this diagram on the page, and references to them changed to match. */
function localValue(name, value, prefix) {
	if (name === 'id') return prefix + value;
	if (name === 'href' && LOCAL_REF.test(value)) return `#${prefix}${value.slice(1)}`;
	const url = value.match(LOCAL_URL);
	if (url) return `url(#${prefix}${url[1]})`;
	if (name === 'font-family') return withFallback(value);
	return value;
}

/**
 * The diagram as hast, for the page: a <figure class="lms-drawio"> with the cleaned SVG (labelled
 * with `alt` for screen readers) and an optional caption. `idPrefix` keeps two diagrams on one
 * page from sharing ids. The SVG's own width is its max-width, which the click-to-enlarge script
 * (src/client/zoom.ts) reads, as it does for Mermaid diagrams.
 */
export function drawioFigure({ root, width, height, viewBox }, { alt, caption, idPrefix }) {
	const element = (node) =>
		typeof node === 'string'
			? { type: 'text', value: node }
			: {
					type: 'element',
					tagName: node.name,
					properties: Object.fromEntries(node.attrs.map(([name, value]) => [property(name), localValue(name, value, idPrefix)])),
					children: node.children.map(element),
				};
	const svg = element(root);
	svg.properties = { viewBox, width: String(width), height: String(height), role: 'img', ariaLabel: alt, style: `max-width:${width}px`, ...svg.properties };
	const children = [svg];
	if (caption) children.push({ type: 'element', tagName: 'figcaption', properties: {}, children: [{ type: 'text', value: caption }] });
	return { type: 'element', tagName: 'figure', properties: { className: ['lms-drawio', 'not-content'] }, children };
}

const escapeXml = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\n/g, '&#10;');

/** The cleaned SVG as a file of its own, still carrying the diagram so it opens in draw.io. */
export function drawioSvgFile({ root, width, height, viewBox, diagram }) {
	const write = (node) => {
		if (typeof node === 'string') return escapeXml(node);
		const attrs = node.attrs.map(([name, value]) => ` ${name}="${escapeXml(value)}"`).join('');
		return node.children.length ? `<${node.name}${attrs}>${node.children.map(write).join('')}</${node.name}>` : `<${node.name}${attrs}/>`;
	};
	const rootAttrs = ` xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox}"${diagram ? ` content="${escapeXml(diagram)}"` : ''}`;
	const body = write(root);
	return `<?xml version="1.0" encoding="UTF-8"?>\n${body.replace(/^<svg/, `<svg${rootAttrs}`)}\n`;
}
