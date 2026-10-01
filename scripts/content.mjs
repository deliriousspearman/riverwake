// The course catalogue read straight from disk: courses, lessons and sections under docs/courses/,
// pro labs under docs/labs/, the site guide under docs/guide/, pathways and the glossary under
// content/.
//
// Used at config time (sidebars.ts builds one sidebar per course from it; docusaurus.config.ts
// builds the redirects and `displayed_sidebar` from it) and by plugins/lms-content.mjs, which
// validates everything and publishes it to the site as global data. Reading the files here, rather
// than using the docs plugin's loaded content, lets the sidebars exist before the docs are loaded.
//
// Content model:
// - docs/courses/<course>/index.md is a course overview (`kind: course`, `order`, optional `image`,
//   `sections`, `attachments`, `aliases`).
// - Lessons sit in the course folder or in one level of numbered section folders:
//   docs/courses/<course>/<NN-section>/<lesson>.md. Order: root lessons, then sections by folder
//   name, each by `sidebar.order`, then id (compareLessons in scripts/sections.mjs).
// - docs/labs/<lab>.md are pro labs (`kind: lab`).
// - docs/guide/ is the site guide for editors: index.md is its overview, and its pages sit in the
//   folder or one level of numbered section folders, ordered like a course's lessons.
// Drafts and `sidebar.hidden` lessons are left out of every list.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { compareLessons, compareSections, sectionTitle } from './sections.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
export const DOCS_DIR = join(ROOT, 'docs');
export const COURSES_DIR = join(DOCS_DIR, 'courses');
export const LABS_DIR = join(DOCS_DIR, 'labs');
export const GUIDE_DIR = join(DOCS_DIR, 'guide');
export const CONTENT_DIR = join(ROOT, 'content');
// Served as-is from the site root (images, downloads, recordings).
export const STATIC_DIR = join(ROOT, 'static');
export const GLOSSARY_DIR = join(CONTENT_DIR, 'glossary');
const MARKDOWN = /\.mdx?$/;
const INDEX = /^index\.mdx?$/;

// Draft pages are only built in development (Docusaurus leaves them out of production builds), so
// the lists and sidebars follow the same rule.
const showDrafts = () => process.env.NODE_ENV === 'development';

// Parsed frontmatter by file, kept until the file changes (its modified time or size). The
// sidebars, the catalogue, the redirects and the frontmatter mapping all read the same pages, several
// times per build; in `npm run dev` an edited page is read again.
const frontmatterCache = new Map();

/** A page's frontmatter (a fresh copy each time, so callers can't change the cached one). */
export function readFrontmatter(file) {
	const { mtimeMs, size } = statSync(file);
	const version = `${mtimeMs}:${size}`;
	let cached = frontmatterCache.get(file);
	if (cached?.version !== version) {
		const match = readFileSync(file, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/);
		cached = { version, data: match ? (parse(match[1]) ?? {}) : {} };
		frontmatterCache.set(file, cached);
	}
	return structuredClone(cached.data);
}

const byOrderThenTitle = (a, b) =>
	(a.order ?? Infinity) - (b.order ?? Infinity) || String(a.title).localeCompare(String(b.title));

/**
 * Pages in one folder (a course or the guide, or one of their sections), unsorted. `base` is the
 * folder's path under docs/ (`courses/<slug>` or `guide`). `listed` is false for hidden ones.
 */
function lessonsIn(dir, base, section, sections) {
	return readdirSync(dir, { withFileTypes: true })
		.filter((d) => d.isFile() && MARKDOWN.test(d.name) && !INDEX.test(d.name))
		.map((d) => {
			const file = join(dir, d.name);
			const data = readFrontmatter(file);
			const rel = `${section ? `${section}/` : ''}${d.name.replace(MARKDOWN, '')}`;
			return {
				id: `${base}/${rel}`,
				path: `/${base}/${rel}`,
				rel,
				file,
				section,
				sectionTitle: section ? sectionTitle(section, sections) : null,
				order: data.sidebar?.order,
				title: data.title ?? rel,
				data,
				listed: !data.sidebar?.hidden,
			};
		})
		.filter((lesson) => !lesson.data.draft || showDrafts());
}

/**
 * Every course with its lessons in course order. Fails on a lesson saved directly
 * in docs/courses/ (usually a CMS lesson saved without choosing its course) and on folders nested
 * inside a section.
 */
export function readCourses(coursesDir = COURSES_DIR) {
	if (!existsSync(coursesDir)) return [];
	const entries = readdirSync(coursesDir, { withFileTypes: true });

	const stray = entries.filter((d) => d.isFile() && MARKDOWN.test(d.name)).map((d) => d.name);
	if (stray.length) {
		throw new Error(
			`Files found directly in docs/courses/: ${stray.join(', ')}. ` +
				'Move each lesson into its course folder (courses/<course>/<lesson>.md).',
		);
	}

	return entries
		.filter((d) => d.isDirectory())
		.map(({ name: slug }) => {
			const dir = join(coursesDir, slug);
			const indexFile = ['index.md', 'index.mdx'].map((f) => join(dir, f)).find(existsSync);
			const data = indexFile ? readFrontmatter(indexFile) : {};
			const sectionDirs = readdirSync(dir, { withFileTypes: true })
				.filter((d) => d.isDirectory())
				.map((d) => d.name)
				.sort(compareSections);
			for (const section of sectionDirs) {
				const nested = readdirSync(join(dir, section), { withFileTypes: true }).filter((d) => d.isDirectory());
				if (nested.length) {
					throw new Error(
						`Folder(s) inside the section courses/${slug}/${section}/: ${nested.map((d) => d.name).join(', ')}. ` +
							'Lessons go in a course folder or one section folder: courses/<course>/<section>/<lesson>.md.',
					);
				}
			}
			const all = [
				...lessonsIn(dir, `courses/${slug}`, '', data.sections),
				...sectionDirs.flatMap((section) => lessonsIn(join(dir, section), `courses/${slug}`, section, data.sections)),
			].sort(compareLessons);
			return {
				slug,
				id: `courses/${slug}/index`,
				path: `/courses/${slug}`,
				file: indexFile,
				title: data.title ?? slug,
				order: data.order,
				data,
				sections: sectionDirs,
				lessons: all.filter((l) => l.listed),
				hiddenLessons: all.filter((l) => !l.listed),
			};
		})
		.filter((course) => course.file && (!course.data.draft || showDrafts()))
		.sort(byOrderThenTitle);
}

/** Pro labs in catalogue order (`order`, then title). */
export function readLabs(labsDir = LABS_DIR) {
	if (!existsSync(labsDir)) return [];
	return readdirSync(labsDir, { withFileTypes: true })
		.filter((d) => d.isFile() && MARKDOWN.test(d.name))
		.map((d) => {
			const file = join(labsDir, d.name);
			const slug = d.name.replace(MARKDOWN, '');
			const data = readFrontmatter(file);
			return { slug, id: `labs/${slug}`, path: `/labs/${slug}`, file, title: data.title ?? slug, order: data.order, data };
		})
		.filter((lab) => !lab.data.draft || showDrafts())
		.sort(byOrderThenTitle);
}

/** YAML files in a content folder as { id (file name), data }. */
/**
 * The site guide (docs/guide/): its overview and its pages in order, like a course's lessons.
 * Null if there's no docs/guide/index.md.
 */
export function readGuide(guideDir = GUIDE_DIR) {
	const file = ['index.md', 'index.mdx'].map((f) => join(guideDir, f)).find(existsSync);
	if (!file) return null;
	const data = readFrontmatter(file);
	const sections = readdirSync(guideDir, { withFileTypes: true })
		.filter((d) => d.isDirectory())
		.map((d) => d.name)
		.sort(compareSections);
	const pages = [
		...lessonsIn(guideDir, 'guide', '', data.sections),
		...sections.flatMap((section) => lessonsIn(join(guideDir, section), 'guide', section, data.sections)),
	].sort(compareLessons);
	return { id: 'guide/index', path: '/guide', file, title: data.title ?? 'Site guide', data, sections, pages: pages.filter((p) => p.listed) };
}

function readYamlFolder(dir) {
	if (!existsSync(dir)) return [];
	return readdirSync(dir)
		.filter((f) => /\.ya?ml$/.test(f))
		.map((f) => ({ id: f.replace(/\.ya?ml$/, ''), file: join(dir, f), data: parse(readFileSync(join(dir, f), 'utf8')) ?? {} }));
}

/** Pathways (content/pathways/*.yml) in catalogue order. Courses are checked by lms-content. */
export function readPathways(dir = join(CONTENT_DIR, 'pathways')) {
	return readYamlFolder(dir)
		.map((p) => ({ ...p, title: p.data.title ?? p.id, order: p.data.order }))
		.sort(byOrderThenTitle);
}

/** Pro lab flag files (content/lab-flags/<lab slug>.yml): the values themselves (scripts/lab-flags.mjs). */
export const readLabFlags = (dir = join(CONTENT_DIR, 'lab-flags')) => readYamlFolder(dir);

/** Changes whenever a glossary file is added, removed or edited (each file's path and modified time). */
export function glossaryVersion(dir = GLOSSARY_DIR) {
	if (!existsSync(dir)) return '';
	return readdirSync(dir)
		.filter((f) => /\.ya?ml$/.test(f))
		.map((f) => `${f}:${statSync(join(dir, f)).mtimeMs}`)
		.join('\n');
}

/** Glossary entries (content/glossary/*.yml), A–Z by term. */
export function readGlossary(dir = GLOSSARY_DIR) {
	return readYamlFolder(dir).sort((a, b) =>
		String(a.data.term).localeCompare(String(b.data.term), 'en', { sensitivity: 'base' }),
	);
}

/** One settings file (content/settings/<name>.yml), or {} if it's missing or empty. */
export function readSettings(name, dir = join(CONTENT_DIR, 'settings')) {
	const file = join(dir, `${name}.yml`);
	return existsSync(file) ? (parse(readFileSync(file, 'utf8')) ?? {}) : {};
}

// ---------------------------------------------------------------------------------------------
// Sidebars

/** Sidebar id of a course's own sidebar (its lessons), shown on its lesson pages. */
export const courseSidebarId = (slug) => `course-${slug}`;

/**
 * Docusaurus sidebars, one per course plus the course list, the pro labs and the site guide:
 * - `courses`: every course overview, in catalogue order. Shown on the overview pages, which are
 *   part of the catalogue: learners enter a course with its Start/Continue button.
 * - `course-<slug>`: that course's Overview link, root lessons, then one category per section. Shown
 *   on its lessons, so prev/next links stay inside the course.
 * - `labs`: every pro lab.
 * - `guide`: the guide's Overview link, root pages, then one category per section.
 * Each is one non-collapsible group with the list's name as its heading.
 */
export function buildSidebars({ courses = readCourses(), labs = readLabs(), guide = readGuide() } = {}) {
	const group = (label, items) => [{ type: 'category', label, collapsible: false, className: 'sidebar-single-group', items }];
	const doc = (id, label, className) => ({ type: 'doc', id, ...(label ? { label } : {}), ...(className ? { className } : {}) });
	/** Pages at the folder root, then one category per section folder that has pages. */
	const outline = (pages, sections, titles) => [
		...pages.filter((p) => !p.section).map((p) => doc(p.id)),
		...sections
			.map((section) => ({
				type: 'category',
				label: sectionTitle(section, titles),
				collapsible: true,
				collapsed: false,
				items: pages.filter((p) => p.section === section).map((p) => doc(p.id)),
			}))
			.filter((category) => category.items.length),
	];
	const sidebars = {
		courses: group('Courses', courses.map((c) => doc(c.id, c.title))),
	};
	for (const course of courses) {
		// `sidebar-course-overview`: this link keeps the course's sidebar on the overview
		// (src/theme/DocSidebarItem/Link).
		sidebars[courseSidebarId(course.slug)] = group(course.title, [doc(course.id, 'Overview', 'sidebar-course-overview'), ...outline(course.lessons, course.sections, course.data.sections)]);
	}
	if (labs.length) sidebars.labs = group('Pro Labs', labs.map((lab) => doc(lab.id)));
	if (guide) sidebars.guide = group(guide.title, [doc(guide.id, 'Overview'), ...outline(guide.pages, guide.sections, guide.data.sections)]);
	return sidebars;
}

/**
 * Which sidebar a docs page shows (its `displayed_sidebar`), from its path relative to docs/:
 * course overviews the course list, lessons (hidden ones too) their course, labs the lab list, and
 * guide pages the guide.
 */
export function sidebarFor(relativePath) {
	const parts = relativePath.split('/');
	if (parts[0] === 'labs') return 'labs';
	if (parts[0] === 'guide') return 'guide';
	if (parts[0] !== 'courses' || parts.length < 3) return undefined;
	return INDEX.test(parts.at(-1)) && parts.length === 3 ? 'courses' : courseSidebarId(parts[1]);
}

// ---------------------------------------------------------------------------------------------
// Redirects for moved pages

/**
 * Every published course and lesson page (hidden lessons too): { path, aliases, lessons }, from
 * readCourses, so drafts are left out the same way and no redirect points at a page that isn't built.
 */
function coursePages(coursesDir) {
	return readCourses(coursesDir).map((course) => ({
		path: course.path,
		aliases: course.data.aliases ?? [],
		lessons: [...course.lessons, ...course.hiddenLessons].map((l) => ({ rel: l.rel, path: l.path, aliases: l.data.aliases ?? [] })),
	}));
}

const ALIAS = /^\/courses\/[\w./-]+$/;

/**
 * Redirects for moved pages: { oldPath: newPath }, both without a trailing slash. Fails if an alias
 * is malformed, is the path of a page that exists, or is claimed by two pages. `coursesDir` is
 * for tests.
 */
export function courseRedirects(coursesDir = COURSES_DIR) {
	if (!existsSync(coursesDir)) return {};
	const courses = coursePages(coursesDir);
	const pages = new Set(courses.flatMap((c) => [c.path, ...c.lessons.map((l) => l.path)]));
	const redirects = new Map();
	const add = (alias, to) => {
		const from = String(alias).replace(/\/+$/, '');
		if (!ALIAS.test(from) || from.includes('..')) {
			throw new Error(`Alias "${alias}" of ${to}: must be an old path like /courses/<course>/<lesson>.`);
		}
		if (pages.has(from)) throw new Error(`Alias "${from}" of ${to} is the path of an existing page.`);
		if (redirects.has(from) && redirects.get(from) !== to) {
			throw new Error(`Alias "${from}" is claimed by both ${redirects.get(from)} and ${to}.`);
		}
		redirects.set(from, to);
	};
	for (const course of courses) {
		for (const alias of course.aliases) {
			add(alias, course.path);
			// The course's lessons moved with it.
			for (const lesson of course.lessons) add(`${String(alias).replace(/\/+$/, '')}/${lesson.rel}`, lesson.path);
		}
		for (const lesson of course.lessons) for (const alias of lesson.aliases) add(alias, lesson.path);
	}
	return Object.fromEntries(redirects);
}
