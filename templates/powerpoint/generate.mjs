// Generates the PowerPoint template for course slide decks in this folder: codex-slides.potx (a
// PowerPoint template: opening it starts a new deck) and codex-slides.pptx (the same deck, for
// LibreOffice Impress, Keynote and Google Slides, which don't open .potx files).
//
//   node templates/powerpoint/generate.mjs [out-dir] [previews-dir]
//
// The deck is written here as PresentationML, with no dependencies, so the template can be made
// again offline (as templates/drawio/generate.mjs does): one slide master in the site's style, a
// slide layout for each kind of course slide (title, section, bullets, two columns, three cards,
// terminal, picture, key point, quiz, summary, title only, blank), the theme's colours and fonts
// (so PowerPoint's colour picker and new shapes, lines and tables are in the site's style), and
// an example slide for each layout, with speaker notes on how to use it.
//
// With a previews folder, it also writes an SVG of each example slide and layout, drawn from the
// same description, and it warns about any example text that looks too long for its box (an
// estimate: check the deck itself in PowerPoint or LibreOffice too).
//
// The colours and fonts are the site's Hardline Classic theme (src/css/site/theme.css and
// src/css/themes/), the same as the draw.io templates and the lesson videos: change them here and
// run it again if the theme changes. The output is the same each time (fixed zip dates), so
// tests/powerpoint.test.mjs can check the committed files are up to date.
import { deflateRawSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// ---------------------------------------------------------------------------------------------
// The site's style. Sizes are in pixels of a 1280 × 720 slide (16:9, 96 dpi, so 1px = 9525 EMU),
// the size of the lesson videos; font sizes are in points.

const C = {
	bg: '111927', panel: '1A2332', panel2: '202C3F', line: '2C3A52', cardLine: '52627F', term: '0D1420', grid: '172131',
	white: 'FFFFFF', text: 'E4E9F4', muted: 'A4B1CD', faint: '8494B5', onAccent: '0E1A02', accentLow: '2A3D12',
	lime: '9FEF00', limeSoft: 'C5F467', red: 'FF3E3E', orange: 'FFAF00', blue: '5CB2FF', purple: 'C16CFA', teal: '2EE7B6',
};
const FONT = { display: 'Chakra Petch', body: 'Figtree', mono: 'JetBrains Mono' };
// Theme fonts are named +mj-lt (headings) and +mn-lt (body): changing the theme's fonts changes them.
const FACE = { display: '+mj-lt', body: '+mn-lt', mono: FONT.mono };
// The slide is dark: the master maps the theme's "background" colours to its dark ones.
const THEME_COLOURS = {
	dk1: C.bg, lt1: C.white, dk2: C.panel, lt2: C.muted,
	accent1: C.lime, accent2: C.blue, accent3: C.orange, accent4: C.red, accent5: C.purple, accent6: C.teal,
	hlink: C.limeSoft, folHlink: C.muted,
};
const TABLE_STYLE = '{C0DE5EC0-2026-4C0D-9E1F-9FEF00C0DE01}';

const W = 1280;
const H = 720;
const M = 80; // side margin
const CW = W - 2 * M; // content width
const emu = (px) => Math.round(px * 9525);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Text styles. size: points; spc: letter spacing in hundredths of a point; lnSpc: percent.
const EYEBROW = { font: 'mono', size: 12, bold: true, color: C.lime, caps: true, spc: 300, anchor: 'b' };
const TITLE = { font: 'display', size: 34, bold: true, color: C.white, anchor: 't', lnSpc: 95 };
const BODY = { font: 'body', size: 20, color: C.text };
const MUTED = { font: 'body', size: 18, color: C.muted };

// ---------------------------------------------------------------------------------------------
// Shapes. Each is drawn as PresentationML and as SVG (the previews) from the same description.
//   rect / ellipse: { x, y, w, h, fill, line, lineW }
//   text: { x, y, w, h, paras, style }        a text box
//   ph: { ph, idx, name, x, y, w, h, style, bullets, prompt, fill, line }   a placeholder (layouts)
//   arrow: { x1, y1, x2, y2, color }
//   table: { x, y, colW: [], rowH, rows: [[cell]] }

const rect = (x, y, w, h, fill, line, lineW = 2) => ({ kind: 'rect', x, y, w, h, fill, line, lineW });
const panel = (x, y, w, h) => rect(x, y, w, h, C.panel, C.line);
const text = (x, y, w, h, paras, style) => ({ kind: 'text', x, y, w, h, paras: [].concat(paras), style });
const ph = (ph, idx, name, x, y, w, h, style, prompt, more = {}) => ({ kind: 'ph', ph, idx, name, x, y, w, h, style, prompt, ...more });

/** The logo, as in the navbar: a lime square with a prompt, and the name. */
function logo(x, y, size, nameSize, nameColor = C.white) {
	return [
		rect(x, y, size, size, C.lime),
		text(x, y, size, size, '>_', { font: 'mono', size: Math.round(size * 0.34), bold: true, color: C.onAccent, align: 'ctr', anchor: 'ctr' }),
		text(x + size + 12, y, 300, size, 'Codex', { font: 'display', size: nameSize, bold: true, color: nameColor, anchor: 'ctr' }),
	];
}

/** The footer on every content slide: the logo, small, and the slide number. */
function footer() {
	return [
		...logo(M, 662, 22, 12, C.muted),
		text(W - M - 160, 662, 160, 22, [[{ field: 'slidenum' }]], { font: 'mono', size: 11, color: C.faint, align: 'r', anchor: 'ctr' }),
	];
}

/** A faint 40px grid behind title and section slides, as in the video posters. */
function grid() {
	const lines = [];
	for (let x = 40; x < W; x += 40) lines.push(rect(x, 0, 1, H, C.grid));
	for (let y = 40; y < H; y += 40) lines.push(rect(0, y, W, 1, C.grid));
	return lines;
}

/** The eyebrow and title at the top of every content layout, always in the same place. */
function head(eyebrowPrompt = 'Lesson or topic') {
	return [ph('body', 10, 'Eyebrow', M, 44, CW, 24, EYEBROW, eyebrowPrompt), ph('title', undefined, 'Title', M, 76, CW, 80, TITLE, 'Slide title')];
}

// ---------------------------------------------------------------------------------------------
// The layouts. `master: false` hides the master's shapes (the footer); those layouts draw their own.

const cardW = (CW - 2 * 24) / 3;
const colW = (CW - 24) / 2;
const termW = 736;
const QUIZ_Y = (i) => 188 + i * 110;

const LAYOUTS = [
	{
		key: 'title', name: 'Title', type: 'title', master: false,
		shapes: [
			...grid(),
			...logo(M, 72, 48, 24),
			rect(M, 232, 64, 6, C.lime),
			ph('body', 10, 'Course', M, 254, 960, 30, { ...EYEBROW, size: 14, spc: 400, anchor: 't' }, 'Course name'),
			ph('ctrTitle', undefined, 'Title', M, 294, 1000, 170, { ...TITLE, size: 54 }, 'Lesson title'),
			ph('subTitle', 1, 'Subtitle', M, 474, 860, 90, { font: 'body', size: 22, color: C.muted }, 'What learners will be able to do by the end'),
			ph('body', 11, 'Details', M, 606, 860, 34, { font: 'mono', size: 13, color: C.faint, anchor: 'b' }, 'Lesson 1 · 20 minutes'),
		],
	},
	{
		key: 'section', name: 'Section', type: 'secHead', master: false,
		shapes: [
			...grid(),
			...footer(),
			ph('body', 10, 'Number', M, 150, 600, 144, { font: 'mono', size: 80, bold: true, color: C.lime, anchor: 'b' }, '01'),
			ph('title', undefined, 'Title', M, 306, 1040, 150, { ...TITLE, size: 48 }, 'Section title'),
			ph('body', 11, 'Description', M, 466, 860, 110, { font: 'body', size: 20, color: C.muted }, 'What this part of the lesson covers'),
		],
	},
	{
		key: 'content', name: 'Title and content', type: 'obj',
		shapes: [...head(), ph('body', 1, 'Content', M, 176, CW, 456, BODY, 'Three to five points, a line each', { bullets: true })],
	},
	{
		key: 'two', name: 'Two columns', type: 'twoObj',
		shapes: [
			...head(),
			...[0, 1].flatMap((i) => {
				const x = M + i * (colW + 24);
				return [
					panel(x, 176, colW, 456),
					ph('body', 12 + i * 2, `Heading ${i + 1}`, x + 28, 200, colW - 56, 40, { font: 'display', size: 22, bold: true, color: C.white, anchor: 't' }, i ? 'Second heading' : 'First heading'),
					ph('body', 13 + i * 2, `Content ${i + 1}`, x + 28, 256, colW - 56, 352, { ...BODY, size: 18 }, 'Points', { bullets: true }),
				];
			}),
		],
	},
	{
		key: 'cards', name: 'Three cards', type: 'cust',
		shapes: [
			...head(),
			...[0, 1, 2].flatMap((i) => {
				const x = M + i * (cardW + 24);
				return [
					panel(x, 176, cardW, 456),
					ph('body', 12 + i * 3, `Number ${i + 1}`, x + 28, 202, cardW - 56, 26, { font: 'mono', size: 14, bold: true, color: C.lime }, `0${i + 1}`),
					ph('body', 13 + i * 3, `Heading ${i + 1}`, x + 28, 238, cardW - 56, 76, { font: 'display', size: 22, bold: true, color: C.white, lnSpc: 95 }, 'Heading'),
					ph('body', 14 + i * 3, `Text ${i + 1}`, x + 28, 324, cardW - 56, 284, { font: 'body', size: 17, color: C.text }, 'Two or three short sentences'),
				];
			}),
		],
	},
	{
		key: 'terminal', name: 'Terminal', type: 'cust',
		shapes: [
			...head(),
			rect(M, 176, termW, 456, C.term, C.line),
			rect(M + 1, 177, termW - 2, 40, C.panel),
			...[C.red, C.orange, C.lime].map((c, i) => ({ kind: 'ellipse', x: M + 20 + i * 20, y: 191, w: 12, h: 12, fill: c })),
			ph('body', 12, 'Window title', M + 180, 177, termW - 360, 40, { font: 'mono', size: 11, color: C.muted, align: 'ctr', anchor: 'ctr' }, 'learner@codex: ~'),
			ph('body', 13, 'Commands', M + 24, 236, termW - 48, 376, { font: 'mono', size: 15, color: C.text, lnSpc: 120 }, '$ command --and arguments'),
			ph('body', 14, 'Explanation', M + termW + 32, 176, CW - termW - 32, 456, { ...BODY, size: 18 }, 'What to look for in the output', { bullets: true }),
		],
	},
	{
		key: 'picture', name: 'Picture', type: 'picTx',
		shapes: [
			...head(),
			ph('pic', 12, 'Picture', M, 176, CW, 400, { font: 'body', size: 16, color: C.muted, align: 'ctr', anchor: 'ctr' }, 'A diagram or screenshot', { fill: C.panel, line: C.line }),
			ph('body', 13, 'Caption', M, 592, CW, 40, { font: 'body', size: 15, color: C.muted }, 'Caption: what the picture shows'),
		],
	},
	{
		key: 'point', name: 'Key point', type: 'cust',
		shapes: [
			rect(M, 216, 64, 6, C.lime),
			ph('title', undefined, 'Statement', M, 244, 1040, 150, { ...TITLE, size: 40, lnSpc: 100 }, 'The one thing to remember'),
			ph('body', 10, 'Detail', M, 418, 900, 110, { font: 'body', size: 20, color: C.muted }, 'Why it matters, in a sentence or two'),
		],
	},
	{
		key: 'quiz', name: 'Quiz', type: 'cust',
		shapes: [
			ph('body', 10, 'Eyebrow', M, 44, CW, 24, EYEBROW, 'Check your understanding'),
			ph('title', undefined, 'Question', M, 76, CW, 96, { ...TITLE, size: 30 }, 'The question'),
			...['A', 'B', 'C', 'D'].flatMap((letter, i) => [
				panel(M, QUIZ_Y(i), CW, 94),
				rect(M + 24, QUIZ_Y(i) + 27, 40, 40, C.accentLow, C.lime),
				text(M + 24, QUIZ_Y(i) + 27, 40, 40, letter, { font: 'mono', size: 15, bold: true, color: C.lime, align: 'ctr', anchor: 'ctr' }),
				ph('body', 12 + i, `Answer ${letter}`, M + 88, QUIZ_Y(i), CW - 112, 94, { font: 'body', size: 20, color: C.text, anchor: 'ctr' }, 'An answer'),
			]),
		],
	},
	{
		key: 'summary', name: 'Summary', type: 'cust',
		shapes: [
			...head('Key takeaways'),
			ph('body', 1, 'Takeaways', M, 176, 680, 456, BODY, 'What learners should remember', { bullets: true }),
			panel(792, 176, W - M - 792, 232),
			text(820, 200, W - M - 848, 20, 'Up next', { ...EYEBROW, anchor: 't' }),
			ph('body', 12, 'Next lesson', 820, 232, W - M - 848, 90, { font: 'display', size: 24, bold: true, color: C.white, lnSpc: 95 }, 'Next lesson'),
			ph('body', 13, 'Next description', 820, 326, W - M - 848, 66, { font: 'body', size: 15, color: C.muted }, 'One line on what it covers'),
		],
	},
	{ key: 'titleOnly', name: 'Title only', type: 'titleOnly', shapes: [...head()] },
	{ key: 'blank', name: 'Blank', type: 'blank', shapes: [] },
];

// ---------------------------------------------------------------------------------------------
// The example slides: one per layout (Title only twice: a diagram and a table), each with notes.
// Placeholders are filled by name; `shapes` are drawn on top. A paragraph is a string, or an array
// of runs ({ t, color, bold }), or { lvl, runs } for a sub-point.

const host = (x, y, tag, name, addr, line = C.cardLine) => [
	rect(x, y, 220, 104, C.panel2, line),
	text(x + 18, y + 14, 184, 18, tag, { font: 'mono', size: 10, bold: true, color: C.faint, caps: true, spc: 100 }),
	text(x + 18, y + 36, 184, 30, name, { font: 'mono', size: 18, bold: true, color: C.text }),
	text(x + 18, y + 70, 184, 20, addr, { font: 'mono', size: 12, color: C.muted }),
];
const arrow = (x1, y, x2, color = C.faint) => ({ kind: 'arrow', x1, y1: y, x2, y2: y, color });

const cell = (t, style) => ({ t, style });
const TH = { font: 'body', size: 15, bold: true, color: C.white };
const TD = { font: 'body', size: 15, color: C.text };
const TDM = { font: 'mono', size: 15, bold: true, color: C.lime };

const SLIDES = [
	{
		layout: 'title',
		fill: { Course: 'Course name', Title: 'Lesson title', Subtitle: 'One sentence on what learners will be able to do by the end of the lesson.', Details: 'Lesson 1 · 20 minutes' },
		notes: 'Title slide. Type the course name, the lesson title, one line on what learners will be able to do, and the lesson number and length. Every slide in this deck is an example of one layout: keep the ones you need, delete the rest, and add more with Home → New Slide (or Layout to change a slide\'s layout). The fonts are Chakra Petch, Figtree and JetBrains Mono (templates/drawio/fonts/ in the repository): install them first, or PowerPoint uses others.',
	},
	{
		layout: 'section',
		fill: { Number: '01', Title: 'Section title', Description: 'A short line on what this part covers. Use a section slide where the lesson moves to a new topic, like the sections of a course.' },
		notes: 'Section slide: a number, a title and a line on what comes next. Use one at each change of topic, numbered like the course\'s sections.',
	},
	{
		layout: 'content',
		fill: {
			Eyebrow: 'Title and content',
			Title: 'One idea per slide',
			Content: [
				'Say the idea in the title; the points underneath back it up',
				'Three to five points, a line each',
				{ lvl: 1, runs: ['Press Tab for a sub-point like this one'] },
				'Put the detail in the speaker notes, not on the slide',
				'Write for defenders: how it works, what it looks like in the logs, how to stop it',
			],
		},
		notes: 'Title and content: the everyday slide. The small line above the title (the eyebrow) is for the lesson or topic; leave it empty if you don\'t need it, and it won\'t show. Write what you will say in these notes.',
	},
	{
		layout: 'two',
		fill: {
			Eyebrow: 'Two columns',
			Title: 'Compare two things side by side',
			'Heading 1': 'What it looks like',
			'Content 1': ['Many failed logins from one address', 'A second or two between attempts', 'Common user names tried in turn'],
			'Heading 2': 'How to spot it',
			'Content 2': ['Count failures per source (event 4625 on Windows)', 'Alert above a threshold, such as 10 a minute', 'Block the address, then check for a success'],
		},
		notes: 'Two columns: before and after, attack and defence, Windows and Linux. Keep both columns to the same number of points.',
	},
	{
		layout: 'cards',
		fill: {
			Eyebrow: 'Three cards',
			Title: 'Three parts of one idea',
			'Number 1': '01', 'Heading 1': 'Confidentiality', 'Text 1': 'Only the right people can read the data. Encryption and access control keep it that way.',
			'Number 2': '02', 'Heading 2': 'Integrity', 'Text 2': 'Nobody can change the data unnoticed. Hashes and signatures show when it has been.',
			'Number 3': '03', 'Heading 3': 'Availability', 'Text 3': 'The data is there when it\'s needed. Backups and spare capacity keep it there.',
		},
		notes: 'Three cards: three parts of one idea, three steps, or three options. Each card has a number, a heading and two or three short sentences.',
	},
	{
		layout: 'terminal',
		fill: {
			Eyebrow: 'Terminal',
			Title: 'Show a command and its output',
			'Window title': 'learner@codex: ~',
			Commands: [
				[{ t: '$ ', color: C.lime, bold: true }, { t: 'ss -tlnp' }],
				[{ t: 'State   Local Address:Port   Process', color: C.muted }],
				'LISTEN  0.0.0.0:22            sshd',
				'LISTEN  127.0.0.1:5432        postgres',
				[{ t: 'LISTEN  0.0.0.0:8080          python3', color: C.orange }],
				[{ t: '$ ', color: C.lime, bold: true }],
			],
			Explanation: ['Which programs are listening, and on which ports', '0.0.0.0 means every network; 127.0.0.1 only this computer', 'Highlight the line that matters: here, an unexpected web server'],
		},
		notes: 'Terminal: a command and its output, in JetBrains Mono. Colour the prompt lime and the line that matters orange or red (select the text, then the font colour). Paste commands with Paste as text only (Ctrl+Shift+V) so they keep the template\'s font. Keep it to a dozen lines; long output belongs in the lesson.',
	},
	{
		layout: 'titleOnly',
		fill: { Eyebrow: 'Title only', Title: 'Draw a diagram with shapes' },
		shapes: [
			...host(M, 236, 'WAN', 'Internet', '0.0.0.0/0'),
			arrow(M + 220, 288, M + 330),
			...host(M + 330, 236, 'Firewall', 'fw01', '192.0.2.1', C.lime),
			arrow(M + 550, 288, M + 660),
			...host(M + 660, 236, 'Web server', 'web01', '198.51.100.20'),
			text(M, 388, 1000, 40, 'Shapes you add start in the site\'s style: a panel with an outline, and lines with an arrow.', MUTED),
		],
		notes: 'Title only: a free area under the title for a diagram, a table or a picture. New shapes and lines start in the site\'s style; copy these cards to make your own. For a network, you can also use the draw.io templates (templates/drawio/) and insert the export with the Picture layout.',
	},
	{
		layout: 'titleOnly',
		fill: { Eyebrow: 'Table', Title: 'Put reference facts in a table' },
		shapes: [
			{
				kind: 'table', x: M, y: 192, colW: [140, 260, 720], rowH: 52,
				rows: [
					[cell('Port', TH), cell('Service', TH), cell('What to check', TH)],
					[cell('22', TDM), cell('SSH', TD), cell('Password logins off; only admins\' addresses allowed', TD)],
					[cell('53', TDM), cell('DNS', TD), cell('Answers only for your own networks', TD)],
					[cell('443', TDM), cell('HTTPS', TD), cell('A current certificate; TLS 1.2 or later', TD)],
					[cell('3389', TDM), cell('RDP', TD), cell('Never open to the internet; through a VPN instead', TD)],
				],
			},
		],
		notes: 'A table on the Title only layout. Tables you insert (Insert → Table) start in the site\'s style. Keep them to five or six rows; a longer table belongs in the lesson.',
	},
	{
		layout: 'picture',
		fill: { Eyebrow: 'Picture', Title: 'Show a diagram or a screenshot', Caption: 'Click the icon in the middle to add a picture. For a draw.io diagram, export it as PNG at 200% or as SVG.' },
		notes: 'Picture: a diagram or screenshot with a caption. Click the picture icon to add one; it is cropped to fill the space (Picture Format → Crop → Fit shows all of it instead). An empty picture box doesn\'t show when presenting.',
	},
	{
		layout: 'point',
		fill: { Statement: 'If you can\'t see it, you can\'t defend it.', Detail: 'Turn on logging first: every later step, from alerts to investigations, depends on it.' },
		notes: 'Key point: one sentence to remember, with a line on why. Use it sparingly, once or twice a lesson.',
	},
	{
		layout: 'quiz',
		fill: { Eyebrow: 'Check your understanding', Question: 'Which port does HTTPS use by default?', 'Answer A': '80', 'Answer B': '443', 'Answer C': '22', 'Answer D': '8443' },
		notes: 'Quiz: a question with four answers, like the quizzes in the lessons. The answer is B, 443. Ask the room, then reveal it: say it, or duplicate this slide and outline the right answer in lime.',
	},
	{
		layout: 'summary',
		fill: {
			Eyebrow: 'Key takeaways',
			Title: 'What to remember',
			Takeaways: ['One idea per slide, said in the title', 'Detail in the notes and the lesson, not on the slide', 'A quiz or key point to check it landed'],
			'Next lesson': 'Next lesson title',
			'Next description': 'One line on what it covers.',
		},
		notes: 'Summary: three or four takeaways, and the next lesson. End every lesson\'s deck with it.',
	},
];

// ---------------------------------------------------------------------------------------------
// PresentationML

const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const CT = 'application/vnd.openxmlformats-officedocument.presentationml';

const srgb = (c) => `<a:solidFill><a:srgbClr val="${c}"/></a:solidFill>`;
const xfrm = (s) => `<a:xfrm><a:off x="${emu(s.x)}" y="${emu(s.y)}"/><a:ext cx="${emu(s.w)}" cy="${emu(s.h)}"/></a:xfrm>`;
const ln = (color, px = 2) => (color ? `<a:ln w="${emu(px)}">${srgb(color)}</a:ln>` : '<a:ln><a:noFill/></a:ln>');

/** Run properties: tag is a:rPr, a:defRPr or a:endParaRPr. */
function rPr(tag, s = {}, run = {}) {
	const attrs = [tag === 'a:defRPr' ? '' : 'lang="en-GB"', s.size ? `sz="${s.size * 100}"` : '', run.bold ?? s.bold ? 'b="1"' : '', s.caps ? 'cap="all"' : '', s.spc ? `spc="${s.spc}"` : '', 'dirty="0"'].filter(Boolean);
	const color = run.color ?? s.color;
	const face = run.font ? FACE[run.font] : s.font ? FACE[s.font] : undefined;
	const inner = `${color ? srgb(color) : ''}${face ? `<a:latin typeface="${face}"/><a:cs typeface="${face}"/>` : ''}`;
	return inner ? `<${tag} ${attrs.join(' ')}>${inner}</${tag}>` : `<${tag} ${attrs.join(' ')}/>`;
}

// Bullets: a lime square, and a muted dash for sub-points.
const BULLETS = [
	{ char: '■', color: C.lime, size: 60, marL: 30 },
	{ char: '–', color: C.muted, size: 100, marL: 30 },
	{ char: '·', color: C.muted, size: 100, marL: 30 },
];

/** Paragraph properties for level `lvl` (0-based); tag is a:lvlNpPr or a:pPr. */
function pPr(tag, s = {}, { bullet, lvl = 0, defRPr = true, attrsOnly } = {}) {
	const b = bullet ? BULLETS[lvl] : undefined;
	const marL = b ? (lvl + 1) * b.marL : 0;
	const attrs = [`marL="${emu(marL)}"`, `indent="${emu(b ? -b.marL : 0)}"`, s.align ? `algn="${s.align}"` : 'algn="l"', attrsOnly].filter(Boolean).join(' ');
	const spcBef = s.spcBef ?? (bullet ? 10 : 0);
	const inner = [
		`<a:lnSpc><a:spcPct val="${(s.lnSpc ?? 105) * 1000}"/></a:lnSpc>`,
		`<a:spcBef><a:spcPts val="${spcBef * 100}"/></a:spcBef>`,
		'<a:spcAft><a:spcPts val="0"/></a:spcAft>',
		b ? `<a:buClr><a:srgbClr val="${b.color}"/></a:buClr><a:buSzPct val="${b.size * 1000}"/><a:buFont typeface="Arial"/><a:buChar char="${b.char}"/>` : '<a:buNone/>',
		defRPr ? rPr('a:defRPr', lvl ? { ...s, size: s.size ? s.size - 2 : undefined, color: s.color === C.text ? C.muted : s.color } : s) : '',
	].join('');
	return `<${tag} ${attrs}>${inner}</${tag}>`;
}

const bodyPr = (s = {}, autofit = true) => `<a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="${s.anchor ?? 't'}" rtlCol="0">${autofit ? '<a:normAutofit/>' : '<a:noAutofit/>'}</a:bodyPr>`;

/** A paragraph's runs, as a list of { t, color, bold, field }. */
function runsOf(para) {
	if (typeof para === 'string') return [{ t: para }];
	if (Array.isArray(para)) return para.map((r) => (typeof r === 'string' ? { t: r } : r));
	return runsOf(para.runs);
}
const levelOf = (para) => (para && !Array.isArray(para) && typeof para === 'object' ? para.lvl : 0);

function runXml(r, s) {
	if (r.field === 'slidenum') return `<a:fld id="{B6F15528-21DE-4FAA-801E-634DDDAF4B2B}" type="slidenum">${rPr('a:rPr', s)}<a:t>‹#›</a:t></a:fld>`;
	const keep = /^\s|\s$/.test(r.t) ? ' xml:space="preserve"' : '';
	return `<a:r>${rPr('a:rPr', s, r)}<a:t${keep}>${esc(r.t)}</a:t></a:r>`;
}

/** Paragraphs of a text box (full formatting) or of a placeholder (s = {}: inherit it). */
function parasXml(paras, s, { box } = {}) {
	return paras
		.map((para) => {
			const lvl = levelOf(para);
			const props = box ? pPr('a:pPr', s, { defRPr: false }) : lvl ? `<a:pPr lvl="${lvl}"/>` : '';
			return `<a:p>${props}${runsOf(para).map((r) => runXml(r, box ? s : {})).join('')}${rPr('a:endParaRPr', box ? s : {})}</a:p>`;
		})
		.join('');
}

let nextId;
function shapeXml(shape, { inLayout } = {}) {
	const id = nextId++;
	const name = esc(shape.name ?? `${shape.kind} ${id}`);
	if (shape.kind === 'rect' || shape.kind === 'ellipse') {
		return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr/><p:nvPr userDrawn="${inLayout ? 1 : 0}"/></p:nvSpPr><p:spPr>${xfrm(shape)}<a:prstGeom prst="${shape.kind}"><a:avLst/></a:prstGeom>${shape.fill ? srgb(shape.fill) : '<a:noFill/>'}${ln(shape.line, shape.lineW)}</p:spPr><p:txBody><a:bodyPr rtlCol="0" anchor="ctr"/><a:lstStyle/><a:p><a:endParaRPr lang="en-GB" dirty="0"/></a:p></p:txBody></p:sp>`.replace(' userDrawn="0"', '');
	}
	if (shape.kind === 'text') {
		return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr txBox="1"/><p:nvPr${inLayout ? ' userDrawn="1"' : ''}/></p:nvSpPr><p:spPr>${xfrm(shape)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody>${bodyPr(shape.style, false)}<a:lstStyle/>${parasXml(shape.paras, shape.style, { box: true })}</p:txBody></p:sp>`;
	}
	if (shape.kind === 'arrow') {
		const flip = shape.x2 < shape.x1 ? ' flipH="1"' : '';
		const box = { x: Math.min(shape.x1, shape.x2), y: Math.min(shape.y1, shape.y2), w: Math.abs(shape.x2 - shape.x1), h: Math.abs(shape.y2 - shape.y1) };
		return `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${id}" name="Arrow ${id}"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr><p:spPr><a:xfrm${flip}><a:off x="${emu(box.x)}" y="${emu(box.y)}"/><a:ext cx="${emu(box.w)}" cy="${emu(box.h)}"/></a:xfrm><a:prstGeom prst="straightConnector1"><a:avLst/></a:prstGeom><a:ln w="${emu(2)}">${srgb(shape.color)}<a:tailEnd type="triangle" w="lg" len="lg"/></a:ln></p:spPr></p:cxnSp>`;
	}
	if (shape.kind === 'table') return tableXml(shape, id);
	throw new Error(`unknown shape ${shape.kind}`);
}

function tableXml(t, id) {
	const w = t.colW.reduce((a, b) => a + b, 0);
	const border = (side) => `<a:${side} w="${emu(1.5)}">${srgb(C.line)}</a:${side}>`;
	const rows = t.rows
		.map((row, r) => `<a:tr h="${emu(t.rowH)}">${row
			.map((c) => `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/>${parasXml([c.t], c.style, { box: true })}</a:txBody><a:tcPr marL="${emu(16)}" marR="${emu(16)}" marT="${emu(8)}" marB="${emu(8)}" anchor="ctr">${['lnL', 'lnR', 'lnT', 'lnB'].map(border).join('')}${srgb(r ? C.panel : C.panel2)}</a:tcPr></a:tc>`)
			.join('')}</a:tr>`)
		.join('');
	return `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id}" name="Table ${id}"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="${emu(t.x)}" y="${emu(t.y)}"/><a:ext cx="${emu(w)}" cy="${emu(t.rowH * t.rows.length)}"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr firstRow="1"><a:tableStyleId>${TABLE_STYLE}</a:tableStyleId></a:tblPr><a:tblGrid>${t.colW.map((cw) => `<a:gridCol w="${emu(cw)}"/>`).join('')}</a:tblGrid>${rows}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
}

const phAttrs = (shape) => `type="${shape.ph}"${shape.idx !== undefined ? ` idx="${shape.idx}"` : ''}${shape.ph === 'body' && shape.idx !== 1 ? ' sz="quarter"' : ''}`;

/** A placeholder as the layout defines it: position, style and prompt text. */
function layoutPhXml(shape) {
	const id = nextId++;
	const s = shape.style;
	const levels = shape.bullets ? [0, 1, 2].map((lvl) => pPr(`a:lvl${lvl + 1}pPr`, s, { bullet: true, lvl })).join('') : pPr('a:lvl1pPr', s);
	const fill = shape.fill ? srgb(shape.fill) : '';
	const line = shape.line ? ln(shape.line) : '';
	return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${esc(shape.name)}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph ${phAttrs(shape)}/></p:nvPr></p:nvSpPr><p:spPr>${xfrm(shape)}${fill || line ? `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${fill}${line}` : ''}</p:spPr><p:txBody>${bodyPr(s)}<a:lstStyle>${levels}</a:lstStyle><a:p><a:r><a:rPr lang="en-GB" dirty="0"/><a:t>${esc(shape.prompt)}</a:t></a:r></a:p></p:txBody></p:sp>`;
}

/** A placeholder on a slide: it takes everything but its text from the layout. */
function slidePhXml(shape, paras) {
	const id = nextId++;
	return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${esc(shape.name)}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph ${phAttrs(shape)}/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>${parasXml([].concat(paras), {})}</p:txBody></p:sp>`;
}

const TREE_START = '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';

function masterXml() {
	nextId = 2;
	const title = layoutPhXml(ph('title', undefined, 'Title', M, 76, CW, 80, TITLE, 'Slide title'));
	const body = layoutPhXml(ph('body', 1, 'Content', M, 176, CW, 456, BODY, 'Points', { bullets: true }));
	const deco = footer().map((s) => shapeXml(s)).join('');
	const levels = (s, bullet) => [0, 1, 2].map((lvl) => pPr(`a:lvl${lvl + 1}pPr`, s, { bullet, lvl })).join('');
	const clrMap = 'bg1="dk1" tx1="lt1" bg2="dk2" tx2="lt2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"';
	return `${XML}<p:sldMaster ${NS}><p:cSld><p:bg><p:bgPr><a:solidFill><a:schemeClr val="bg1"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>${TREE_START}${title}${body}${deco}</p:spTree></p:cSld><p:clrMap ${clrMap}/><p:sldLayoutIdLst>${LAYOUTS.map((_, i) => `<p:sldLayoutId id="${2147483649 + i}" r:id="rId${i + 1}"/>`).join('')}</p:sldLayoutIdLst><p:txStyles><p:titleStyle>${pPr('a:lvl1pPr', TITLE)}</p:titleStyle><p:bodyStyle>${levels(BODY, true)}</p:bodyStyle><p:otherStyle>${levels({ font: 'body', size: 18 }, false).replace(/<a:solidFill>.*?<\/a:solidFill>/g, '')}</p:otherStyle></p:txStyles></p:sldMaster>`;
}

function layoutXml(layout) {
	nextId = 2;
	const shapes = layout.shapes.map((s) => (s.kind === 'ph' ? layoutPhXml(s) : shapeXml(s, { inLayout: true }))).join('');
	const show = layout.master === false ? ' showMasterSp="0"' : '';
	return `${XML}<p:sldLayout ${NS} type="${layout.type}" preserve="1"${show}><p:cSld name="${esc(layout.name)}"><p:spTree>${TREE_START}${shapes}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;
}

function slideXml(slide) {
	nextId = 2;
	const layout = LAYOUTS.find((l) => l.key === slide.layout);
	const phs = layout.shapes.filter((s) => s.kind === 'ph');
	for (const name of Object.keys(slide.fill)) if (!phs.some((s) => s.name === name)) throw new Error(`slide on ${layout.name}: no placeholder "${name}"`);
	const filled = phs.filter((s) => slide.fill[s.name] !== undefined).map((s) => slidePhXml(s, slide.fill[s.name])).join('');
	const own = (slide.shapes ?? []).map((s) => shapeXml(s)).join('');
	return `${XML}<p:sld ${NS}><p:cSld><p:spTree>${TREE_START}${filled}${own}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}

function notesSlideXml(slide) {
	return `${XML}<p:notes ${NS}><p:cSld><p:spTree>${TREE_START}<p:sp><p:nvSpPr><p:cNvPr id="2" name="Slide image"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>${parasXml([slide.notes], {})}</p:txBody></p:sp></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>`;
}

function notesMasterXml() {
	const sp = (id, name, type, x, y, w, h, body = '') => `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr><a:spLocks noGrp="1"${type === 'sldImg' ? ' noRot="1" noChangeAspect="1"' : ''}/></p:cNvSpPr><p:nvPr><p:ph type="${type}"${type === 'body' ? ' idx="1" sz="quarter"' : ''}/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${type === 'sldImg' ? '<a:noFill/><a:ln w="12700"><a:solidFill><a:prstClr val="black"/></a:solidFill></a:ln>' : ''}</p:spPr>${body}</p:sp>`;
	const notesBody = '<p:txBody><a:bodyPr vert="horz" lIns="91440" tIns="45720" rIns="91440" bIns="45720" rtlCol="0"/><a:lstStyle/><a:p><a:pPr lvl="0"/><a:r><a:rPr lang="en-GB"/><a:t>Speaker notes</a:t></a:r></a:p></p:txBody>';
	const level = (n) => `<a:lvl${n}pPr marL="${(n - 1) * 457200}" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:defRPr sz="1200" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl${n}pPr>`;
	return `${XML}<p:notesMaster ${NS}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree>${TREE_START}${sp(2, 'Slide image', 'sldImg', 381000, 685800, 6096000, 3429000)}${sp(3, 'Notes', 'body', 685800, 4343400, 5486400, 4114800, notesBody)}</p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:notesStyle>${[1, 2, 3].map(level).join('')}</p:notesStyle></p:notesMaster>`;
}

function themeXml(name, colours) {
	const clr = Object.entries(colours).map(([k, v]) => `<a:${k}><a:srgbClr val="${v}"/></a:${k}>`).join('');
	const font = (face) => `<a:latin typeface="${face}"/><a:ea typeface=""/><a:cs typeface=""/>`;
	const solid = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>';
	// New shapes: a panel with the site's outline; new lines: muted, with an arrow; new text boxes: the body text.
	const objectDefaults = `<a:objectDefaults><a:spDef><a:spPr><a:solidFill><a:schemeClr val="bg2"/></a:solidFill><a:ln w="${emu(2)}"><a:solidFill><a:srgbClr val="${C.line}"/></a:solidFill></a:ln></a:spPr><a:bodyPr rtlCol="0" anchor="ctr"/><a:lstStyle><a:defPPr algn="ctr"><a:defRPr><a:solidFill><a:schemeClr val="tx1"/></a:solidFill></a:defRPr></a:defPPr></a:lstStyle></a:spDef><a:lnDef><a:spPr><a:ln w="${emu(2)}"><a:solidFill><a:srgbClr val="${C.faint}"/></a:solidFill><a:tailEnd type="triangle"/></a:ln></a:spPr><a:bodyPr/><a:lstStyle/></a:lnDef><a:txDef><a:spPr><a:noFill/></a:spPr><a:bodyPr wrap="square" rtlCol="0"><a:spAutoFit/></a:bodyPr><a:lstStyle><a:defPPr><a:defRPr><a:solidFill><a:srgbClr val="${C.text}"/></a:solidFill></a:defRPr></a:defPPr></a:lstStyle></a:txDef></a:objectDefaults>`;
	return `${XML}<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="${name}"><a:themeElements><a:clrScheme name="Codex">${clr}</a:clrScheme><a:fontScheme name="Codex"><a:majorFont>${font(FONT.display)}</a:majorFont><a:minorFont>${font(FONT.body)}</a:minorFont></a:fontScheme><a:fmtScheme name="Codex"><a:fillStyleLst>${solid.repeat(3)}</a:fillStyleLst><a:lnStyleLst>${[12700, 19050, 25400].map((w) => `<a:ln w="${w}">${solid}</a:ln>`).join('')}</a:lnStyleLst><a:effectStyleLst>${'<a:effectStyle><a:effectLst/></a:effectStyle>'.repeat(3)}</a:effectStyleLst><a:bgFillStyleLst>${solid.repeat(3)}</a:bgFillStyleLst></a:fmtScheme></a:themeElements>${objectDefaults}<a:extraClrSchemeLst/></a:theme>`;
}

// Tables inserted in PowerPoint: panels with the site's outlines, the header row a shade lighter.
function tableStylesXml() {
	const border = (side) => `<a:${side}><a:ln w="${emu(1.5)}"><a:solidFill><a:srgbClr val="${C.line}"/></a:solidFill></a:ln></a:${side}>`;
	const txt = (color, bold) => `<a:tcTxStyle${bold ? ' b="on"' : ''}><a:fontRef idx="minor"><a:prstClr val="white"/></a:fontRef><a:srgbClr val="${color}"/></a:tcTxStyle>`;
	return `${XML}<a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="${TABLE_STYLE}"><a:tblStyle styleId="${TABLE_STYLE}" styleName="Codex"><a:wholeTbl>${txt(C.text)}<a:tcStyle><a:tcBdr>${['left', 'right', 'top', 'bottom', 'insideH', 'insideV'].map(border).join('')}</a:tcBdr><a:fill>${srgb(C.panel)}</a:fill></a:tcStyle></a:wholeTbl><a:firstRow>${txt(C.white, true)}<a:tcStyle><a:tcBdr/><a:fill>${srgb(C.panel2)}</a:fill></a:tcStyle></a:firstRow></a:tblStyle></a:tblStyleLst>`;
}

function presentationXml() {
	const level = (n) => `<a:lvl${n}pPr marL="${(n - 1) * 457200}" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:defRPr sz="1800" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl${n}pPr>`;
	const slides = SLIDES.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${4 + i}"/>`).join('');
	return `${XML}<p:presentation ${NS} saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:notesMasterIdLst><p:notesMasterId r:id="rId2"/></p:notesMasterIdLst><p:sldIdLst>${slides}</p:sldIdLst><p:sldSz cx="${emu(W)}" cy="${emu(H)}"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle><a:defPPr><a:defRPr lang="en-GB"/></a:defPPr>${[1, 2, 3].map(level).join('')}</p:defaultTextStyle></p:presentation>`;
}

const rels = (list) => `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${list.map(([id, type, target]) => `<Relationship Id="${id}" Type="${type.startsWith('http') ? type : `${REL}/${type}`}" Target="${target}"/>`).join('')}</Relationships>`;

/** Every part of the package, as [path, content]. */
function parts({ template }) {
	const n = SLIDES.length;
	const out = [];
	const overrides = [
		['/ppt/presentation.xml', `${CT}.${template ? 'template' : 'presentation'}.main+xml`],
		['/ppt/slideMasters/slideMaster1.xml', `${CT}.slideMaster+xml`],
		['/ppt/notesMasters/notesMaster1.xml', `${CT}.notesMaster+xml`],
		['/ppt/theme/theme1.xml', 'application/vnd.openxmlformats-officedocument.theme+xml'],
		['/ppt/theme/theme2.xml', 'application/vnd.openxmlformats-officedocument.theme+xml'],
		['/ppt/presProps.xml', `${CT}.presProps+xml`],
		['/ppt/viewProps.xml', `${CT}.viewProps+xml`],
		['/ppt/tableStyles.xml', `${CT}.tableStyles+xml`],
		['/docProps/core.xml', 'application/vnd.openxmlformats-package.core-properties+xml'],
		['/docProps/app.xml', 'application/vnd.openxmlformats-officedocument.extended-properties+xml'],
		...LAYOUTS.map((_, i) => [`/ppt/slideLayouts/slideLayout${i + 1}.xml`, `${CT}.slideLayout+xml`]),
		...SLIDES.flatMap((_, i) => [[`/ppt/slides/slide${i + 1}.xml`, `${CT}.slide+xml`], [`/ppt/notesSlides/notesSlide${i + 1}.xml`, `${CT}.notesSlide+xml`]]),
	];
	out.push(['[Content_Types].xml', `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${overrides.map(([p, t]) => `<Override PartName="${p}" ContentType="${t}"/>`).join('')}</Types>`]);
	out.push(['_rels/.rels', rels([['rId1', 'officeDocument', 'ppt/presentation.xml'], ['rId2', 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties', 'docProps/core.xml'], ['rId3', 'extended-properties', 'docProps/app.xml']])]);
	out.push(['docProps/core.xml', `${XML}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Codex course slides</dc:title><dc:creator>Codex</dc:creator></cp:coreProperties>`]);
	out.push(['docProps/app.xml', `${XML}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><PresentationFormat>Widescreen</PresentationFormat><Slides>${n}</Slides><Notes>${n}</Notes></Properties>`]);
	out.push(['ppt/presentation.xml', presentationXml()]);
	out.push(['ppt/_rels/presentation.xml.rels', rels([
		['rId1', 'slideMaster', 'slideMasters/slideMaster1.xml'], ['rId2', 'notesMaster', 'notesMasters/notesMaster1.xml'], ['rId3', 'theme', 'theme/theme1.xml'],
		...SLIDES.map((_, i) => [`rId${4 + i}`, 'slide', `slides/slide${i + 1}.xml`]),
		[`rId${4 + n}`, 'presProps', 'presProps.xml'], [`rId${5 + n}`, 'viewProps', 'viewProps.xml'], [`rId${6 + n}`, 'tableStyles', 'tableStyles.xml'],
	])]);
	out.push(['ppt/presProps.xml', `${XML}<p:presentationPr ${NS}/>`]);
	out.push(['ppt/viewProps.xml', `${XML}<p:viewPr ${NS}><p:normalViewPr><p:restoredLeft sz="15620"/><p:restoredTop sz="94660"/></p:normalViewPr><p:gridSpacing cx="76200" cy="76200"/></p:viewPr>`]);
	out.push(['ppt/tableStyles.xml', tableStylesXml()]);
	out.push(['ppt/theme/theme1.xml', themeXml('Codex', THEME_COLOURS)]);
	// The notes pages are printed: dark text on white, in the same fonts.
	out.push(['ppt/theme/theme2.xml', themeXml('Codex notes', { ...THEME_COLOURS, dk1: '000000', lt1: 'FFFFFF', dk2: C.panel, lt2: 'E7E6E6' })]);
	out.push(['ppt/slideMasters/slideMaster1.xml', masterXml()]);
	out.push(['ppt/slideMasters/_rels/slideMaster1.xml.rels', rels([...LAYOUTS.map((_, i) => [`rId${i + 1}`, 'slideLayout', `../slideLayouts/slideLayout${i + 1}.xml`]), [`rId${LAYOUTS.length + 1}`, 'theme', '../theme/theme1.xml']])]);
	LAYOUTS.forEach((layout, i) => {
		out.push([`ppt/slideLayouts/slideLayout${i + 1}.xml`, layoutXml(layout)]);
		out.push([`ppt/slideLayouts/_rels/slideLayout${i + 1}.xml.rels`, rels([['rId1', 'slideMaster', '../slideMasters/slideMaster1.xml']])]);
	});
	out.push(['ppt/notesMasters/notesMaster1.xml', notesMasterXml()]);
	out.push(['ppt/notesMasters/_rels/notesMaster1.xml.rels', rels([['rId1', 'theme', '../theme/theme2.xml']])]);
	SLIDES.forEach((slide, i) => {
		const layout = LAYOUTS.findIndex((l) => l.key === slide.layout) + 1;
		out.push([`ppt/slides/slide${i + 1}.xml`, slideXml(slide)]);
		out.push([`ppt/slides/_rels/slide${i + 1}.xml.rels`, rels([['rId1', 'slideLayout', `../slideLayouts/slideLayout${layout}.xml`], ['rId2', 'notesSlide', `../notesSlides/notesSlide${i + 1}.xml`]])]);
		out.push([`ppt/notesSlides/notesSlide${i + 1}.xml`, notesSlideXml(slide)]);
		out.push([`ppt/notesSlides/_rels/notesSlide${i + 1}.xml.rels`, rels([['rId1', 'notesMaster', '../notesMasters/notesMaster1.xml'], ['rId2', 'slide', `../slides/slide${i + 1}.xml`]])]);
	});
	return out;
}

// ---------------------------------------------------------------------------------------------
// Zip, with fixed dates so the output is the same each time.

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	return c >>> 0;
});
const crc32 = (buf) => {
	let c = 0xffffffff;
	for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
};

export function zip(files) {
	const chunks = [];
	const central = [];
	let offset = 0;
	for (const [name, content] of files) {
		const data = Buffer.from(content);
		const packed = deflateRawSync(data, { level: 9 });
		const fileName = Buffer.from(name);
		const fields = (sig, extra) => {
			const head = Buffer.alloc(extra ? 46 : 30);
			head.writeUInt32LE(sig, 0);
			let p = 4;
			if (extra) head.writeUInt16LE(20, p), (p += 2); // version made by
			head.writeUInt16LE(20, p); // version needed
			head.writeUInt16LE(0, p + 2); // flags
			head.writeUInt16LE(8, p + 4); // deflate
			head.writeUInt16LE(0, p + 6); // time
			head.writeUInt16LE(0x21, p + 8); // 1980-01-01
			head.writeUInt32LE(crc32(data), p + 10);
			head.writeUInt32LE(packed.length, p + 14);
			head.writeUInt32LE(data.length, p + 18);
			head.writeUInt16LE(fileName.length, p + 22);
			if (extra) head.writeUInt32LE(offset, 42);
			return head;
		};
		const local = Buffer.concat([fields(0x04034b50), fileName, packed]);
		central.push(Buffer.concat([fields(0x02014b50, true), fileName]));
		chunks.push(local);
		offset += local.length;
	}
	const dir = Buffer.concat(central);
	const end = Buffer.alloc(22);
	end.writeUInt32LE(0x06054b50, 0);
	end.writeUInt16LE(files.length, 8);
	end.writeUInt16LE(files.length, 10);
	end.writeUInt32LE(dir.length, 12);
	end.writeUInt32LE(offset, 16);
	return Buffer.concat([...chunks, dir, end]);
}

/** The template (.potx) and the deck (.pptx), as file name → bytes. */
export function build() {
	return { 'codex-slides.potx': zip(parts({ template: true })), 'codex-slides.pptx': zip(parts({ template: false })) };
}

// ---------------------------------------------------------------------------------------------
// Previews (SVG) and the text-fit estimate.

const PX_PER_PT = 96 / 72;
const CHAR_EM = { display: 0.58, body: 0.5, mono: 0.6 };

/** The lines a paragraph wraps to in a box `w` wide (an estimate from average letter widths). */
function wrap(textValue, s, w) {
	const charW = (s.size ?? 18) * PX_PER_PT * CHAR_EM[s.font ?? 'body'] * (s.caps ? 1.1 : 1) + (s.spc ?? 0) / 100 * PX_PER_PT;
	const perLine = Math.max(1, Math.floor(w / charW));
	const lines = [];
	let line = '';
	for (const word of textValue.split(' ')) {
		const next = line ? `${line} ${word}` : word;
		if (next.length > perLine && line) {
			lines.push(line);
			line = word;
		} else line = next;
	}
	lines.push(line);
	return lines;
}

const svgColor = (c) => (c ? `#${c}` : 'none');
const SVG_FONT = { display: "'Chakra Petch', sans-serif", body: "'Figtree', sans-serif", mono: "'JetBrains Mono', monospace" };

/** Text in a box as SVG; returns { svg, overflow }. */
function textSvg(box, paras, s, { bullets } = {}) {
	const out = [];
	let y = 0;
	const blocks = paras.map((para) => {
		const lvl = levelOf(para);
		const st = lvl ? { ...s, size: s.size - 2, color: s.color === C.text ? C.muted : s.color } : s;
		const indent = bullets ? (lvl + 1) * 30 : 0;
		const runs = runsOf(para);
		const plain = runs.map((r) => (r.field ? '12' : r.t)).join('');
		const lines = wrap(s.caps ? plain.toUpperCase() : plain, st, box.w - indent);
		const lh = st.size * PX_PER_PT * 1.2 * ((st.lnSpc ?? 105) / 100);
		const before = y === 0 ? 0 : (st.spcBef ?? (bullets ? 10 : 0)) * PX_PER_PT;
		return { lvl, st, indent, runs, lines, lh, before };
	});
	const total = blocks.reduce((sum, b) => sum + b.before + b.lines.length * b.lh, 0);
	y = s.anchor === 'b' ? box.h - total : s.anchor === 'ctr' ? (box.h - total) / 2 : 0;
	for (const b of blocks) {
		y += b.before;
		const anchorX = s.align === 'ctr' ? box.x + box.w / 2 : s.align === 'r' ? box.x + box.w : box.x + b.indent;
		const textAnchor = s.align === 'ctr' ? 'middle' : s.align === 'r' ? 'end' : 'start';
		if (bullets) {
			const bu = BULLETS[b.lvl];
			out.push(`<text x="${box.x + b.indent - bu.marL}" y="${box.y + y + b.lh * 0.78}" font-family="Arial" font-size="${b.st.size * PX_PER_PT * bu.size / 100}" fill="#${bu.color}">${esc(bu.char)}</text>`);
		}
		b.lines.forEach((lineText, i) => {
			const single = b.lines.length === 1 && b.runs.length > 1;
			const content = single ? b.runs.map((r) => `<tspan fill="${svgColor(r.color ?? b.st.color)}"${r.bold ?? b.st.bold ? ' font-weight="700"' : ''}>${esc(r.field ? '12' : r.t)}</tspan>`).join('') : esc(lineText);
			const color = b.runs.length === 1 ? b.runs[0].color ?? b.st.color : b.st.color;
			out.push(`<text x="${anchorX}" y="${box.y + y + b.lh * (i + 0.78)}" text-anchor="${textAnchor}" font-family="${SVG_FONT[b.st.font ?? 'body']}" font-size="${b.st.size * PX_PER_PT}"${b.st.bold ? ' font-weight="700"' : ''}${b.st.spc ? ` letter-spacing="${(b.st.spc / 100) * PX_PER_PT}"` : ''} fill="${svgColor(color)}" xml:space="preserve">${content}</text>`);
		});
		y += b.lines.length * b.lh;
	}
	return { svg: out.join(''), overflow: total > box.h + 1 ? total : 0 };
}

function shapeSvg(shape) {
	if (shape.kind === 'rect') return `<rect x="${shape.x}" y="${shape.y}" width="${shape.w}" height="${shape.h}" fill="${svgColor(shape.fill)}"${shape.line ? ` stroke="#${shape.line}" stroke-width="${shape.lineW}"` : ''}/>`;
	if (shape.kind === 'ellipse') return `<ellipse cx="${shape.x + shape.w / 2}" cy="${shape.y + shape.h / 2}" rx="${shape.w / 2}" ry="${shape.h / 2}" fill="${svgColor(shape.fill)}"/>`;
	if (shape.kind === 'text') return textSvg(shape, shape.paras, shape.style).svg;
	if (shape.kind === 'arrow') return `<line x1="${shape.x1}" y1="${shape.y1}" x2="${shape.x2 - 8}" y2="${shape.y2}" stroke="#${shape.color}" stroke-width="2"/><path d="M${shape.x2},${shape.y2} l-10,-5 v10 z" fill="#${shape.color}"/>`;
	if (shape.kind === 'table') {
		let y = shape.y;
		return shape.rows
			.map((row, r) => {
				let x = shape.x;
				const cells = row.map((c, i) => {
					const w = shape.colW[i];
					const svg = `<rect x="${x}" y="${y}" width="${w}" height="${shape.rowH}" fill="#${r ? C.panel : C.panel2}" stroke="#${C.line}" stroke-width="1.5"/>${textSvg({ x: x + 16, y: y + 8, w: w - 32, h: shape.rowH - 16 }, [c.t], { ...c.style, anchor: 'ctr' }).svg}`;
					x += w;
					return svg;
				});
				y += shape.rowH;
				return cells.join('');
			})
			.join('');
	}
	return '';
}

/** A slide (or, with no slide, a layout with its prompts) as SVG; `problems` collects overflows. */
function slideSvg(layout, slide, problems) {
	const parts = [`<rect width="${W}" height="${H}" fill="#${C.bg}"/>`];
	if (layout.master !== false) parts.push(...footer().map(shapeSvg));
	for (const shape of layout.shapes) {
		if (shape.kind !== 'ph') {
			parts.push(shapeSvg(shape));
			continue;
		}
		const value = slide ? slide.fill[shape.name] : shape.prompt;
		if (shape.fill || shape.line) parts.push(shapeSvg({ ...shape, kind: 'rect', lineW: 2 }));
		if (value === undefined) continue;
		if (!slide) parts.push(`<rect x="${shape.x}" y="${shape.y}" width="${shape.w}" height="${shape.h}" fill="none" stroke="#${C.cardLine}" stroke-dasharray="4 4"/>`);
		const { svg, overflow } = textSvg(shape, [].concat(value), shape.style, { bullets: shape.bullets });
		parts.push(svg);
		if (overflow && slide) problems.push(`${layout.name} → ${shape.name}: about ${Math.round(overflow)}px of text in a ${shape.h}px box`);
	}
	if (slide) parts.push(...(slide.shapes ?? []).map(shapeSvg));
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${parts.join('')}</svg>\n`;
}

// ---------------------------------------------------------------------------------------------

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	const [OUT = new URL('.', import.meta.url).pathname, PREVIEWS] = process.argv.slice(2);
	mkdirSync(OUT, { recursive: true });
	for (const [name, bytes] of Object.entries(build())) writeFileSync(`${OUT}/${name}`, bytes);
	if (PREVIEWS) {
		mkdirSync(PREVIEWS, { recursive: true });
		const problems = [];
		SLIDES.forEach((slide, i) => writeFileSync(`${PREVIEWS}/slide-${String(i + 1).padStart(2, '0')}.svg`, slideSvg(LAYOUTS.find((l) => l.key === slide.layout), slide, problems)));
		LAYOUTS.forEach((layout, i) => writeFileSync(`${PREVIEWS}/layout-${String(i + 1).padStart(2, '0')}-${layout.key}.svg`, slideSvg(layout, null, problems)));
		for (const problem of problems) console.warn(`text may not fit: ${problem}`);
	}
}
