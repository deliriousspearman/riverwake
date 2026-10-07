// The site's custom code blocks. Each block's YAML body is validated at build time (invalid
// blocks fail the build) and rendered to hast with scripts/hast-text.mjs;
// plugins/remark-lms-blocks.mjs puts that hast into the page. The browser side is in src/client/.
//
//   ```quiz        knowledge check: title?, questions[{ question, options, explanation? }]
//   ```exercise    hands-on task: title, task, hints?, solution?, solutionCode?
//   ```asciinema   terminal recording: src (a .cast under static/), title?, player options
//   ```timeline    events in order: title?, layout? (vertical | horizontal | snake), style? (plain | cards),
//                  events[{ date, title, text? }]
//   ```attachment  downloads where the block is: one entry or a list of { file, title, description?,
//                  overview? }, the fields of `attachments` in frontmatter (scripts/attachments.mjs).
//                  `overview: true` also lists the file on the course overview (scripts/content.mjs
//                  finds the blocks in a page, plugins/lms-content.mjs publishes them).
//
// Text fields support `code`, **bold**, *italic* and [links](https://…), as text nodes only.
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { attachmentInfo, attachmentProblems, extensionOf } from './attachments.mjs';
import { STATIC_DIR } from './content.mjs';
import { parse } from 'yaml';
import { blocks, el, failer, inline, readYamlBlock, text, unknownFields } from './hast-text.mjs';

// ---------------------------------------------------------------------------------------------
// ```quiz

const QUESTION_FIELDS = ['question', 'options', 'explanation'];
const OPTION_FIELDS = ['text', 'correct'];

export function readQuiz(codeBlock) {
	const { config, fail } = readYamlBlock('quiz', codeBlock, ['title', 'questions']);
	const { title = 'Knowledge check', questions } = config;
	if (typeof title !== 'string') fail('`title` must be text');
	if (!Array.isArray(questions) || !questions.length) fail('`questions` must be a list with at least one question');

	return {
		title,
		questions: questions.map((q, i) => {
			const at = `question ${i + 1}`;
			if (typeof q?.question !== 'string') fail(`${at}: \`question\` must be text`);
			if (q.explanation !== undefined && typeof q.explanation !== 'string') fail(`${at}: \`explanation\` must be text`);
			const unknown = unknownFields(q, QUESTION_FIELDS);
			if (unknown) fail(`${at}: ${unknown}`);
			if (!Array.isArray(q.options) || q.options.length < 2) fail(`${at}: needs at least two \`options\``);
			const options = q.options.map((o, j) => {
				if (typeof o === 'string') return { text: o, correct: false };
				const where = `${at}, option ${j + 1}`;
				if (typeof o?.text !== 'string') fail(`${where}: must be text, or { text, correct }`);
				// A misspelled `correct` would otherwise just make the option wrong, e.g. turn a
				// "select all that apply" question into a single-answer one.
				const unknownOption = unknownFields(o, OPTION_FIELDS);
				if (unknownOption) fail(`${where}: ${unknownOption}`);
				if (o.correct !== undefined && typeof o.correct !== 'boolean') fail(`${where}: \`correct\` must be true or false`);
				return { text: o.text, correct: o.correct === true };
			});
			if (!options.some((o) => o.correct)) fail(`${at}: mark at least one option with \`correct: true\``);
			return { question: q.question, explanation: q.explanation, options };
		}),
	};
}

/** `id` keeps two identical quizzes on one page from sharing radio groups (see quizId). */
export function renderQuiz(quiz, id) {
	return el('figure', { className: ['lms-quiz', 'not-content'], dataQuiz: '' }, [
		el('figcaption', { className: ['lms-quiz-title'] }, [text(quiz.title)]),
		el(
			'ol',
			{ className: ['lms-quiz-questions'] },
			quiz.questions.map((q, i) => {
				const multiple = q.options.filter((o) => o.correct).length > 1;
				const name = `quiz-${id}-${i}`;
				return el('li', { className: ['lms-quiz-question'], dataQuestion: questionId(q) }, [
					el('fieldset', {}, [
						el('legend', {}, inline(q.question)),
						...(multiple ? [el('p', { className: ['lms-quiz-note'] }, [text('Select all that apply.')])] : []),
						...q.options.map((o, j) =>
							el('label', { className: ['lms-quiz-option'] }, [
								el('input', {
									type: multiple ? 'checkbox' : 'radio',
									name,
									value: String(j),
									...(o.correct ? { dataCorrect: '' } : {}),
								}),
								el('span', {}, inline(o.text)),
							]),
						),
					]),
					el('div', { className: ['lms-quiz-actions'] }, [
						el('button', { type: 'button', className: ['lms-quiz-check'], dataQuizCheck: '', disabled: true }, [
							text('Check answer'),
						]),
					]),
					el('div', { className: ['lms-quiz-feedback'], role: 'status', hidden: true }, [
						el('p', { className: ['lms-quiz-result'] }),
						...(q.explanation ? [el('div', { className: ['lms-quiz-explanation'] }, blocks(q.explanation))] : []),
					]),
				]);
			}),
		),
		el('p', { className: ['lms-quiz-score'], role: 'status' }),
	]);
}

/**
 * A question's id for remembering its answer in the browser (src/lib/quiz-answers.ts): a hash of the
 * question, its options and which are correct, so changing any of them forgets old answers (an
 * answer is option indexes). The explanation isn't included: rewording it keeps answers.
 */
export const questionId = (q) =>
	createHash('sha256')
		.update(JSON.stringify([q.question, q.options.map((o) => [o.text, !!o.correct])]))
		.digest('hex')
		.slice(0, 12);

/** A short stable id from the block's text and its position in the page. */
export const quizId = (code, position) => createHash('sha256').update(`${position}\0${code}`).digest('hex').slice(0, 6);

// ---------------------------------------------------------------------------------------------
// ```exercise (native <details>, no JavaScript)

const EXERCISE_FIELDS = ['title', 'task', 'hints', 'solution', 'solutionCode'];

export function readExercise(codeBlock) {
	const { config, fail } = readYamlBlock('exercise', codeBlock, EXERCISE_FIELDS);
	const { title, task, hints = [], solution, solutionCode } = config;
	if (typeof title !== 'string' || !title.trim()) fail('`title` is required');
	if (typeof task !== 'string' || !task.trim()) fail('`task` is required');
	if (!Array.isArray(hints) || hints.some((h) => typeof h !== 'string')) fail('`hints` must be a list of text');
	for (const [key, value] of Object.entries({ solution, solutionCode })) {
		if (value !== undefined && typeof value !== 'string') fail(`\`${key}\` must be text`);
	}
	return { title, task, hints, solution, solutionCode };
}

export function renderExercise(ex) {
	const solutionParts = [
		...(ex.solution ? blocks(ex.solution) : []),
		...(ex.solutionCode ? [el('pre', { className: ['lms-exercise-code'] }, [el('code', {}, [text(ex.solutionCode.replace(/\n$/, ''))])])] : []),
	];
	return el('section', { className: ['lms-exercise', 'not-content'] }, [
		el('div', { className: ['lms-exercise-header'] }, [
			el('span', { className: ['lms-exercise-badge'] }, [text('Exercise')]),
			el('span', { className: ['lms-exercise-title'] }, inline(ex.title)),
		]),
		el('div', { className: ['lms-exercise-task'] }, blocks(ex.task)),
		...ex.hints.map((hint, i) =>
			el('details', { className: ['lms-exercise-hint'] }, [
				el('summary', {}, [text(ex.hints.length > 1 ? `Hint ${i + 1}` : 'Hint')]),
				el('div', {}, blocks(hint)),
			]),
		),
		...(solutionParts.length
			? [el('details', { className: ['lms-exercise-solution'] }, [el('summary', {}, [text('Show solution')]), el('div', {}, solutionParts)])]
			: []),
	]);
}

// ---------------------------------------------------------------------------------------------
// ```asciinema (a placeholder that src/client/asciinema.ts mounts the player on)

// Player options authors may set: name → allowed types.
const CAST_OPTIONS = {
	speed: ['number'],
	idleTimeLimit: ['number'],
	startAt: ['number', 'string'],
	loop: ['boolean', 'number'],
	autoPlay: ['boolean'],
	poster: ['string'],
	rows: ['number'],
	cols: ['number'],
	markers: ['object'],
};

/** `staticDir` is for tests. */
export function readConfig(codeBlock, staticDir = STATIC_DIR) {
	// Options are checked below, with their types, so no field list here.
	const { config, fail } = readYamlBlock('asciinema', codeBlock);
	const { src, title, ...rest } = config;
	if (typeof src !== 'string' || !/^\/[\w./-]+\.cast$/.test(src) || src.includes('..')) {
		fail('`src` must be a path like /casts/<course>/<name>.cast');
	}
	if (!existsSync(staticDir + src)) fail(`recording not found: static${src}`);
	if (title !== undefined && typeof title !== 'string') fail('`title` must be text');

	const options = {};
	for (const [key, value] of Object.entries(rest)) {
		if (!CAST_OPTIONS[key]) fail(`unknown option \`${key}\` (allowed: src, title, ${Object.keys(CAST_OPTIONS).join(', ')})`);
		if (!CAST_OPTIONS[key].includes(typeof value)) fail(`\`${key}\` must be a ${CAST_OPTIONS[key].join(' or ')}`);
		options[key] = value;
	}
	return { src, title, options };
}

export function renderCast(cast) {
	const label = `Terminal recording${cast.title ? `: ${cast.title}` : ''} (.cast)`;
	return el(
		'figure',
		{ className: ['lms-cast', 'not-content'], dataCastSrc: cast.src, dataCastOptions: JSON.stringify(cast.options) },
		[
			el('figcaption', { className: ['lms-cast-titlebar'] }, cast.title ? [text(cast.title)] : []),
			el('div', { className: ['lms-cast-player'] }, [el('a', { className: ['lms-cast-fallback'], href: cast.src }, [text(label)])]),
		],
	);
}

// ---------------------------------------------------------------------------------------------
// ```timeline (plain HTML and CSS, no JavaScript; styles in src/css/site/timeline.css)

export const TIMELINE_LAYOUTS = ['vertical', 'horizontal', 'snake'];
export const TIMELINE_STYLES = ['plain', 'cards'];
const EVENT_FIELDS = ['date', 'title', 'text'];

export function readTimeline(codeBlock) {
	const { config, fail } = readYamlBlock('timeline', codeBlock, ['title', 'layout', 'style', 'events']);
	const { title, layout = 'vertical', style = 'plain', events } = config;
	if (title !== undefined && typeof title !== 'string') fail('`title` must be text');
	if (!TIMELINE_LAYOUTS.includes(layout)) fail(`\`layout\` must be ${TIMELINE_LAYOUTS.join(', ').replace(/, (?=[^,]*$)/, ' or ')}`);
	if (!TIMELINE_STYLES.includes(style)) fail(`\`style\` must be ${TIMELINE_STYLES.join(' or ')}`);
	if (!Array.isArray(events) || events.length < 2) fail('`events` must be a list with at least two events');

	return {
		title,
		layout,
		style,
		// Shown in the order written: dates are free text ("1989", "May 2017", "Day 3"), not sorted.
		events: events.map((event, i) => {
			const at = `event ${i + 1}`;
			if (typeof event !== 'object' || event === null || Array.isArray(event)) fail(`${at}: needs a \`date\` and a \`title\``);
			const unknown = unknownFields(event, EVENT_FIELDS);
			if (unknown) fail(`${at}: ${unknown}`);
			// YAML reads `date: 1989` as a number: show it as written.
			const date = typeof event.date === 'number' ? String(event.date) : event.date;
			if (typeof date !== 'string' || !date.trim()) fail(`${at}: \`date\` is required, e.g. 2017 or May 2017`);
			if (typeof event.title !== 'string' || !event.title.trim()) fail(`${at}: \`title\` is required`);
			if (event.text !== undefined && typeof event.text !== 'string') fail(`${at}: \`text\` must be text`);
			return { date, title: event.title, text: event.text };
		}),
	};
}

/** Events per row a snake timeline can have; the CSS picks one by the timeline's width. */
export const SNAKE_ROW_LENGTHS = [2, 3, 4];

/**
 * Where event `index` (0-based) of `count` sits in a snake timeline with `perRow` events per row.
 * Rows alternate left→right and right→left, so `row` and `col` are 1-based grid lines. `link` is the
 * direction of the next event in the same row; `turn` marks a row's last event (unless it's the last
 * of all), where the line turns down to the row below: on the right after a left→right row, on
 * the left after a right→left one.
 */
export function snakeCell(index, perRow, count) {
	const row = Math.floor(index / perRow);
	const pos = index % perRow;
	const backwards = row % 2 === 1;
	const side = backwards ? 'left' : 'right';
	const more = index < count - 1;
	const rowEnd = pos === perRow - 1;
	return {
		row: row + 1,
		col: backwards ? perRow - pos : pos + 1,
		link: more && !rowEnd ? side : null,
		turn: more && rowEnd ? side : null,
	};
}

/** A snake event's grid positions (inline custom properties) and connector classes, for each row length. */
function snakePlacement(index, count) {
	const cells = SNAKE_ROW_LENGTHS.map((perRow) => [perRow, snakeCell(index, perRow, count)]);
	return {
		style: cells.map(([n, cell]) => `--r${n}:${cell.row};--c${n}:${cell.col}`).join(';'),
		className: cells.flatMap(([n, cell]) => [
			...(cell.link ? [`lms-snake${n}-link-${cell.link[0]}`] : []),
			...(cell.turn ? [`lms-snake${n}-turn-${cell.turn[0]}`] : []),
		]),
	};
}

/**
 * An ordered list, so screen readers announce the events in order and how many there are, whatever
 * the layout. Each event's content is in a `lms-timeline-body`, the panel in `style: cards`.
 */
export function renderTimeline(timeline) {
	const snake = timeline.layout === 'snake';
	const count = timeline.events.length;
	return el('figure', { className: ['lms-timeline', `lms-timeline-${timeline.layout}`, `lms-timeline-${timeline.style}`, 'not-content'] }, [
		...(timeline.title ? [el('figcaption', { className: ['lms-timeline-title'] }, inline(timeline.title))] : []),
		el(
			'ol',
			{ className: ['lms-timeline-events'] },
			timeline.events.map((event, i) => {
				const placement = snake ? snakePlacement(i, count) : { className: [] };
				return el('li', { className: ['lms-timeline-event', ...placement.className], ...(placement.style ? { style: placement.style } : {}) }, [
					// The line's turn down to the next row (drawn by CSS where the event ends a row).
					...(snake ? [el('span', { className: ['lms-timeline-turn'], ariaHidden: 'true' })] : []),
					el('div', { className: ['lms-timeline-body'] }, [
						el('p', { className: ['lms-timeline-date'] }, [text(event.date)]),
						el('p', { className: ['lms-timeline-heading'] }, inline(event.title)),
						...(event.text ? [el('div', { className: ['lms-timeline-text'] }, blocks(event.text))] : []),
					]),
				]);
			}),
		),
	]);
}

// ---------------------------------------------------------------------------------------------
// ```attachment (the same list as the lesson's Downloads, Attachments in src/components/DocParts.tsx)

const ATTACHMENT_FIELDS = ['file', 'title', 'description', 'overview'];

/** The block's entries, checked like `attachments` in frontmatter. `staticDir` is for tests. */
export function readAttachment(codeBlock, staticDir = STATIC_DIR) {
	const fail = failer('attachment', codeBlock);
	let config;
	try {
		config = parse(codeBlock.code);
	} catch (error) {
		fail(`invalid YAML (${error.message})`);
	}
	const entries = Array.isArray(config) ? config : [config];
	if (!entries.length) fail('expected `file:` and `title:` lines, or a list of them');
	return entries.map((entry, i) => {
		const at = entries.length > 1 ? `file ${i + 1}: ` : '';
		if (!entry || typeof entry !== 'object' || Array.isArray(entry)) fail(`${at}expected \`file:\` and \`title:\` lines`);
		const unknown = unknownFields(entry, ATTACHMENT_FIELDS);
		if (unknown) fail(`${at}${unknown}`);
		const { file, title, description, overview = false } = entry;
		for (const problem of attachmentProblems(file, staticDir)) fail(`${at}\`file\` ${problem}`);
		if (typeof title !== 'string' || !title.trim()) fail(`${at}\`title\` is required`);
		if (description !== undefined && typeof description !== 'string') fail(`${at}\`description\` must be text`);
		if (typeof overview !== 'boolean') fail(`${at}\`overview\` must be true or false`);
		return { file, title, ...(description ? { description } : {}), overview, ext: extensionOf(file), ...attachmentInfo(file, staticDir) };
	});
}

export function renderAttachment(items) {
	return el('div', { className: ['lms-attachment', 'not-content'] }, [
		el(
			'ul',
			{ className: ['attachments'] },
			items.map(({ file, title, description, ext, type, size }) =>
				el('li', {}, [
					el('span', { className: ['attachment-ext'], ariaHidden: 'true' }, [text(ext)]),
					el('div', { className: ['attachment-text'] }, [
						el('a', { href: file, download: true }, [text(title)]),
						...(description ? [el('p', {}, [text(description)])] : []),
					]),
					el('span', { className: ['attachment-meta'] }, [text([type, size].filter(Boolean).join(' · '))]),
				]),
			),
		),
	]);
}
