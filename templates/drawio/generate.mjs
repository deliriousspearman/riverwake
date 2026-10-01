// Generates the draw.io network diagram templates in this folder. Each layout is described once
// and produces codex-network-<layout>.drawio, with two pages: "New diagram" (the layout's empty
// zones, title and legend) and "Example" (the example network). It also writes
// codex-network-library.xml, the shapes for draw.io's left panel. Icons are draw.io stencils
// defined inside the files (shape=stencil(…)), so they need nothing from draw.io's own libraries.
//
//   node templates/drawio/generate.mjs templates/drawio [previews-dir] [--no-font-source]
//
// The fonts are the site's, which draw.io loads from Google Fonts (`fontSource`) while online. For a
// draw.io without internet access, --no-font-source leaves that out: draw.io then uses the fonts
// installed on the editor's computer, from templates/drawio/fonts/.
// With a previews folder, it also writes an SVG of each layout's two pages, drawn the same way.
//
// Labels are plain text (no html=1, no word wrap): draw.io then exports them as SVG text, which the
// site puts straight into the page (scripts/drawio-svg.mjs). Formatted (HTML) labels would export as
// <foreignObject>, which the site refuses. A label has one font, colour and weight, so a host's
// address (and OS) are text cells of their own, children of the card or icon so they move with it.
// The colours and fonts are the site's Hardline Classic theme (src/css/site/theme.css and src/css/themes/): change them here
// and run it again if the theme changes. Check the result by opening the files in draw.io.
import { deflateRawSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const NO_FONT_SOURCE = args.includes('--no-font-source');
const [OUT = new URL('.', import.meta.url).pathname, PREVIEWS] = args.filter((arg) => !arg.startsWith('--'));
mkdirSync(OUT, { recursive: true });
if (PREVIEWS) mkdirSync(PREVIEWS, { recursive: true });

// Hardline Classic (src/css/site/theme.css, src/css/themes/): navy panels, square corners, 2px outlines.
const C = {
	frame: '#1a2332', frameLine: '#2c3a52', zoneFill: '#141d2b', card: '#202c3f', cardLine: '#52627f',
	white: '#ffffff', text: '#e4e9f4', muted: '#a4b1cd', faint: '#8494b5', dim: '#52627f', onBadge: '#0e1a02',
	lime: '#9fef00', red: '#ff3e3e', orange: '#ffaf00', blue: '#5cb2ff', purple: '#c16cfa',
};
// Operating systems and platforms, shown as a badge on an icon. Any OS fits one of these families;
// the badge text and the full name under the address say which.
const OS = {
	windows: { badge: 'WIN', colour: '#5cb2ff', label: 'Windows' },
	linux: { badge: 'LINUX', colour: '#ffcc5c', label: 'Linux' },
	bsd: { badge: 'BSD', colour: '#2ee7b6', label: 'BSD (pfSense, OPNsense)' },
	hypervisor: { badge: 'PVE', colour: '#c16cfa', label: 'Hypervisor (Proxmox, ESXi, Hyper-V)' },
	network: { badge: 'IOS', colour: '#a4b1cd', label: 'Network OS (Cisco IOS, RouterOS)' },
	macos: { badge: 'MACOS', colour: '#e4e9f4', label: 'macOS' },
};
const gf = (family) => (NO_FONT_SOURCE ? '' : `fontSource=${encodeURIComponent(`https://fonts.googleapis.com/css?family=${family}`)};`);
const FONT = {
	display: { css: "'Chakra Petch', sans-serif", style: `fontFamily=Chakra Petch;${gf('Chakra+Petch:400,600,700')}` },
	body: { css: "'Figtree', sans-serif", style: `fontFamily=Figtree;${gf('Figtree:400,600,700')}` },
	mono: { css: "'JetBrains Mono', monospace", style: `fontFamily=JetBrains Mono;${gf('JetBrains+Mono:400,700')}` },
};
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\n/g, '&#xa;');
const compress = (text) => deflateRawSync(Buffer.from(encodeURIComponent(text))).toString('base64');

const HOSTS = {
	attacker: { tag: 'THREAT ACTOR', name: 'attacker', addr: '203.0.113.66', icon: 'person', os: ['linux', 'Kali Linux'] },
	internet: { tag: 'WAN', name: 'Internet', addr: '0.0.0.0/0', icon: 'cloud' },
	fw01: { tag: 'FIREWALL', name: 'fw01', addr: '192.0.2.1', icon: 'firewall', os: ['bsd', 'pfSense 2.7'] },
	web01: { tag: 'WEB SERVER', name: 'web01', addr: '198.51.100.20', icon: 'server', os: ['linux', 'Ubuntu 24.04'] },
	mail01: { tag: 'MAIL SERVER', name: 'mail01', addr: '198.51.100.25', icon: 'server', os: ['linux', 'Debian 12'] },
	jump01: { tag: 'JUMP HOST', name: 'jump01', addr: '192.0.2.250', icon: 'server', os: ['windows', 'Windows Server 2022'] },
	siem01: { tag: 'SIEM', name: 'siem01', addr: '192.0.2.251', icon: 'monitor', os: ['linux', 'Ubuntu 22.04'] },
	sw01: { tag: 'SWITCH', name: 'sw01', addr: '192.0.2.2', icon: 'switch', os: ['network', 'Cisco IOS 15'] },
	dc01: { tag: 'DOMAIN CONTROLLER', name: 'dc01', addr: '192.0.2.10', icon: 'server', os: ['windows', 'Windows Server 2022'] },
	file01: { tag: 'FILE SERVER', name: 'file01', addr: '192.0.2.20', icon: 'server', os: ['windows', 'Windows Server 2019'] },
	backup01: { tag: 'BACKUP', name: 'backup01', addr: '192.0.2.30', icon: 'server', os: ['linux', 'Rocky Linux 9'] },
	ws01: { tag: 'WORKSTATION', name: 'ws01', addr: '192.0.2.101', icon: 'pc', os: ['windows', 'Windows 11'] },
	ws02: { tag: 'WORKSTATION', name: 'ws02', addr: '192.0.2.102', icon: 'pc', os: ['windows', 'Windows 11'] },
};

// ---------------------------------------------------------------------------------------------
// Icons: simple shapes in a local box. `body` is filled and outlined, `marks` are lines only.

const ICONS = {
	server: { w: 36, h: 44, body: [['rect', 0, 0, 36, 44]], marks: [['path', 'M0,15 L36,15'], ['path', 'M0,30 L36,30'], ['path', 'M23,7.5 L30,7.5'], ['path', 'M23,22.5 L30,22.5'], ['path', 'M23,37.5 L30,37.5']] },
	firewall: { w: 44, h: 36, body: [['rect', 0, 0, 44, 36]], marks: [['path', 'M0,12 L44,12'], ['path', 'M0,24 L44,24'], ['path', 'M14,0 L14,12'], ['path', 'M30,0 L30,12'], ['path', 'M22,12 L22,24'], ['path', 'M8,24 L8,36'], ['path', 'M36,24 L36,36']] },
	switch: { w: 48, h: 24, body: [['rect', 0, 0, 48, 24]], marks: [['path', 'M10,8 L34,8'], ['path', 'M30,5 L34,8 L30,11'], ['path', 'M38,16 L14,16'], ['path', 'M18,13 L14,16 L18,19']] },
	pc: { w: 40, h: 38, body: [['rect', 0, 0, 40, 28]], marks: [['path', 'M20,28 L20,36'], ['path', 'M10,37 L30,37']] },
	monitor: { w: 40, h: 38, body: [['rect', 0, 0, 40, 28]], marks: [['path', 'M7,21 L14,13 L20,18 L28,8'], ['path', 'M20,28 L20,36'], ['path', 'M10,37 L30,37']] },
	cloud: { w: 46, h: 30, body: [['path', 'M5,28 A10,10 0 0 1 3,9 A13,13 0 0 1 27,3 A11,11 0 0 1 43,13 A8,8 0 0 1 41,28 Z']], marks: [] },
	person: { w: 34, h: 38, body: [['ellipse', 8, 0, 18, 18], ['path', 'M0,38 A17,15 0 0 1 34,38 Z']], marks: [] },
};

/** The icon as SVG, its top left at (x, y). */
function iconSvg(type, x, y, colour) {
	const ic = ICONS[type];
	const shape = ([kind, ...a], fill) => {
		const style = `fill="${fill}" stroke="${colour}" stroke-width="2" stroke-linejoin="miter"`;
		if (kind === 'rect') return `<rect x="${x + a[0]}" y="${y + a[1]}" width="${a[2]}" height="${a[3]}" ${style}/>`;
		if (kind === 'ellipse') return `<ellipse cx="${x + a[0] + a[2] / 2}" cy="${y + a[1] + a[3] / 2}" rx="${a[2] / 2}" ry="${a[3] / 2}" ${style}/>`;
		return `<path transform="translate(${x},${y})" d="${a[0]}" ${style}/>`;
	};
	return `<g>${ic.body.map((b) => shape(b, C.card)).join('')}${ic.marks.map((m) => shape(m, 'none')).join('')}</g>`;
}

/** The icon as a draw.io stencil (XML), with the cell's fill and outline colours. */
function iconStencil(type) {
	const ic = ICONS[type];
	const pathXml = (d) =>
		`<path>${[...d.matchAll(/([MLAZ])([^MLAZ]*)/g)]
			.map(([, cmd, args]) => {
				const n = args.split(/[ ,]+/).filter(Boolean).map(Number);
				if (cmd === 'M') return `<move x="${n[0]}" y="${n[1]}"/>`;
				if (cmd === 'L') return n.reduce((acc, v, i) => (i % 2 ? `${acc}<line x="${n[i - 1]}" y="${v}"/>` : acc), '');
				if (cmd === 'A') return `<arc rx="${n[0]}" ry="${n[1]}" x-axis-rotation="${n[2]}" large-arc-flag="${n[3]}" sweep-flag="${n[4]}" x="${n[5]}" y="${n[6]}"/>`;
				return '<close/>';
			})
			.join('')}</path>`;
	const shape = ([kind, ...a]) => (kind === 'rect' ? `<rect x="${a[0]}" y="${a[1]}" w="${a[2]}" h="${a[3]}"/>` : kind === 'ellipse' ? `<ellipse x="${a[0]}" y="${a[1]}" w="${a[2]}" h="${a[3]}"/>` : pathXml(a[0]));
	const [first, ...rest] = ic.body;
	return `<shape name="codex-${type}" w="${ic.w}" h="${ic.h}" aspect="fixed" strokewidth="inherit"><background>${shape(first)}</background><foreground><fillstroke/>${rest.map((b) => `${shape(b)}<fillstroke/>`).join('')}${ic.marks.map((m) => `${shape(m)}<stroke/>`).join('')}</foreground></shape>`;
}
const stencilStyle = (type) => `shape=stencil(${compress(iconStencil(type))});`;

// ---------------------------------------------------------------------------------------------
// draw.io styles

const S = {
	frame: `rounded=0;fillColor=${C.frame};strokeColor=${C.frameLine};strokeWidth=2;`,
	zone: (colour, { dashed, tint, quiet, labelColour } = {}) =>
		`rounded=0;container=1;collapsible=0;recursiveResize=0;${tint ? `fillColor=${colour};fillOpacity=7;strokeWidth=1.5;` : `fillColor=${C.zoneFill};strokeWidth=2;`}strokeColor=${quiet ? C.frameLine : colour};${dashed ? 'dashed=1;dashPattern=8 4;' : ''}verticalAlign=top;align=left;spacingLeft=14;spacingTop=6;fontSize=13;fontStyle=1;fontColor=${labelColour ?? (quiet ? C.faint : colour)};${FONT.display.style}`,
	// The card's own label is the host name (bold, at the top); the address is a child text cell (S.sub).
	card: (line = C.cardLine, colour = C.text) => `rounded=0;fillColor=${C.card};strokeColor=${line};strokeWidth=2;align=left;verticalAlign=top;spacing=0;spacingLeft=12;spacingTop=10;fontSize=13;fontStyle=1;fontColor=${colour};${FONT.mono.style}`,
	sub: (size, colour, align = 'left') => `text;align=${align};verticalAlign=middle;spacing=0;fontSize=${size};fontColor=${colour};${FONT.mono.style}`,
	tag: `text;align=left;verticalAlign=bottom;spacing=0;spacingBottom=2;fontSize=10;fontColor=${C.faint};${FONT.mono.style}`,
	icon: (type, colour) => `${stencilStyle(type)}aspect=fixed;fillColor=${C.card};strokeColor=${colour};strokeWidth=2;verticalLabelPosition=bottom;labelPosition=center;align=center;verticalAlign=top;spacingTop=4;fontSize=13;fontStyle=1;fontColor=${C.text};${FONT.mono.style}`,
	badge: (colour) => `rounded=0;fillColor=${colour};strokeColor=${C.frame};strokeWidth=2;fontColor=${C.onBadge};fontSize=9;fontStyle=1;align=center;verticalAlign=middle;spacing=0;${FONT.mono.style}`,
	hypervisor: `rounded=0;container=1;collapsible=0;recursiveResize=0;fillColor=none;strokeColor=${C.purple};strokeWidth=2;dashed=1;dashPattern=4 4;verticalAlign=top;align=left;spacingLeft=12;spacingTop=6;fontSize=12;fontColor=${C.purple};${FONT.mono.style}`,
	bar: `rounded=0;fillColor=${C.lime};strokeColor=none;`,
	text: (font, size, colour, { bold, align = 'left' } = {}) => `text;align=${align};verticalAlign=middle;spacing=0;fontSize=${size};fontColor=${colour};${bold ? 'fontStyle=1;' : ''}${font.style}`,
	step: (colour) => `ellipse;fillColor=${colour};strokeColor=none;fontColor=${C.frame};fontSize=12;fontStyle=1;align=center;verticalAlign=middle;spacing=0;${FONT.mono.style}`,
	edge: (colour, { dashed, arrow, attached } = {}) =>
		`${attached ? 'edgeStyle=orthogonalEdgeStyle;' : ''}rounded=0;strokeColor=${colour};strokeWidth=2;${dashed ? 'dashed=1;dashPattern=6 4;' : ''}${arrow ? 'endArrow=block;endFill=1;endSize=5;' : 'endArrow=none;'}fontSize=11;fontColor=${colour};labelBackgroundColor=${C.frame};${FONT.mono.style}`,
};
const EDGE_COLOUR = { link: C.faint, flow: C.blue, attack: C.red, quiet: C.dim, axis: C.dim };

// ---------------------------------------------------------------------------------------------
// A scene: draws each element as SVG and as draw.io cells at the same time.

class Scene {
	constructor(id, w, h, example) {
		Object.assign(this, { id, w, h, example, back: [], mid: [], front: [], cells: [], boxes: {}, zones: [], n: 0 });
	}
	cell(id, value, style, x, y, w, h, extra = {}) {
		const c = { id: id ?? `c${this.n++}`, value, style, x, y, w, h, ...extra };
		this.cells.push(c);
		return c;
	}
	svgText(x, y, s, { font = FONT.body, size = 14, fill = C.muted, weight = 400, anchor = 'start', layer = 'front' } = {}) {
		this[layer].push(`<text x="${x}" y="${y}" font-family="${font.css}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(s)}</text>`);
	}
	svgRect(x, y, w, h, { fill = 'none', stroke = 'none', width = 2, dash = '', layer = 'back', opacity } = {}) {
		const inset = stroke === 'none' ? 0 : width / 2;
		this[layer].push(`<rect x="${x + inset}" y="${y + inset}" width="${w - 2 * inset}" height="${h - 2 * inset}" fill="${fill}"${opacity !== undefined ? ` fill-opacity="${opacity}"` : ''} stroke="${stroke}" stroke-width="${width}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`);
	}
	/** Free text: `y` is the middle of the line. */
	label(x, y, text, font, size, colour, { bold, align = 'left', w } = {}) {
		const width = w ?? Math.ceil(text.length * size * 0.62) + 8;
		const left = align === 'right' ? x - width : align === 'center' ? x - width / 2 : x;
		this.svgText(align === 'right' ? x : align === 'center' ? x : x, y + size * 0.36, text, { font, size, fill: colour, weight: bold ? 700 : 400, anchor: { left: 'start', right: 'end', center: 'middle' }[align] });
		this.cell(null, esc(text), S.text(font, size, colour, { bold, align }), left, y - size * 0.75, width, size * 1.5);
	}
	frame() {
		this.svgRect(0, 0, this.w, this.h, { fill: C.frame, stroke: C.frameLine });
		this.cell('frame', '', S.frame, 0, 0, this.w, this.h);
	}
	title(title, subtitle) {
		this.svgRect(40, 36, 56, 5, { fill: C.lime, layer: 'front' });
		this.cell('bar', '', S.bar, 40, 36, 56, 5);
		// Text boxes stay inside the frame: draw.io's export is cropped to everything drawn, boxes included.
		const max = this.w - 80;
		this.label(40, 59, 'CODEX · NETWORK DIAGRAM', FONT.display, 12, C.lime, { bold: true, w: Math.min(400, max) });
		this.label(40, 88, this.example ? title : 'Diagram title', FONT.display, 26, C.white, { bold: true, w: Math.min(700, max) });
		this.label(40, 122, this.example ? subtitle : 'One sentence on what the diagram shows.', FONT.body, 14, C.muted, { w: Math.min(900, max) });
	}
	zone(id, x, y, w, h, label, colour, opts = {}) {
		const { dashed, tint, quiet } = opts;
		if (tint) this.svgRect(x, y, w, h, { fill: colour, opacity: 0.07 });
		else this.svgRect(x, y, w, h, { fill: C.zoneFill });
		this.svgRect(x, y, w, h, { stroke: quiet ? C.frameLine : colour, width: tint ? 1.5 : 2, dash: dashed ? '8 4' : '' });
		this.svgText(x + 14, y + 24, label, { font: FONT.display, size: 13, fill: quiet ? C.faint : colour, weight: 700 });
		const c = this.cell(id, esc(label), S.zone(colour, opts), x, y, w, h);
		this.zones.push(c);
	}
	hypervisor(id, x, y, w, h, label) {
		this.svgRect(x, y, w, h, { stroke: C.purple, dash: '4 4' });
		this.svgText(x + 12, y + 22, label, { font: FONT.mono, size: 12, fill: C.purple });
		this.zones.push(this.cell(id, esc(label), S.hypervisor, x, y, w, h));
	}
	card(id, x, y, { w = 200, line, muted = false } = {}) {
		if (!this.example) return;
		const h = HOSTS[id];
		this.svgText(x, y - 6, h.tag, { font: FONT.mono, size: 10, fill: muted ? C.dim : C.faint });
		this.svgRect(x, y, w, 56, { fill: C.card, stroke: line ?? C.cardLine, layer: 'mid' });
		this.svgText(x + 12, y + 24, h.name, { font: FONT.mono, size: 13, fill: muted ? C.muted : C.text, weight: 700 });
		this.svgText(x + 12, y + 42, h.addr, { font: FONT.mono, size: 13, fill: muted ? C.faint : C.muted });
		this.cell(`${id}-tag`, esc(h.tag), S.tag.replace(`fontColor=${C.faint}`, `fontColor=${muted ? C.dim : C.faint}`), x, y - 18, w, 16);
		this.cell(id, h.name, S.card(line, muted ? C.muted : C.text), x, y, w, 56);
		this.cell(`${id}-addr`, h.addr, S.sub(13, muted ? C.faint : C.muted), x + 12, y + 31, w - 24, 18, { parentId: id });
		this.boxes[id] = { x, y, w, h: 56 };
	}
	/** Icon centred on (cx, cy), name and address under it; `os` adds the badge and OS line. */
	icon(id, cx, cy, colour = C.muted, { os = false } = {}) {
		if (!this.example) return;
		const h = HOSTS[id];
		const ic = ICONS[h.icon];
		const x = cx - ic.w / 2;
		const y = cy - ic.h / 2;
		this.mid.push(iconSvg(h.icon, x, y, colour));
		const top = y + ic.h + 4;
		this.svgText(cx, top + 13, h.name, { font: FONT.mono, size: 13, fill: C.text, weight: 700, anchor: 'middle' });
		this.svgText(cx, top + 30, h.addr, { font: FONT.mono, size: 12, fill: C.muted, anchor: 'middle' });
		const showOs = os && h.os;
		if (showOs) this.svgText(cx, top + 46, h.os[1], { font: FONT.mono, size: 11, fill: C.faint, anchor: 'middle' });
		this.cell(id, h.name, S.icon(h.icon, colour), x, y, ic.w, ic.h);
		this.cell(`${id}-addr`, h.addr, S.sub(12, C.muted, 'center'), cx - 80, top + 22, 160, 16, { parentId: id });
		if (showOs) this.cell(`${id}-osname`, h.os[1], S.sub(11, C.faint, 'center'), cx - 80, top + 38, 160, 16, { parentId: id });
		this.boxes[id] = { x, y, w: ic.w, h: ic.h };
		if (showOs) this.badge(id, h.os[0]);
	}
	/**
	 * OS badge: by default over a host icon's lower right corner, or at `pos` (top left). In draw.io
	 * it's a child of the host (or `parent`), so it moves with it.
	 */
	badge(id, family, pos, parent = id) {
		const os = OS[family];
		const w = os.badge.length * 6 + 8;
		let [bx, by] = pos ?? [];
		if (!pos) {
			const b = this.boxes[id];
			[bx, by] = [b.x + b.w - w / 2 - 2, b.y + b.h - 9];
		}
		this.front.push(`<rect x="${bx}" y="${by}" width="${w}" height="14" fill="${os.colour}" stroke="${C.frame}" stroke-width="2"/>`);
		this.svgText(bx + w / 2, by + 10, os.badge, { font: FONT.mono, size: 9, fill: C.onBadge, weight: 700, anchor: 'middle' });
		this.cell(id ? `${id}-os` : null, os.badge, S.badge(os.colour), bx, by, w, 14, parent ? { parentId: parent } : {});
		return { w };
	}
	/** Numbered step marker on a host's top right corner. */
	step(id, n, colour) {
		if (!this.example) return;
		const b = this.boxes[id];
		this.front.push(`<circle cx="${b.x + b.w}" cy="${b.y}" r="11" fill="${colour}"/>`);
		this.svgText(b.x + b.w, b.y + 4, String(n), { font: FONT.mono, size: 12, weight: 700, fill: C.frame, anchor: 'middle' });
		this.cell(`${id}-step`, String(n), S.step(colour), b.x + b.w - 11, b.y - 11, 22, 22, { parentId: id });
	}
	/** A port on a host: side l/r/t/b and position along it (0–1). */
	p(id, side, at = 0.5) {
		return { id, side, at };
	}
	xy(pt) {
		if (Array.isArray(pt)) return pt;
		const b = this.boxes[pt.id];
		return { l: [b.x, b.y + b.h * pt.at], r: [b.x + b.w, b.y + b.h * pt.at], t: [b.x + b.w * pt.at, b.y], b: [b.x + b.w * pt.at, b.y + b.h] }[pt.side];
	}
	edge(points, kind = 'link', label, labelAt = 0.5, { force = false } = {}) {
		if (!this.example && !force) return;
		const colour = EDGE_COLOUR[kind];
		const abs = points.map((p) => this.xy(p));
		const dash = kind === 'attack' ? ' stroke-dasharray="6 4"' : '';
		const arrow = kind === 'flow' || kind === 'attack' || kind === 'axis';
		this.back.push(`<polyline points="${abs.map((p) => p.join(',')).join(' ')}" fill="none" stroke="${colour}" stroke-width="2"${dash}${arrow ? ` marker-end="url(#${this.id}-${kind})"` : ''}/>`);
		if (label) {
			const lens = abs.slice(1).map((q, i) => Math.hypot(q[0] - abs[i][0], q[1] - abs[i][1]));
			let d = lens.reduce((a, b) => a + b, 0) * labelAt;
			let i = 0;
			while (d > lens[i] && i < lens.length - 1) d -= lens[i++];
			const t = lens[i] ? d / lens[i] : 0;
			const [mx, my] = [abs[i][0] + (abs[i + 1][0] - abs[i][0]) * t, abs[i][1] + (abs[i + 1][1] - abs[i][1]) * t];
			const w = label.length * 6.7 + 10;
			this.front.push(`<rect x="${mx - w / 2}" y="${my - 9}" width="${w}" height="17" fill="${C.frame}"/>`);
			this.svgText(mx, my + 4, label, { font: FONT.mono, size: 11, fill: colour, anchor: 'middle' });
		}
		// draw.io: ends on a host are attached (moving the host keeps the line), others are fixed points.
		const [first, last] = [points[0], points.at(-1)];
		const attached = !Array.isArray(first) && !Array.isArray(last);
		const constraint = (pt, end) => {
			const [cx, cy] = { l: [0, pt.at], r: [1, pt.at], t: [pt.at, 0], b: [pt.at, 1] }[pt.side];
			return `${end}X=${cx};${end}Y=${cy};${end}Dx=0;${end}Dy=0;`;
		};
		let style = S.edge(colour, { dashed: kind === 'attack', arrow, attached });
		const extra = {};
		if (!Array.isArray(first)) (style += constraint(first, 'exit')), (extra.source = first.id);
		else extra.sourcePoint = first;
		if (!Array.isArray(last)) (style += constraint(last, 'entry')), (extra.target = last.id);
		else extra.targetPoint = last;
		this.cell(null, label ? esc(label) : '', style, 0, 0, 0, 0, { edge: true, points: abs.slice(1, -1), labelX: label ? labelAt * 2 - 1 : 0, ...extra });
	}
	legend(x, y, items) {
		for (const item of items) {
			let swatch = 22;
			if (item.zone) {
				this.svgRect(x + 1, y + 5, 20, 12, { fill: item.tint ? item.zone : C.zoneFill, opacity: item.tint ? 0.15 : undefined, stroke: item.zone, dash: item.dashed ? '6 3' : '', layer: 'front' });
				this.cell(null, '', `rounded=0;fillColor=${item.tint ? item.zone : C.zoneFill};${item.tint ? 'fillOpacity=15;' : ''}strokeColor=${item.zone};strokeWidth=2;${item.dashed ? 'dashed=1;dashPattern=6 3;' : ''}`, x + 1, y + 5, 20, 12);
			} else if (item.os) {
				swatch = this.badge(null, item.os, [x, y + 4], null).w;
			} else {
				this.edge([[x, y + 11], [x + 22, y + 11]], item.line, undefined, 0.5, { force: true });
			}
			const tw = Math.ceil(item.text.length * 6.8) + 8;
			this.label(x + swatch + 10, y + 11, item.text, FONT.body, 12, C.muted, { w: tw });
			x += swatch + 10 + tw + 22;
		}
	}

	svg() {
		const m = (name, colour) => `<marker id="${this.id}-${name}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${colour}"/></marker>`;
		return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.w} ${this.h}" width="${this.w}" height="${this.h}" role="img"><defs>${m('flow', C.blue)}${m('attack', C.red)}${m('axis', C.dim)}</defs>${this.back.join('')}${this.mid.join('')}${this.front.join('')}</svg>\n`;
	}

	/** The draw.io model. Hosts and their labels go inside the zone that contains them. */
	graphXml() {
		const byId = new Map(this.cells.map((c) => [c.id, c]));
		const inside = (c, z) => c !== z && c.x >= z.x && c.y >= z.y && c.x + c.w <= z.x + z.w && c.y + c.h <= z.y + z.h;
		const absolute = new Map(this.cells.map((c) => [c.id, { x: c.x, y: c.y }]));
		for (const c of this.cells) {
			if (c.edge || c.parentId || c.id === 'frame') continue;
			const zone = this.zones.filter((z) => inside(c, z)).sort((a, b) => a.w * a.h - b.w * b.h)[0];
			if (zone) c.parentId = zone.id;
		}
		// Every cell is placed in page coordinates; draw.io wants them relative to the parent.
		const pos = (c) => {
			if (!c.parentId) return { x: c.x, y: c.y };
			const pa = absolute.get(c.parentId);
			return { x: c.x - pa.x, y: c.y - pa.y };
		};
		const cellXml = (c) => {
			const parent = c.parentId ?? '1';
			if (c.edge) {
				const pts = c.points.length ? `<Array as="points">${c.points.map(([x, y]) => `<mxPoint x="${x}" y="${y}"/>`).join('')}</Array>` : '';
				const sp = c.sourcePoint ? `<mxPoint x="${c.sourcePoint[0]}" y="${c.sourcePoint[1]}" as="sourcePoint"/>` : '';
				const tp = c.targetPoint ? `<mxPoint x="${c.targetPoint[0]}" y="${c.targetPoint[1]}" as="targetPoint"/>` : '';
				return `<mxCell id="${c.id}" value="${esc(c.value)}" style="${esc(c.style)}" edge="1" parent="1"${c.source ? ` source="${c.source}"` : ''}${c.target ? ` target="${c.target}"` : ''}><mxGeometry${c.labelX ? ` x="${c.labelX}"` : ''} relative="1" as="geometry">${sp}${tp}${pts}</mxGeometry></mxCell>`;
			}
			const { x, y } = pos(c);
			return `<mxCell id="${c.id}" value="${esc(c.value)}" style="${esc(c.style)}" vertex="1" parent="${parent}"><mxGeometry x="${x}" y="${y}" width="${c.w}" height="${c.h}" as="geometry"/></mxCell>`;
		};
		// Parents before children; edges last so they draw over zones.
		const vertices = this.cells.filter((c) => !c.edge);
		const ordered = [];
		const seen = new Set();
		const visit = (c) => {
			if (seen.has(c.id)) return;
			if (c.parentId) visit(byId.get(c.parentId));
			seen.add(c.id);
			ordered.push(c);
		};
		vertices.forEach(visit);
		const cells = [...ordered, ...this.cells.filter((c) => c.edge)].map(cellXml).join('');
		return `<mxGraphModel dx="${this.w}" dy="${this.h}" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${this.w}" pageHeight="${this.h}" background="none" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells}</root></mxGraphModel>`;
	}
}

const LEGEND = [
	{ zone: C.red, dashed: true, text: 'Untrusted' },
	{ zone: C.orange, text: 'DMZ' },
	{ zone: C.lime, text: 'Internal' },
	{ zone: C.blue, text: 'Management' },
	{ line: 'link', text: 'Network link' },
	{ line: 'flow', text: 'Traffic flow' },
	{ line: 'attack', text: 'Attack path' },
];
const SUBTITLE = 'An attacker gets in through the web server in the DMZ, then moves to the internal network.';

// ---------------------------------------------------------------------------------------------
// The layouts. Each takes `example`: false gives the empty structure for the "New diagram" page.

function zones(example) {
	const s = new Scene('zones', 1320, 840, example);
	s.frame();
	s.title('Small office network', SUBTITLE);
	s.zone('z-internet', 40, 170, 260, 580, 'INTERNET (UNTRUSTED)', C.red, { dashed: true });
	s.zone('z-dmz', 560, 170, 300, 250, 'DMZ', C.orange);
	s.zone('z-mgmt', 900, 170, 380, 250, 'MANAGEMENT', C.blue);
	s.zone('z-internal', 560, 450, 720, 300, 'INTERNAL NETWORK', C.lime);
	s.card('attacker', 70, 240, { line: C.red });
	s.card('internet', 70, 390);
	s.card('fw01', 330, 390);
	s.card('web01', 610, 240, { line: C.lime });
	s.card('mail01', 610, 336);
	s.card('jump01', 990, 240);
	s.card('siem01', 990, 336);
	s.card('sw01', 590, 520);
	s.card('dc01', 830, 520);
	s.card('file01', 1050, 520);
	s.card('ws01', 590, 660);
	s.card('ws02', 830, 660);
	s.edge([s.p('internet', 'r'), s.p('fw01', 'l')]);
	s.edge([s.p('fw01', 'r'), [545, 418], [545, 282], s.p('web01', 'l', 0.75)]);
	s.edge([s.p('fw01', 'r'), [545, 418], [545, 364], s.p('mail01', 'l')]);
	s.edge([s.p('fw01', 'b'), [430, 548], s.p('sw01', 'l')]);
	s.edge([s.p('sw01', 'r'), s.p('dc01', 'l')]);
	s.edge([s.p('dc01', 'r'), s.p('file01', 'l')]);
	s.edge([s.p('sw01', 'b'), s.p('ws01', 't')]);
	s.edge([s.p('sw01', 'b', 0.75), [740, 620], [930, 620], s.p('ws02', 't')]);
	s.edge([s.p('jump01', 'b'), s.p('siem01', 't')], 'flow');
	s.edge([s.p('attacker', 'r', 0.25), s.p('web01', 'l', 0.25)], 'attack', '1 · exploit');
	s.edge([s.p('web01', 'r'), [880, 268], [880, 490], [980, 490], s.p('dc01', 't', 0.75)], 'attack', '2 · lateral movement', 0.72);
	s.legend(40, 784, LEGEND);
	return s;
}

function lanes(example) {
	const s = new Scene('lanes', 1320, 860, example);
	s.frame();
	s.title('Small office network', SUBTITLE);
	const lane = (id, x, label, colour, dashed) => s.zone(id, x, 200, 240, 590, label, colour, { dashed });
	lane('z-untrusted', 40, 'UNTRUSTED', C.red, true);
	lane('z-perimeter', 296, 'PERIMETER', C.faint);
	lane('z-dmz', 552, 'DMZ', C.orange);
	lane('z-internal', 808, 'INTERNAL', C.lime);
	lane('z-mgmt', 1064, 'MANAGEMENT', C.blue);
	s.label(40, 161, 'less trusted', FONT.mono, 11, C.faint);
	s.label(1280, 161, 'more trusted', FONT.mono, 11, C.faint, { align: 'right' });
	s.edge([[140, 161], [1180, 161]], 'axis', undefined, 0.5, { force: true });
	const x = (laneX) => laneX + 20;
	s.card('attacker', x(40), 280, { line: C.red });
	s.card('internet', x(40), 400);
	s.card('fw01', x(296), 400);
	s.card('web01', x(552), 280, { line: C.lime });
	s.card('mail01', x(552), 400);
	s.card('sw01', x(808), 280);
	s.card('dc01', x(808), 390);
	s.card('file01', x(808), 500);
	s.card('ws01', x(808), 610);
	s.card('ws02', x(808), 700);
	s.card('jump01', x(1064), 280);
	s.card('siem01', x(1064), 400);
	// The core: from the firewall up to a line above the lanes, then down into each lane.
	s.edge([s.p('internet', 'r'), s.p('fw01', 'l')]);
	s.edge([s.p('fw01', 't'), [416, 186], [1184, 186], s.p('jump01', 't')]);
	if (example) s.label(424, 177, 'core', FONT.mono, 10, C.faint);
	s.edge([[672, 186], s.p('web01', 't')]);
	s.edge([s.p('web01', 'l', 0.8), [562, 325], [562, 428], s.p('mail01', 'l')]);
	s.edge([[928, 186], s.p('sw01', 't')]);
	s.edge([s.p('sw01', 'l'), [818, 308], [818, 728], s.p('ws02', 'l')]);
	if (example) for (const id of ['dc01', 'file01', 'ws01']) s.edge([[818, s.xy(s.p(id, 'l'))[1]], s.p(id, 'l')]);
	s.edge([s.p('jump01', 'b'), s.p('siem01', 't')], 'flow');
	s.edge([s.p('attacker', 'r', 0.3), s.p('web01', 'l', 0.3)], 'attack', '1 · exploit', 0.35);
	s.edge([s.p('web01', 'r'), [800, 308], [800, 404], s.p('dc01', 'l', 0.25)], 'attack', '2 · lateral', 0.4);
	s.legend(40, 812, LEGEND);
	return s;
}

function bands(example) {
	const W = 760;
	const s = new Scene('bands', W, 1240, example);
	s.frame();
	s.title('Small office network', 'Attacker in through web01, then on to dc01.');
	const band = (id, y, h, label, colour, dashed) => s.zone(id, 40, y, W - 80, h, label, colour, { dashed });
	band('z-internet', 160, 150, 'INTERNET (UNTRUSTED)', C.red, true);
	band('z-perimeter', 330, 120, 'PERIMETER', C.faint);
	band('z-dmz', 470, 150, 'DMZ', C.orange);
	band('z-internal', 640, 300, 'INTERNAL NETWORK', C.lime);
	band('z-mgmt', 960, 150, 'MANAGEMENT', C.blue);
	s.card('attacker', 80, 220, { line: C.red, w: 190 });
	s.card('internet', 300, 220, { w: 190 });
	s.card('fw01', 300, 375, { w: 190 });
	s.card('web01', 300, 530, { line: C.lime, w: 190 });
	s.card('mail01', 520, 530, { w: 190 });
	s.card('sw01', 80, 700, { w: 190 });
	s.card('dc01', 300, 700, { w: 190 });
	s.card('file01', 520, 700, { w: 190 });
	s.card('ws01', 80, 840, { w: 190 });
	s.card('ws02', 300, 840, { w: 190 });
	s.card('siem01', 80, 1020, { w: 190 });
	s.card('jump01', 300, 1020, { w: 190 });
	s.edge([s.p('internet', 'b'), s.p('fw01', 't')]);
	s.edge([s.p('fw01', 'b'), s.p('web01', 't')]);
	s.edge([s.p('fw01', 'r', 0.3), [615, 392], s.p('mail01', 't')]);
	s.edge([s.p('fw01', 'l'), [140, 403], s.p('sw01', 't', 0.316)]);
	s.edge([s.p('sw01', 'r'), s.p('dc01', 'l')]);
	s.edge([s.p('dc01', 'r'), s.p('file01', 'l')]);
	s.edge([s.p('sw01', 'b'), s.p('ws01', 't')]);
	s.edge([s.p('sw01', 'b', 0.8), [232, 800], [395, 800], s.p('ws02', 't')]);
	s.edge([s.p('jump01', 'l'), s.p('siem01', 'r')], 'flow');
	s.edge([s.p('fw01', 'r', 0.75), [740, 417], [740, 1048], s.p('jump01', 'r')]);
	s.edge([s.p('attacker', 'b', 0.7), [213, 500], [280, 500], [280, 545], s.p('web01', 'l', 0.27)], 'attack', '1 · exploit', 0.517);
	s.edge([s.p('web01', 'b', 0.3), [357, 660], s.p('dc01', 't', 0.3)], 'attack', '2 · lateral movement', 0.5);
	s.legend(40, 1134, LEGEND.slice(0, 4));
	s.legend(40, 1170, LEGEND.slice(4));
	return s;
}

function hub(example) {
	const s = new Scene('hub', 1320, 940, example);
	s.frame();
	s.title('Small office network', SUBTITLE);
	s.zone('z-internet', 40, 330, 260, 290, 'INTERNET (UNTRUSTED)', C.red, { dashed: true });
	s.zone('z-dmz', 420, 160, 480, 150, 'DMZ', C.orange);
	s.zone('z-mgmt', 1020, 330, 260, 290, 'MANAGEMENT', C.blue);
	s.zone('z-internal', 310, 620, 700, 260, 'INTERNAL NETWORK', C.lime);
	s.card('attacker', 70, 390, { line: C.red });
	s.card('internet', 70, 520);
	s.card('fw01', 560, 440, { line: C.faint });
	s.card('web01', 450, 220, { line: C.lime });
	s.card('mail01', 680, 220);
	s.card('jump01', 1050, 390);
	s.card('siem01', 1050, 520);
	s.card('sw01', 340, 690);
	s.card('dc01', 560, 690);
	s.card('file01', 780, 690);
	s.card('ws01', 340, 800);
	s.card('ws02', 560, 800);
	s.edge([s.p('internet', 'r'), [420, 548], [420, 468], s.p('fw01', 'l')]);
	s.edge([s.p('fw01', 't'), [660, 340], [550, 340], s.p('web01', 'b')]);
	s.edge([s.p('fw01', 't'), [660, 340], [780, 340], s.p('mail01', 'b')]);
	s.edge([s.p('fw01', 'r'), [960, 468], [960, 418], s.p('jump01', 'l')]);
	s.edge([s.p('fw01', 'b'), [660, 590], [490, 590], s.p('sw01', 't', 0.75)]);
	s.edge([s.p('sw01', 'r'), s.p('dc01', 'l')]);
	s.edge([s.p('dc01', 'r'), s.p('file01', 'l')]);
	s.edge([s.p('sw01', 'b'), s.p('ws01', 't')]);
	s.edge([s.p('sw01', 'b', 0.8), [500, 770], [660, 770], s.p('ws02', 't')]);
	s.edge([s.p('jump01', 'b'), s.p('siem01', 't')], 'flow');
	s.edge([s.p('attacker', 'r'), [380, 418], [380, 234], s.p('web01', 'l', 0.25)], 'attack', '1 · exploit', 0.45);
	s.edge([s.p('web01', 't', 0.7), [590, 190], [940, 190], [940, 660], [700, 660], s.p('dc01', 't', 0.7)], 'attack', '2 · lateral movement', 0.47);
	s.legend(40, 896, LEGEND);
	return s;
}

function icons(example) {
	const s = new Scene('icons', 1320, 800, example);
	s.frame();
	s.title('Small office network', SUBTITLE);
	s.zone('z-internet', 40, 170, 240, 540, 'INTERNET (UNTRUSTED)', C.red, { tint: true, dashed: true });
	s.zone('z-dmz', 480, 170, 360, 220, 'DMZ', C.orange, { tint: true });
	s.zone('z-mgmt', 880, 170, 400, 220, 'MANAGEMENT', C.blue, { tint: true });
	s.zone('z-internal', 480, 420, 800, 290, 'INTERNAL NETWORK', C.lime, { tint: true });
	s.icon('attacker', 160, 266, C.red);
	s.icon('internet', 160, 470);
	s.icon('fw01', 380, 470);
	s.icon('web01', 590, 266, C.lime);
	s.icon('mail01', 740, 266);
	s.icon('jump01', 1000, 266);
	s.icon('siem01', 1160, 266);
	s.icon('sw01', 590, 506);
	s.icon('dc01', 820, 506);
	s.icon('file01', 1050, 506);
	s.icon('ws01', 590, 636);
	s.icon('ws02', 820, 636);
	s.edge([s.p('internet', 'r'), s.p('fw01', 'l')]);
	s.edge([s.p('fw01', 'r'), [440, 470], [440, 278], s.p('web01', 'l', 0.75)]);
	s.edge([s.p('web01', 'r', 0.75), s.p('mail01', 'l', 0.75)]);
	s.edge([s.p('fw01', 'r'), [440, 470], [440, 506], s.p('sw01', 'l')]);
	s.edge([s.p('sw01', 'r'), s.p('dc01', 'l')]);
	s.edge([s.p('dc01', 'r'), s.p('file01', 'l')]);
	s.edge([[590, 566], s.p('ws01', 't')]);
	s.edge([[590, 584], [820, 584], s.p('ws02', 't')]);
	s.edge([s.p('jump01', 'r'), s.p('siem01', 'l')], 'flow');
	s.edge([s.p('attacker', 'r', 0.105), s.p('web01', 'l', 0.2)], 'attack', '1 · exploit', 0.45);
	s.edge([s.p('web01', 't'), [590, 210], [860, 210], [860, 466], [820, 466], s.p('dc01', 't')], 'attack', '2 · lateral movement', 0.3);
	s.legend(40, 744, LEGEND.map((l) => (l.zone ? { ...l, tint: true } : l)));
	return s;
}

function attack(example) {
	const s = new Scene('attack', 1320, 840, example);
	s.frame();
	s.title('Small office network', SUBTITLE);
	const q = { quiet: true };
	s.zone('z-internet', 40, 170, 260, 580, 'INTERNET', C.red, { ...q, dashed: true });
	s.zone('z-dmz', 560, 170, 300, 250, 'DMZ', C.orange, q);
	s.zone('z-mgmt', 900, 170, 380, 250, 'MANAGEMENT', C.blue, q);
	s.zone('z-internal', 560, 450, 720, 300, 'INTERNAL NETWORK', C.lime, q);
	const m = { muted: true };
	s.card('attacker', 70, 240, { line: C.red });
	s.card('internet', 70, 390, m);
	s.card('fw01', 330, 390, m);
	s.card('web01', 610, 240, { line: C.red });
	s.card('mail01', 610, 336, m);
	s.card('jump01', 990, 240, m);
	s.card('siem01', 990, 336, m);
	s.card('sw01', 590, 520, m);
	s.card('dc01', 830, 520, { line: C.lime });
	s.card('file01', 1050, 520, m);
	s.card('ws01', 590, 660, m);
	s.card('ws02', 830, 660, m);
	const quiet = 'quiet';
	s.edge([s.p('internet', 'r'), s.p('fw01', 'l')], quiet);
	s.edge([s.p('fw01', 'r'), [545, 418], [545, 282], s.p('web01', 'l', 0.75)], quiet);
	s.edge([s.p('fw01', 'r'), [545, 418], [545, 364], s.p('mail01', 'l')], quiet);
	s.edge([s.p('fw01', 'b'), [430, 548], s.p('sw01', 'l')], quiet);
	s.edge([s.p('sw01', 'r'), s.p('dc01', 'l')], quiet);
	s.edge([s.p('dc01', 'r'), s.p('file01', 'l')], quiet);
	s.edge([s.p('sw01', 'b'), s.p('ws01', 't')], quiet);
	s.edge([s.p('sw01', 'b', 0.75), [740, 620], [930, 620], s.p('ws02', 't')], quiet);
	s.edge([s.p('jump01', 'b'), s.p('siem01', 't')], quiet);
	s.edge([s.p('attacker', 'r', 0.25), s.p('web01', 'l', 0.25)], 'attack', '1 · exploit');
	s.edge([s.p('web01', 'r'), [880, 268], [880, 490], [980, 490], s.p('dc01', 't', 0.75)], 'attack', '2 · lateral movement', 0.72);
	s.step('web01', 1, C.red);
	s.step('dc01', 2, C.lime);
	s.legend(40, 784, [
		{ zone: C.frameLine, text: 'Network zone' },
		{ line: 'quiet', text: 'Network link' },
		{ line: 'attack', text: 'Attack path' },
		{ zone: C.red, text: 'Compromised' },
		{ zone: C.lime, text: 'Attacker’s goal' },
	]);
	return s;
}

/** Icons with each host's operating system: a badge on the icon and the name under the address. */
function iconsOs(example) {
	const s = new Scene('icons-os', 1320, 900, example);
	s.frame();
	s.title('Small office network', 'Every host’s operating system shown on its icon; dc01, file01 and backup01 are QEMU VMs on pve01.');
	s.zone('z-internet', 40, 170, 240, 600, 'INTERNET (UNTRUSTED)', C.red, { tint: true, dashed: true });
	s.zone('z-dmz', 480, 170, 360, 230, 'DMZ', C.orange, { tint: true });
	s.zone('z-mgmt', 880, 170, 400, 230, 'MANAGEMENT', C.blue, { tint: true });
	s.zone('z-internal', 480, 430, 800, 340, 'INTERNAL NETWORK', C.lime, { tint: true });
	s.hypervisor('pve01', 720, 470, 540, 280, example ? 'pve01 · 192.0.2.5 · Proxmox VE 8 (QEMU/KVM)' : 'hypervisor · address · Proxmox VE (QEMU/KVM)');
	if (example) s.badge('pve01', 'hypervisor', [720 + 540 - 34, 478]);
	const os = { os: true };
	s.icon('attacker', 160, 262, C.red, os);
	s.icon('internet', 160, 480);
	s.icon('fw01', 380, 480, C.muted, os);
	s.icon('web01', 590, 262, C.lime, os);
	s.icon('mail01', 740, 262, C.muted, os);
	s.icon('jump01', 1000, 262, C.muted, os);
	s.icon('siem01', 1160, 262, C.muted, os);
	s.icon('sw01', 580, 520, C.muted, os);
	s.icon('dc01', 820, 560, C.muted, os);
	s.icon('file01', 990, 560, C.muted, os);
	s.icon('backup01', 1160, 560, C.muted, os);
	s.icon('ws01', 540, 680, C.muted, os);
	s.icon('ws02', 650, 680, C.muted, os);
	s.edge([s.p('internet', 'r'), s.p('fw01', 'l')]);
	s.edge([s.p('fw01', 'r'), [440, 480], [440, 273], s.p('web01', 'l', 0.75)]);
	s.edge([s.p('web01', 'r', 0.75), s.p('mail01', 'l', 0.75)]);
	s.edge([s.p('fw01', 'r'), [440, 480], [440, 520], s.p('sw01', 'l')]);
	s.edge([s.p('sw01', 'r'), [720, 520]]);
	s.edge([[580, 594], [580, 620], [540, 620], s.p('ws01', 't')]);
	s.edge([[580, 620], [650, 620], s.p('ws02', 't')]);
	s.edge([s.p('jump01', 'r'), s.p('siem01', 'l')], 'flow');
	s.edge([s.p('attacker', 'r', 0.105), s.p('web01', 'l', 0.2)], 'attack', '1 · exploit', 0.45);
	s.edge([s.p('web01', 't'), [590, 206], [860, 206], [860, 515], [820, 515], s.p('dc01', 't')], 'attack', '2 · lateral movement', 0.3);
	s.legend(40, 806, LEGEND.map((l) => (l.zone ? { ...l, tint: true } : l)));
	s.legend(40, 844, Object.keys(OS).map((k) => ({ os: k, text: OS[k].label })));
	return s;
}

export const LAYOUTS = { zones, lanes, bands, hub, icons, attack, 'icons-os': iconsOs };

// ---------------------------------------------------------------------------------------------
// Output

for (const [name, make] of Object.entries(LAYOUTS)) {
	const example = make(true);
	const blank = make(false);
	if (PREVIEWS) {
		writeFileSync(`${PREVIEWS}/${name}.svg`, example.svg());
		writeFileSync(`${PREVIEWS}/${name}-blank.svg`, blank.svg());
	}
	writeFileSync(
		`${OUT}/codex-network-${name}.drawio`,
		`<mxfile host="Codex" agent="Codex template">\n<diagram id="${name}-new" name="New diagram">${blank.graphXml()}</diagram>\n<diagram id="${name}-example" name="Example">${example.graphXml()}</diagram>\n</mxfile>\n`,
	);
}

// The shape library: everything the templates use, to drag onto a page.
function libGraph(cells, w, h) {
	return `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells}</root></mxGraphModel>`;
}
const v = (id, value, style, x, y, w, h, parent = '1') => `<mxCell id="${id}" value="${esc(value)}" style="${esc(style)}" vertex="1" parent="${parent}"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`;
const entry = (title, cells, w, h) => ({ xml: compress(libGraph(cells, w, h)), w, h, aspect: 'fixed', title });
const lineEntry = (title, kind, label = '') => entry(title, `<mxCell id="e" value="${esc(label)}" style="${esc(S.edge(EDGE_COLOUR[kind], { dashed: kind === 'attack', arrow: kind !== 'link' && kind !== 'quiet' }))}" edge="1" parent="1"><mxGeometry relative="1" as="geometry"><mxPoint x="0" y="10" as="sourcePoint"/><mxPoint x="120" y="10" as="targetPoint"/></mxGeometry></mxCell>`, 120, 20);
const cardEntry = (title, id, line) => {
	const h = HOSTS[id];
	return entry(title, v('t', h.tag, S.tag, 0, 0, 200, 16) + v('c', h.name, S.card(line), 0, 18, 200, 56) + v('a', h.addr, S.sub(13, C.muted), 12, 31, 176, 18, 'c'), 200, 74);
};
const iconEntry = (title, type, label, colour = C.muted, os) => {
	const ic = ICONS[type];
	// The name is the icon's own label, under it; the address and OS are child text cells below that.
	let cells = v('i', label, S.icon(type, colour), 0, 0, ic.w, ic.h);
	cells += v('a', '192.0.2.10', S.sub(12, C.muted, 'center'), ic.w / 2 - 80, ic.h + 22, 160, 16, 'i');
	if (os) cells += v('o', OS[os].label.split(' (')[0], S.sub(11, C.faint, 'center'), ic.w / 2 - 80, ic.h + 38, 160, 16, 'i');
	if (os) {
		const b = OS[os];
		const w = b.badge.length * 6 + 8;
		cells += v('b', b.badge, S.badge(b.colour), ic.w - w / 2 - 2, ic.h - 9, w, 14, 'i');
	}
	return entry(title, cells, ic.w, ic.h);
};
const zoneEntry = (title, label, colour, opts) => entry(title, v('z', label, S.zone(colour, opts), 0, 0, 280, 200), 280, 200);
const badgeEntry = (family) => {
	const b = OS[family];
	return entry(`OS badge: ${b.label}`, v('b', b.badge, S.badge(b.colour), 0, 0, b.badge.length * 6 + 8, 14), b.badge.length * 6 + 8, 14);
};
const library = [
	entry('Frame and title', zones(false).cells.filter((c) => ['frame', 'bar'].includes(c.id) || c.style.startsWith('text;')).slice(0, 5).map((c) => v(c.id, c.value, c.style, c.x, c.y, c.w, c.h)).join(''), 1320, 840),
	zoneEntry('Zone: untrusted', 'INTERNET (UNTRUSTED)', C.red, { dashed: true }),
	zoneEntry('Zone: DMZ', 'DMZ', C.orange),
	zoneEntry('Zone: internal', 'INTERNAL NETWORK', C.lime),
	zoneEntry('Zone: management', 'MANAGEMENT', C.blue),
	zoneEntry('Zone: other', 'SEGMENT', C.purple),
	zoneEntry('Zone, tinted: untrusted', 'INTERNET (UNTRUSTED)', C.red, { dashed: true, tint: true }),
	zoneEntry('Zone, tinted: DMZ', 'DMZ', C.orange, { tint: true }),
	zoneEntry('Zone, tinted: internal', 'INTERNAL NETWORK', C.lime, { tint: true }),
	zoneEntry('Zone, tinted: management', 'MANAGEMENT', C.blue, { tint: true }),
	zoneEntry('Zone, quiet (attack focus)', 'ZONE', C.faint, { quiet: true }),
	entry('Hypervisor (VMs go inside)', v('h', 'pve01 · 192.0.2.5 · Proxmox VE 8 (QEMU/KVM)', S.hypervisor, 0, 0, 420, 200), 420, 200),
	cardEntry('Host card', 'dc01'),
	cardEntry('Host card: highlighted', 'web01', C.lime),
	cardEntry('Host card: attacker', 'attacker', C.red),
	iconEntry('Icon: server', 'server', 'host01'),
	iconEntry('Icon: firewall', 'firewall', 'fw01'),
	iconEntry('Icon: switch', 'switch', 'sw01'),
	iconEntry('Icon: workstation', 'pc', 'ws01'),
	iconEntry('Icon: monitoring', 'monitor', 'siem01'),
	iconEntry('Icon: internet', 'cloud', 'Internet'),
	iconEntry('Icon: attacker', 'person', 'attacker', C.red),
	iconEntry('Icon: server, Windows', 'server', 'host01', C.muted, 'windows'),
	iconEntry('Icon: server, Linux', 'server', 'host01', C.muted, 'linux'),
	iconEntry('Icon: firewall, BSD', 'firewall', 'fw01', C.muted, 'bsd'),
	iconEntry('Icon: hypervisor host', 'server', 'pve01', C.muted, 'hypervisor'),
	iconEntry('Icon: workstation, Windows', 'pc', 'ws01', C.muted, 'windows'),
	iconEntry('Icon: workstation, macOS', 'pc', 'mac01', C.muted, 'macos'),
	iconEntry('Icon: switch, network OS', 'switch', 'sw01', C.muted, 'network'),
	...Object.keys(OS).map(badgeEntry),
	lineEntry('Network link', 'link'),
	lineEntry('Traffic flow', 'flow', 'https'),
	lineEntry('Attack path', 'attack', 'exploit'),
	lineEntry('Network link, quiet', 'quiet'),
	entry('Step marker', v('s', '1', S.step(C.red), 0, 0, 22, 22), 22, 22),
	entry('Heading', v('h', 'Heading', S.text(FONT.display, 18, C.white, { bold: true }), 0, 0, 240, 28), 240, 28),
	// Plain text doesn't wrap: break long notes into lines yourself.
	entry('Note', v('n', 'A short note about this\npart of the network.', `text;align=left;verticalAlign=top;fontSize=14;fontColor=${C.muted};${FONT.body.style}`, 0, 0, 240, 48), 240, 48),
];
writeFileSync(`${OUT}/codex-network-library.xml`, `<mxlibrary>${esc(JSON.stringify(library))}</mxlibrary>\n`);
console.log('wrote', Object.keys(LAYOUTS).length, 'templates and', library.length, 'library shapes to', OUT);
