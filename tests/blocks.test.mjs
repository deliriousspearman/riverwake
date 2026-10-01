// The ```quiz, ```exercise and ```asciinema blocks (scripts/blocks.mjs) and the Markdown-ish text
// in them (scripts/hast-text.mjs).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { questionId, quizId, readConfig, readExercise, readQuiz, readTimeline, renderQuiz, renderTimeline, snakeCell } from '../scripts/blocks.mjs';
import { blocks, inline, unknownFields } from '../scripts/hast-text.mjs';
import { tempDir, writeFiles } from './helpers.mjs';

const block = (code) => ({ code, parentDocument: { sourceFilePath: 'docs/courses/web/quiz.md' } });
const quiz = (options, extra = '') => readQuiz(block(`questions:\n  - question: Which?${extra}\n    options:\n${options}`));

test('a quiz reads plain and { text, correct } options', () => {
	const { title, questions } = quiz('      - Wrong\n      - text: Right\n        correct: true\n');
	assert.equal(title, 'Knowledge check');
	assert.deepEqual(questions[0].options, [
		{ text: 'Wrong', correct: false },
		{ text: 'Right', correct: true },
	]);
});

test('quiz mistakes fail the build, naming the file and the question', () => {
	assert.throws(() => quiz('      - A\n      - B\n'), /quiz block in docs\/courses\/web\/quiz\.md: question 1: mark at least one option/);
	assert.throws(() => quiz('      - text: A\n        correct: true\n'), /needs at least two `options`/);
	assert.throws(() => quiz('      - text: A\n        correct: true\n      - B\n', '\n    hint: no'), /question 1: unknown field\(s\): hint/);
	assert.throws(() => readQuiz(block('questions: []')), /at least one question/);
	assert.throws(() => readQuiz(block('title: Quiz\nquestion: Which?')), /unknown field\(s\): question/);
});

test('a misspelled or non-boolean `correct` on an option fails instead of quietly marking it wrong', () => {
	assert.throws(
		() => quiz('      - text: A\n        correct: true\n      - text: B\n        corect: true\n'),
		/question 1, option 2: unknown field\(s\): corect \(allowed: text, correct\)/,
	);
	assert.throws(() => quiz('      - text: A\n        correct: yes\n      - B\n'), /option 1: `correct` must be true or false/);
});

test('two correct options make a "select all that apply" question with checkboxes', () => {
	const parsed = quiz('      - text: A\n        correct: true\n      - text: B\n        correct: true\n      - C\n');
	const html = JSON.stringify(renderQuiz(parsed, 'abc123'));
	assert.match(html, /Select all that apply/);
	assert.match(html, /"type":"checkbox"/);
	assert.match(html, /"name":"quiz-abc123-0"/);
});

test('a question id changes with the question, its options or the right answer, not the explanation', () => {
	const q = { question: 'Which is a hash?', options: [{ text: 'SHA-256', correct: true }, { text: 'AES' }], explanation: 'Hashing is one-way.' };
	const id = questionId(q);
	assert.match(id, /^[0-9a-f]{12}$/);
	assert.equal(questionId({ ...q, explanation: 'Reworded.' }), id);
	assert.notEqual(questionId({ ...q, question: 'Which is a cipher?' }), id);
	assert.notEqual(questionId({ ...q, options: [{ text: 'SHA-256' }, { text: 'AES', correct: true }] }), id);
	assert.notEqual(questionId({ ...q, options: [...q.options, { text: 'MD5' }] }), id);
	// Rendered on the question, where src/client/quiz.ts reads it.
	assert.match(JSON.stringify(renderQuiz({ title: 'Q', questions: [q] }, 'abc123')), new RegExp(`"dataQuestion":"${id}"`));
});

test('identical quizzes on one page get different ids', () => {
	assert.notEqual(quizId('same', 0), quizId('same', 1));
	assert.equal(quizId('same', 0), quizId('same', 0));
});

test('an exercise needs a title and a task; hints are text', () => {
	const ex = readExercise(block('title: Scan it\ntask: Run **nmap**.\nhints:\n  - Try -sV\nsolutionCode: nmap -sV host\n'));
	assert.equal(ex.title, 'Scan it');
	assert.deepEqual(ex.hints, ['Try -sV']);
	assert.throws(() => readExercise(block('task: Do it')), /`title` is required/);
	assert.throws(() => readExercise(block('title: T\ntask: Do it\nhints: one')), /`hints` must be a list of text/);
	assert.throws(() => readExercise(block('title: T\ntask: Do it\nanswer: 42')), /unknown field\(s\): answer/);
});

test('a recording must exist under static/, and its options have the right types', (t) => {
	const staticDir = writeFiles(tempDir(t), { 'casts/web/demo.cast': '{}' });
	const cast = readConfig(block('src: /casts/web/demo.cast\ntitle: Demo\nspeed: 2\nloop: true'), staticDir);
	assert.deepEqual(cast, { src: '/casts/web/demo.cast', title: 'Demo', options: { speed: 2, loop: true } });
	assert.throws(() => readConfig(block('src: /casts/web/missing.cast'), staticDir), /recording not found: static\/casts\/web\/missing\.cast/);
	assert.throws(() => readConfig(block('src: ../secret.cast'), staticDir), /must be a path like/);
	assert.throws(() => readConfig(block('src: /casts/web/demo.cast\nspeed: fast'), staticDir), /`speed` must be a number/);
	assert.throws(() => readConfig(block('src: /casts/web/demo.cast\nvolume: 3'), staticDir), /unknown option `volume`/);
});

test('block text supports code, bold, italic and safe links only', () => {
	const tags = (source) => inline(source).map((n) => n.tagName ?? 'text');
	assert.deepEqual(tags('`ls` then **bold** and *it*'), ['code', 'text', 'strong', 'text', 'em']);
	assert.equal(inline('[Salt](https://en.wikipedia.org/wiki/Salt_(cryptography))')[0].properties.href, 'https://en.wikipedia.org/wiki/Salt_(cryptography)');
	// Anything else stays as text: no javascript: links, no raw HTML.
	assert.deepEqual(tags('[click](javascript:alert(1))'), ['text']);
	assert.deepEqual(tags('<img src=x onerror=alert(1)>'), ['text']);
});

test('block text makes paragraphs and bullet lists', () => {
	const out = blocks('First line\ncontinues.\n\n- one\n- two\n  wrapped');
	assert.deepEqual(out.map((n) => n.tagName), ['p', 'ul']);
	assert.equal(out[1].children.length, 2);
	assert.equal(out[1].children[1].children[0].value, 'two wrapped');
});

const timeline = (events, extra = '') => readTimeline(block(`${extra}events:\n${events}`));
const twoEvents = '  - date: 1989\n    title: AIDS Trojan\n  - date: May 2017\n    title: WannaCry\n    text: A **worm**.\n';

test('a timeline is vertical and plain by default, keeps its events in order and shows dates as written', () => {
	const { layout, style, title, events } = timeline(twoEvents);
	assert.equal(layout, 'vertical');
	assert.equal(style, 'plain');
	assert.equal(title, undefined);
	assert.deepEqual(
		events.map((e) => [e.date, e.title, e.text]),
		[
			['1989', 'AIDS Trojan', undefined],
			['May 2017', 'WannaCry', 'A **worm**.'],
		],
	);
	assert.equal(timeline(twoEvents, 'layout: horizontal\ntitle: Ransomware\n').layout, 'horizontal');
	const snakeCards = timeline(twoEvents, 'layout: snake\nstyle: cards\n');
	assert.deepEqual([snakeCards.layout, snakeCards.style], ['snake', 'cards']);
});

test('timeline mistakes fail the build, naming the file and the event', () => {
	assert.throws(() => timeline(twoEvents, 'layout: sideways\n'), /timeline block in docs\/courses\/web\/quiz\.md: `layout` must be vertical, horizontal or snake/);
	assert.throws(() => timeline(twoEvents, 'style: bold\n'), /timeline block in docs\/courses\/web\/quiz\.md: `style` must be plain or cards/);
	assert.throws(() => timeline('  - date: 1989\n    title: Only one\n'), /at least two events/);
	assert.throws(() => timeline(`${twoEvents}  - title: No date\n`), /event 3: `date` is required/);
	assert.throws(() => timeline(`${twoEvents}  - date: 2020\n`), /event 3: `title` is required/);
	assert.throws(() => timeline(`${twoEvents}  - date: 2020\n    title: T\n    link: https://x\n`), /event 3: unknown field\(s\): link/);
	assert.throws(() => timeline(twoEvents, 'orientation: horizontal\n'), /unknown field\(s\): orientation/);
});

test('a timeline renders as an ordered list with its layout as a class', () => {
	const figure = renderTimeline(timeline(twoEvents, 'layout: horizontal\ntitle: Ransomware\n'));
	assert.deepEqual(figure.properties.className, ['lms-timeline', 'lms-timeline-horizontal', 'lms-timeline-plain', 'not-content']);
	const [caption, list] = figure.children;
	assert.equal(caption.tagName, 'figcaption');
	assert.equal(list.tagName, 'ol');
	assert.equal(list.children.length, 2);
	// Date, title, then the text only where there is some, in the body (the panel with `style: cards`).
	assert.deepEqual(
		list.children.map((li) => li.children[0].children.map((c) => c.properties.className[0])),
		[
			['lms-timeline-date', 'lms-timeline-heading'],
			['lms-timeline-date', 'lms-timeline-heading', 'lms-timeline-text'],
		],
	);
});

test('a snake timeline runs left to right, turns down, then runs right to left', () => {
	// 5 events, 2 per row:  1 → 2      row 1
	//                            ↓
	//                       4 ← 3      row 2
	//                       ↓
	//                       5          row 3
	const cells = [0, 1, 2, 3, 4].map((i) => snakeCell(i, 2, 5));
	assert.deepEqual(
		cells.map((c) => [c.row, c.col]),
		[
			[1, 1],
			[1, 2],
			[2, 2],
			[2, 1],
			[3, 1],
		],
	);
	assert.deepEqual(
		cells.map((c) => c.link),
		['right', null, 'left', null, null],
	);
	assert.deepEqual(
		cells.map((c) => c.turn),
		[null, 'right', null, 'left', null],
	);
	// 3 per row: the 4th event starts row 2 on the right, below the 3rd.
	assert.deepEqual(snakeCell(3, 3, 7), { row: 2, col: 3, link: 'left', turn: null });
	// A row that ends with the last event doesn't turn.
	assert.equal(snakeCell(2, 3, 3).turn, null);
});

test('a snake timeline places each event for 2, 3 and 4 per row, with its connectors', () => {
	const events = [1, 2, 3, 4, 5].map((n) => `  - date: ${n}\n    title: Event ${n}\n`).join('');
	const figure = renderTimeline(timeline(events, 'layout: snake\nstyle: cards\n'));
	assert.deepEqual(figure.properties.className, ['lms-timeline', 'lms-timeline-snake', 'lms-timeline-cards', 'not-content']);
	const items = figure.children[0].children;
	assert.equal(items[2].properties.style, '--r2:2;--c2:2;--r3:1;--c3:3;--r4:1;--c4:3');
	// Event 3 runs left at 2 per row, ends row 1 (turning right) at 3 per row, and runs right at 4.
	assert.deepEqual(items[2].properties.className, ['lms-timeline-event', 'lms-snake2-link-l', 'lms-snake3-turn-r', 'lms-snake4-link-r']);
	// Every event has the (hidden) turn span first, then its body.
	assert.deepEqual(
		items.map((li) => li.children.map((c) => c.properties.className[0])),
		items.map(() => ['lms-timeline-turn', 'lms-timeline-body']),
	);
	assert.equal(items[0].children[0].properties.ariaHidden, 'true');
	// Vertical and horizontal timelines have neither.
	const plain = renderTimeline(timeline(events)).children[0].children[0];
	assert.equal(plain.properties.style, undefined);
	assert.deepEqual(plain.properties.className, ['lms-timeline-event']);
});

test('unknown fields are named with the allowed ones', () => {
	assert.equal(unknownFields({ title: 'x' }, ['title', 'text']), undefined);
	assert.equal(unknownFields({ titel: 'x', colour: 1 }, ['title', 'text']), 'unknown field(s): titel, colour (allowed: title, text)');
});

test('Mermaid diagrams are checked before the build, naming the line', async () => {
	const { diagramProblems } = await import('../scripts/check-mermaid.mjs');
	// Diagrams that draw, including the site's :::attack and :::highlight classes and a state diagram,
	// and a broken one shown as an example inside a ````md block, which isn't checked.
	const good = [
		'# Page', '', '```mermaid', 'flowchart LR', '  a[Attacker]:::attack --> b[VPN]:::highlight', '```', '',
		'```mermaid', 'stateDiagram-v2', '  [*] --> Closed', '```', '',
		'````md', '```mermaid', 'flowchart TD', '  C[unclosed --> D', '```', '````',
	].join('\n');
	assert.deepEqual(await diagramProblems(good), []);
	// A broken one: the fence is on line 3, so its third line is line 6.
	const bad = ['# Page', '', '```mermaid', 'flowchart TD', '  A --> B', '  C[unclosed --> D', '```'].join('\n');
	const problems = await diagramProblems(bad);
	assert.equal(problems.length, 1);
	assert.match(problems[0], /^line 6: Parse error/);
});
