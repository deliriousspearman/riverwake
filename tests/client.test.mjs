// Browser-side helpers, imported from their TypeScript (tests/helpers.mjs, importTs): the progress
// store's caching (src/lib/progress.ts), the catalogue filter (src/components/CatalogFilter.tsx),
// and the preferences (src/lib/preferences.ts) with the <head> script that applies them before the
// page is drawn (src/head/preferences.js).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import { importTs } from './helpers.mjs';

/** A localStorage for the store to use, outside a browser. */
function fakeStorage() {
	const items = new Map();
	return {
		getItem: (key) => (items.has(key) ? items.get(key) : null),
		setItem: (key, value) => items.set(key, String(value)),
		removeItem: (key) => items.delete(key),
	};
}

test('progress and the last lesson are cached separately', async () => {
	globalThis.localStorage = fakeStorage();
	globalThis.window = { addEventListener() {} };
	const store = await importTs('src/lib/progress.ts');

	const before = store.getProgressSnapshot();
	assert.equal(store.getProgressSnapshot(), before, 'the same object until progress changes');

	// Visiting a lesson changes the last lesson, not progress: components showing progress keep theirs.
	store.recordLastLesson('/courses/web/intro/');
	assert.equal(store.getProgressSnapshot(), before);
	assert.equal(store.getLastLessonSnapshot(), '/courses/web/intro');

	// Completing a lesson changes progress, not the last lesson.
	store.markComplete('/courses/web/intro/');
	const after = store.getProgressSnapshot();
	assert.notEqual(after, before);
	assert.ok(store.isDoneIn(after, '/courses/web/intro/'));
	assert.equal(store.getLastLessonSnapshot(), '/courses/web/intro');

	store.markIncomplete('/courses/web/intro');
	assert.ok(!store.isDoneIn(store.getProgressSnapshot(), '/courses/web/intro'));
	delete globalThis.localStorage;
	delete globalThis.window;
});

test('the catalogue filter matches every typed word, and the level', async () => {
	const { filterMatcher, searchWords } = await importTs('src/components/CatalogFilter.tsx');
	assert.deepEqual(searchWords('  Web  APP '), ['web', 'app']);
	const card = { filter: 'web app security the owasp top ten', level: 'Beginner' };
	assert.equal(filterMatcher({ text: 'owasp web', level: '', hideCompleted: false })(card), true);
	assert.equal(filterMatcher({ text: 'owasp kerberos', level: '', hideCompleted: false })(card), false);
	assert.equal(filterMatcher({ text: '', level: 'beginner', hideCompleted: false })(card), true);
	assert.equal(filterMatcher({ text: '', level: 'advanced', hideCompleted: false })(card), false);
});

/** A <html> element that records its attributes. */
function fakeRoot() {
	const attributes = new Map();
	return {
		attributes,
		dataset: {},
		setAttribute: (name, value) => attributes.set(name, String(value)),
		removeAttribute: (name) => attributes.delete(name),
	};
}

test('preferences are stored, set on <html>, and put back to their defaults', async () => {
	const root = fakeRoot();
	globalThis.localStorage = fakeStorage();
	globalThis.window = { addEventListener() {} };
	globalThis.document = { documentElement: root };
	const prefs = await importTs('src/lib/preferences.ts');

	prefs.setPreferences({ text: 'large', glossary: 'off', speed: '1.5' });
	assert.deepEqual(JSON.parse(localStorage.getItem('lms-preferences-v1')), { text: 'large', glossary: 'off', speed: '1.5' });
	assert.equal(root.attributes.get('data-lms-text'), 'large');
	assert.equal(root.attributes.get('data-lms-glossary'), 'off');

	// Back to a default: no longer stored or set (normal speed is the default).
	prefs.setPreferences({ text: undefined, speed: '1' });
	assert.deepEqual(prefs.getPreferences(), { glossary: 'off' });
	assert.ok(!root.attributes.has('data-lms-text'));

	prefs.resetPreferences();
	assert.equal(localStorage.getItem('lms-preferences-v1'), null);
	assert.equal(root.attributes.size, 0);

	// "Hide completed" keeps its own, older key.
	prefs.setHideCompleted(true);
	assert.equal(localStorage.getItem('lms-hide-completed'), '1');
	assert.ok(prefs.getHideCompleted());
	delete globalThis.localStorage;
	delete globalThis.window;
	delete globalThis.document;
});

test('the <head> script sets saved preferences on <html> before the page is drawn, and nothing else', () => {
	const script = readFileSync(new URL('../src/head/preferences.js', import.meta.url), 'utf8');
	const run = (saved) => {
		const root = fakeRoot();
		const storage = fakeStorage();
		if (saved !== undefined) storage.setItem('lms-preferences-v1', saved);
		vm.runInNewContext(script, { localStorage: storage, document: { documentElement: root } });
		return Object.fromEntries(root.attributes);
	};
	assert.deepEqual(run(JSON.stringify({ text: 'larger', width: 'wide', speed: '1.25' })), { 'data-lms-text': 'larger', 'data-lms-width': 'wide', 'data-lms-speed': '1.25' });
	// "On this page" collapsed and the breadcrumb bar unpinned: the layout depends on these from the first frame.
	assert.deepEqual(run(JSON.stringify({ toc: 'hidden', breadcrumbs: 'scroll' })), { 'data-lms-toc': 'hidden', 'data-lms-breadcrumbs': 'scroll' });
	// Nothing saved, unreadable JSON, or odd names and values: nothing set, and no error.
	assert.deepEqual(run(undefined), {});
	assert.deepEqual(run('{not json'), {});
	assert.deepEqual(run(JSON.stringify({ 'on-click': 'x', text: 'a b"c', width: 3 })), {});
	// The same storage key as the store that writes it.
	assert.match(readFileSync(new URL('../src/lib/preferences.ts', import.meta.url), 'utf8'), /const KEY = 'lms-preferences-v1';/);
});

test('quiz answers are remembered, forgotten, reset with progress and merged from backups', async () => {
	globalThis.localStorage = fakeStorage();
	globalThis.window = { addEventListener() {} };
	const answers = await importTs('src/lib/quiz-answers.ts');
	const progress = await importTs('src/lib/progress.ts');

	answers.rememberQuizAnswer('aaaaaaaaaaaa', [1], false);
	answers.rememberQuizAnswer('bbbbbbbbbbbb', [0, 2], true);
	assert.deepEqual(answers.loadQuizAnswers().bbbbbbbbbbbb.answer, [0, 2]);
	answers.forgetQuizAnswer('aaaaaaaaaaaa');
	assert.deepEqual(Object.keys(answers.loadQuizAnswers()), ['bbbbbbbbbbbb']);

	// Backups carry them; restoring keeps this browser's unless the backup's is newer, and skips junk.
	const backup = progress.progressBackup();
	assert.deepEqual(Object.keys(backup.quizzes), ['bbbbbbbbbbbb']);
	const older = { answer: [1], right: false, at: 1 };
	const newer = { answer: [3], right: true, at: Date.now() + 1000 };
	progress.restoreProgress({ ...backup, quizzes: { bbbbbbbbbbbb: older, cccccccccccc: newer, 'not-an-id': newer, dddddddddddd: { answer: 'x' } } });
	assert.deepEqual(answers.loadQuizAnswers().bbbbbbbbbbbb.answer, [0, 2]);
	assert.deepEqual(Object.keys(answers.loadQuizAnswers()).sort(), ['bbbbbbbbbbbb', 'cccccccccccc']);
	progress.restoreProgress({ ...backup, quizzes: { bbbbbbbbbbbb: newer } });
	assert.deepEqual(answers.loadQuizAnswers().bbbbbbbbbbbb.answer, [3]);
	// Older backups have no quizzes.
	progress.restoreProgress({ format: 'codex-progress-v1', progress: {} });

	progress.resetProgress();
	assert.deepEqual(answers.loadQuizAnswers(), {});
	assert.equal(localStorage.getItem('lms-quiz-v1'), null);
	delete globalThis.localStorage;
	delete globalThis.window;
});

test('a Mermaid placeholder is about as tall as the drawn diagram', async () => {
	const { estimatedHeight } = await importTs('src/lib/mermaid.ts');
	// The site guide's diagrams, drawn at 394–729px.
	const chain = (n) => ['flowchart TD', ...Array.from({ length: n }, (_, i) => `  n${i} --> n${i + 1}`)].join('\n');
	assert.ok(Math.abs(estimatedHeight(chain(5)) - 729) < 120);
	assert.ok(Math.abs(estimatedHeight(chain(4)) - 599) < 120);
	assert.ok(estimatedHeight('flowchart LR\n  a --> b\n  b --> c') < estimatedHeight(chain(2)), 'left-to-right is shorter');
	assert.ok(Math.abs(estimatedHeight('stateDiagram-v2\n  [*] --> A\n  A --> B\n  B --> C\n  C --> [*]') - 394) < 80);
	// Never tiny or huge.
	assert.equal(estimatedHeight(''), 160);
	assert.equal(estimatedHeight(chain(40)), 760);
});

test('preferences from a backup fill in only what the restoring browser is still on the default for', async () => {
	globalThis.localStorage = fakeStorage();
	globalThis.window = { addEventListener() {} };
	globalThis.document = { documentElement: fakeRoot() };
	const prefs = await importTs('src/lib/preferences.ts');

	prefs.setPreferences({ text: 'larger', speed: '1.5', captions: 'on' });
	prefs.setHideCompleted(true);
	const backup = prefs.preferencesBackup();
	assert.deepEqual(backup, { text: 'larger', speed: '1.5', captions: 'on', hideCompleted: true });

	// Another device: its own text size and "Hide completed" stay; the rest is filled in; junk skipped.
	globalThis.localStorage = fakeStorage();
	prefs.resetPreferences();
	prefs.setPreferences({ text: 'large' });
	prefs.setHideCompleted(false);
	assert.equal(prefs.fillPreferences({ ...backup, width: 'enormous', motion: 3, unknown: 'x' }), 2);
	assert.deepEqual(prefs.getPreferences(), { text: 'large', speed: '1.5', captions: 'on' });
	assert.equal(prefs.getHideCompleted(), false);
	// Nothing to fill from an older backup.
	assert.equal(prefs.fillPreferences(undefined), 0);
	delete globalThis.localStorage;
	delete globalThis.window;
	delete globalThis.document;
});

test('a submitted lab flag is hashed in the browser exactly as the build hashes it, and recorded once', async () => {
	globalThis.localStorage = fakeStorage();
	globalThis.window = { addEventListener() {}, removeEventListener() {} };
	const { flagHash, publicFlags } = await import('../scripts/lab-flags.mjs');
	const store = await importTs('src/lib/lab-flags.ts');
	assert.equal(await store.hashFlag('web', ' HL{0123456789abcdef}\n'), flagHash('web', 'HL{0123456789abcdef}'));
	// Salted by lab: the same flag in another lab has another hash.
	assert.notEqual(await store.hashFlag('other', 'HL{0123456789abcdef}'), flagHash('web', 'HL{0123456789abcdef}'));

	const lab = { slug: 'web', flagList: publicFlags('web', [{ machine: 'WEB01', label: 'User', flag: 'HL{0123456789abcdef}' }, { label: 'Root', flag: 'HL{fedcba9876543210}' }]) };
	assert.deepEqual(await store.submitFlag(lab, 'HL{wrong}'), { result: 'wrong' });
	const first = await store.submitFlag(lab, 'HL{0123456789abcdef}');
	assert.equal(first.result, 'captured');
	assert.equal(store.flagName(first.flag), 'WEB01 · User');
	const again = await store.submitFlag(lab, 'HL{0123456789abcdef}');
	assert.equal(again.result, 'already');
	const saved = JSON.parse(localStorage.getItem('lms-lab-flags-v1'));
	assert.deepEqual(Object.keys(saved.web), [lab.flagList[0].id]);
	const summary = store.labFlagSummary(lab, saved.web);
	assert.deepEqual([summary.count, summary.total, summary.started, summary.complete], [1, 2, true, false]);
	assert.equal(store.flagName(lab.flagList[1]), 'Root');
	delete globalThis.localStorage;
	delete globalThis.window;
});
