// Reading courses, lessons and the site guide from disk, and the redirects for moved pages
// (scripts/content.mjs).
import assert from 'node:assert/strict';
import { utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { buildSidebars, courseRedirects, DOCS_DIR, proLabsShown, readAttachmentBlocks, readCourses, readFrontmatter, readGuide, sidebarFor } from '../scripts/content.mjs';
import { toDocusaurus } from '../scripts/frontmatter.mjs';
import { page, tempDir, withNodeEnv, writeFiles } from './helpers.mjs';

const course = (extra = '') => page(`title: Course\nkind: course${extra}`);
const lesson = (extra = '') => page(`title: Lesson${extra}`);

test('lessons come in course order: root lessons, then sections by folder, each by sidebar.order', (t) => {
	const dir = writeFiles(tempDir(t), {
		'web/index.md': course('\nsections:\n  02-attacks: Attacks and defences'),
		'web/intro.md': lesson(),
		'web/02-attacks/xss.md': lesson('\nsidebar:\n  order: 2'),
		'web/02-attacks/sqli.md': lesson('\nsidebar:\n  order: 1'),
		'web/01-basics/http.md': lesson(),
		'web/01-basics/secret.md': lesson('\nsidebar:\n  hidden: true'),
	});
	const [web] = readCourses(dir);
	assert.deepEqual(
		web.lessons.map((l) => l.rel),
		['intro', '01-basics/http', '02-attacks/sqli', '02-attacks/xss'],
	);
	assert.deepEqual(web.hiddenLessons.map((l) => l.rel), ['01-basics/secret']);
	assert.equal(web.lessons[1].sectionTitle, 'Basics');
	assert.equal(web.lessons[2].sectionTitle, 'Attacks and defences');
});

test('courses sort by order, then title', (t) => {
	const dir = writeFiles(tempDir(t), {
		'b/index.md': page('title: Bravo\nkind: course\norder: 1'),
		'a/index.md': page('title: Alpha\nkind: course\norder: 2'),
		'c/index.md': page('title: Charlie\nkind: course'),
	});
	assert.deepEqual(readCourses(dir).map((c) => c.title), ['Bravo', 'Alpha', 'Charlie']);
});

test('a lesson saved directly in docs/courses/ fails, naming the file', (t) => {
	const dir = writeFiles(tempDir(t), { 'stray.md': lesson(), 'web/index.md': course() });
	assert.throws(() => readCourses(dir), /Files found directly in docs\/courses\/: stray\.md/);
});

test('a folder inside a section fails', (t) => {
	const dir = writeFiles(tempDir(t), { 'web/index.md': course(), 'web/01-basics/deeper/x.md': lesson() });
	assert.throws(() => readCourses(dir), /Folder\(s\) inside the section courses\/web\/01-basics\/: deeper/);
});

test('drafts are left out of builds but shown in development', (t) => {
	const dir = writeFiles(tempDir(t), {
		'web/index.md': course(),
		'web/done.md': lesson(),
		'web/wip.md': lesson('\ndraft: true'),
		'soon/index.md': course('\ndraft: true'),
	});
	const build = withNodeEnv('production', () => readCourses(dir));
	assert.deepEqual(build.map((c) => c.slug), ['web']);
	assert.deepEqual(build[0].lessons.map((l) => l.rel), ['done']);
	const dev = withNodeEnv('development', () => readCourses(dir));
	assert.deepEqual(dev.map((c) => c.slug).sort(), ['soon', 'web']);
	assert.equal(dev.find((c) => c.slug === 'web').lessons.length, 2);
});

test('a course alias redirects the course and each of its lessons', (t) => {
	const dir = writeFiles(tempDir(t), {
		'lorem-pathway-3/index.md': course('\naliases: [/courses/web]'),
		'lorem-pathway-3/01-basics/http.md': lesson('\naliases: [/courses/lorem-pathway-3/http/]'),
	});
	assert.deepEqual(courseRedirects(dir), {
		'/courses/web': '/courses/lorem-pathway-3',
		'/courses/web/01-basics/http': '/courses/lorem-pathway-3/01-basics/http',
		'/courses/lorem-pathway-3/http': '/courses/lorem-pathway-3/01-basics/http',
	});
});

test('a draft course gets no redirects in a build (its pages are not built)', (t) => {
	const dir = writeFiles(tempDir(t), { 'old/index.md': course('\ndraft: true\naliases: [/courses/older]'), 'old/a.md': lesson() });
	assert.deepEqual(withNodeEnv('production', () => courseRedirects(dir)), {});
	assert.deepEqual(Object.keys(withNodeEnv('development', () => courseRedirects(dir))), ['/courses/older', '/courses/older/a']);
});

test('bad aliases fail the build', (t) => {
	const clash = writeFiles(tempDir(t), { 'a/index.md': course('\naliases: [/courses/b]'), 'b/index.md': course() });
	assert.throws(() => courseRedirects(clash), /is the path of an existing page/);
	const twice = writeFiles(tempDir(t), { 'a/index.md': course('\naliases: [/courses/old]'), 'b/index.md': course('\naliases: [/courses/old]') });
	assert.throws(() => courseRedirects(twice), /is claimed by both/);
	const malformed = writeFiles(tempDir(t), { 'a/index.md': course('\naliases: [/lessons/x]') });
	assert.throws(() => courseRedirects(malformed), /must be an old path like/);
});

test('each page shows the right sidebar', () => {
	assert.equal(sidebarFor('courses/web/index.md'), 'courses');
	assert.equal(sidebarFor('courses/web/intro.md'), 'course-web');
	assert.equal(sidebarFor('courses/web/01-basics/http.md'), 'course-web');
	assert.equal(sidebarFor('labs/lorem-lab-1.md'), 'labs');
	assert.equal(sidebarFor('guide/index.md'), 'guide');
	assert.equal(sidebarFor('guide/01-editing/publishing.md'), 'guide');
	assert.equal(sidebarFor('other.md'), undefined);
});

test('a course sidebar has the overview, root lessons, then one category per section', (t) => {
	const dir = writeFiles(tempDir(t), { 'web/index.md': course(), 'web/intro.md': lesson(), 'web/01-basics/http.md': lesson() });
	const sidebars = buildSidebars({ courses: readCourses(dir), labs: [] });
	const [group] = sidebars['course-web'];
	assert.deepEqual(
		group.items.map((item) => item.label ?? item.id),
		['Overview', 'courses/web/intro', 'Basics'],
	);
	assert.equal(sidebars.labs, undefined);
});

test('the guide lists its pages like a course: root pages, then sections by folder, each by sidebar.order', (t) => {
	const dir = writeFiles(tempDir(t), {
		'index.md': page('title: Site guide\nsections:\n  02-content: Adding and removing content'),
		'start.md': page('title: Start'),
		'02-content/labs.md': page('title: Labs\nsidebar:\n  order: 2'),
		'02-content/courses.md': page('title: Courses\nsidebar:\n  order: 1'),
		'01-editing/admin.md': page('title: Admin editor'),
		'01-editing/old.md': page('title: Old\nsidebar:\n  hidden: true'),
	});
	const guide = readGuide(dir);
	assert.equal(guide.path, '/guide');
	assert.deepEqual(
		guide.pages.map((p) => p.path),
		['/guide/start', '/guide/01-editing/admin', '/guide/02-content/courses', '/guide/02-content/labs'],
	);
	const [group] = buildSidebars({ courses: [], labs: [], guide }).guide;
	assert.equal(group.label, 'Site guide');
	assert.deepEqual(
		group.items.map((item) => item.label ?? item.id),
		['Overview', 'guide/start', 'Editing', 'Adding and removing content'],
	);
});

test('without docs/guide/index.md there is no guide and no guide sidebar', (t) => {
	const dir = writeFiles(tempDir(t), { 'notes.md': page('title: Notes') });
	assert.equal(readGuide(dir), null);
	assert.equal(buildSidebars({ courses: [], labs: [], guide: null }).guide, undefined);
});

test('frontmatter is cached until the file changes, and callers get their own copy', (t) => {
	const dir = writeFiles(tempDir(t), { 'a.md': page('title: First') });
	const file = join(dir, 'a.md');
	const first = readFrontmatter(file);
	assert.equal(first.title, 'First');
	first.title = 'Changed by a caller';
	assert.equal(readFrontmatter(file).title, 'First');
	// An edit (a new modified time) is read again.
	writeFileSync(file, page('title: Second'));
	utimesSync(file, new Date(), new Date(Date.now() + 5000));
	assert.equal(readFrontmatter(file).title, 'Second');
});

test('attachment blocks are found with their line, but not one shown as an example in another code block', (t) => {
	const dir = writeFiles(tempDir(t), {
		'lesson.md': page(
			'title: L\nattachments: []',
			'Intro.\n\n```attachment\nfile: /files/a.csv\ntitle: A\n```\n\n````md\n```attachment\nfile: /files/example.csv\n```\n````\n\n- In a list:\n\n  ```attachment\n  file: /files/b.csv\n  ```',
		),
		'none.md': page('title: N', 'No blocks.'),
	});
	assert.deepEqual(readAttachmentBlocks(join(dir, 'lesson.md')), [
		{ code: 'file: /files/a.csv\ntitle: A', line: 8 },
		{ code: 'file: /files/b.csv', line: 21 },
	]);
	assert.deepEqual(readAttachmentBlocks(join(dir, 'none.md')), []);
});

test('an SVG picture is kept out of link previews; PNG, JPEG and WebP stay as the preview', () => {
	const file = join(DOCS_DIR, 'courses/no-such-course/index.md');
	const svg = toDocusaurus({ title: 'Web', kind: 'course', image: '/images/courses/web.svg' }, file);
	assert.equal(svg.image, undefined);
	assert.equal(svg.picture, '/images/courses/web.svg');
	const png = toDocusaurus({ title: 'Web', kind: 'course', image: '/images/courses/web.png' }, file);
	assert.equal(png.image, '/images/courses/web.png');
	assert.equal(png.picture, undefined);
});

test('removed pages: a page that git shows was deleted or renamed needs a redirect or a reason', async () => {
	const { pagePath, parseDeletedPages, removedPageProblems } = await import('../scripts/removed-pages.mjs');
	assert.equal(pagePath('docs/courses/web/index.md'), '/courses/web');
	assert.equal(pagePath('docs/courses/web/02-basics/03-xss.md'), '/courses/web/02-basics/03-xss');
	assert.equal(pagePath('docs/guide/index.md'), undefined);
	// `git log --diff-filter=DR --name-status --format='%x00%h %cs'`, newest first.
	const log = ['', 'b2 2026-12-03\n\nR100\tdocs/courses/web/old.md\tdocs/courses/web/new.md\nD\tdocs/courses/web/gone.md', 'a1 2026-11-20\n\nD\tdocs/courses/old-course/index.md\nD\tdocs/courses/old-course/intro.md\nD\tdocs/courses/web/back.md'].join('\0');
	const deleted = parseDeletedPages(log);
	assert.deepEqual([...deleted.keys()], ['/courses/web/old', '/courses/web/gone', '/courses/old-course', '/courses/old-course/intro', '/courses/web/back']);
	assert.deepEqual(deleted.get('/courses/web/old'), { file: 'docs/courses/web/old.md', commit: 'b2' });
	const problems = removedPageProblems({
		deleted,
		current: new Set(['/courses/web', '/courses/web/new', '/courses/web/back']), // back.md was added again
		aliases: { '/courses/web/old': '/courses/web/new' }, // renamed, with a redirect
		removed: ['/courses/old-course'], // the whole course, on purpose
	});
	assert.deepEqual(problems, ['/courses/web/gone (docs/courses/web/gone.md, removed in commit b2)']);
	// Only changes on or after the go-live day (checkFrom) count: a1 was made while setting up.
	assert.deepEqual([...parseDeletedPages(log, '2026-12-01').keys()], ['/courses/web/old', '/courses/web/gone']);
	assert.deepEqual([...parseDeletedPages(log, '2026-12-03').keys()], ['/courses/web/old', '/courses/web/gone']);
	assert.deepEqual([...parseDeletedPages(log, '2026-12-04').keys()], []);
});

test('removed pages: checkFrom is a day as YAML or the admin editor writes it, or empty (not checked yet)', async () => {
	const { removedPagesSchema } = await import('../scripts/schema.mjs');
	const { parse } = await import('yaml');
	assert.equal(removedPagesSchema.parse(parse('checkFrom: 2026-12-01\npages: []')).checkFrom, '2026-12-01');
	assert.equal(removedPagesSchema.parse({ checkFrom: '2026-12-01' }).checkFrom, '2026-12-01');
	assert.equal(removedPagesSchema.parse({ checkFrom: '' }).checkFrom, undefined);
	assert.equal(removedPagesSchema.parse(parse('checkFrom:\npages: []')).checkFrom, undefined);
	assert.equal(removedPagesSchema.safeParse({ checkFrom: 'after launch' }).success, false);
});

test('pro labs are shown unless features.yml switches them off', () => {
	assert.equal(proLabsShown({}), true);
	assert.equal(proLabsShown({ proLabs: true }), true);
	assert.equal(proLabsShown({ proLabs: false }), false);
});
