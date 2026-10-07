// Docusaurus plugin: the course catalogue as site data, the build checks, and the catalogue pages.
//
// - loadContent reads courses, lessons, labs, the site guide, pathways, the glossary and the banner settings
//   (scripts/content.mjs) and checks them: every field against scripts/schema.mjs, labs against
//   labProblems and their flags files (scripts/lab-flags.mjs: only flag hashes are published),
//   pathways for unknown courses, the glossary for duplicates and unknown "see also"
//   links, and the uploads under static/ (scripts/static-files.mjs). Any problem fails the build
//   (in `docusaurus start`, it's shown in the terminal).
// - contentLoaded publishes it all as global data (usePluginData('lms-content'), see
//   src/lib/catalog.ts), except the glossary, which only its own routes load. The React components
//   render from it. It also adds the catalogue routes:
//   /courses/, /pathways/, /pathways/<id>/, /labs/, /glossary/ and /glossary/<id>/
//   (src/components/CatalogPage.tsx).
// - Dates ("Created", "Last updated") come from frontmatter or git (scripts/dates.mjs).
// - postBuild replaces the published copy of each draw.io diagram (static/**/*.drawio.svg) with the
//   cleaned SVG (scripts/drawio-svg.mjs): lessons show diagrams inline, but the file is still at its
//   address, and draw.io's own export loads Google Fonts. The diagram copy is kept in it.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { attachmentInfo, extensionOf } from '../scripts/attachments.mjs';
import { bannerWarnings } from '../scripts/banner.mjs';
import { readAttachment } from '../scripts/blocks.mjs';
import { CONTENT_DIR, courseRedirects, DOCS_DIR, STATIC_DIR, glossaryVersion, readAttachmentBlocks, readCourses, readGlossary, readGuide, proLabsShown, readLabFlags, readLabs, readPathways, readSettings } from '../scripts/content.mjs';
import { createdDate, newest, updatedDate } from '../scripts/dates.mjs';
import { glossaryProblems } from '../scripts/glossary.mjs';
import { labFlagProblems, labFlagWarnings, publicFlags } from '../scripts/lab-flags.mjs';
import { labProblems, labSummary, osCounts } from '../scripts/labs.mjs';
import { deletedPages, removedPageProblems } from '../scripts/removed-pages.mjs';
import { bannerSchema, check, featuresSchema, glossarySchema, labFlagsSchema, pageSchema, pathwaySchema, removedPagesSchema } from '../scripts/schema.mjs';
import { DRAWIO_SVG, drawioSvgFile, readDrawioSvgFile } from '../scripts/drawio-svg.mjs';
import { filesUnder, staticFileProblems, staticFileWarnings } from '../scripts/static-files.mjs';
import { filterText, lessonSummary } from '../scripts/summary.mjs';

const iso = (date) => date?.toISOString();

/** Attachments with their type label, extension and size for the download lists. */
const files = (list = []) => list.map((a) => ({ ...a, ext: extensionOf(a.file), ...attachmentInfo(a.file) }));

/**
 * The files in a page's ```attachment blocks (scripts/blocks.mjs), with their type and size. Fails
 * on an invalid block (as the page itself would) and on a file listed twice on the page, in
 * `attachments` or another block: the page would show it twice.
 */
function attachmentBlocks(file, frontmatter = []) {
	const where = file.replace(`${DOCS_DIR}/`, 'docs/');
	const seen = new Set(frontmatter.map((a) => a.file));
	return readAttachmentBlocks(file).flatMap(({ code, line }) =>
		readAttachment({ code, parentDocument: { sourceFilePath: `${where}, line ${line}` } }).map((item) => {
			if (seen.has(item.file)) {
				throw new Error(`attachment block in ${where}, line ${line}: ${item.file} is already listed on this page (in \`attachments\` or another block); list each file once`);
			}
			seen.add(item.file);
			return item;
		}),
	);
}

/** Validate a page's frontmatter and its ```attachment blocks, naming the file on failure. */
const page = (item) => {
	const data = check(pageSchema, item.data, `Frontmatter in ${item.file.replace(`${DOCS_DIR}/`, 'docs/')}`);
	return { ...item, data, attachmentBlocks: attachmentBlocks(item.file, data.attachments) };
};

export function loadCatalog() {
	const problems = [];
	const attempt = (fn) => {
		try {
			return fn();
		} catch (error) {
			problems.push(error.message);
			return undefined;
		}
	};

	const courses = readCourses()
		.map((course) =>
			attempt(() => ({
				...page(course),
				lessons: course.lessons.map(page),
				hiddenLessons: course.hiddenLessons.map(page),
			})),
		)
		.filter(Boolean);
	const flagFiles = readLabFlags();
	const withFlags = new Set(flagFiles.map((f) => f.id));
	const labs = readLabs()
		.map((lab) =>
			attempt(() => {
				const checked = page(lab);
				const labIssues = labProblems(checked.data, { hasFlagFile: withFlags.has(lab.slug) });
				if (labIssues.length) throw new Error(`Pro lab "${lab.id}":\n- ${labIssues.join('\n- ')}`);
				return checked;
			}),
		)
		.filter(Boolean);
	// Each lab's flags (content/lab-flags/<slug>.yml): only their names and hashes reach the site.
	const labFlagWarningList = [];
	for (const file of flagFiles) {
		attempt(() => {
			const where = `Pro lab flags content/lab-flags/${file.id}.yml`;
			const { lab: named, flags } = check(labFlagsSchema, file.data, where);
			const lab = labs.find((l) => l.slug === file.id);
			const issues = labFlagProblems(file.id, flags, lab, labs.map((l) => l.slug));
			if (named && named !== file.id) issues.unshift(`\`lab: ${named}\` doesn't match the file's name (${file.id}.yml)`);
			if (issues.length) throw new Error(`${where}:\n- ${issues.join('\n- ')}`);
			lab.flagList = publicFlags(file.id, flags);
			labFlagWarningList.push(...labFlagWarnings(file.id, flags));
		});
	}
	const guide =
		attempt(() => {
			const read = readGuide();
			return read && { ...page(read), pages: read.pages.map(page) };
		}) ?? null;

	const known = new Set(courses.map((c) => c.slug));
	const pathways = readPathways()
		.map((pathway) =>
			attempt(() => {
				const data = check(pathwaySchema, pathway.data, `Pathway content/pathways/${pathway.id}.yml`);
				const missing = data.courses.filter((slug) => !known.has(slug));
				if (missing.length) {
					throw new Error(
						`Pathway "${pathway.id}" lists unknown course(s): ${missing.join(', ')}. ` +
							`Use course folder names from docs/courses/: ${[...known].join(', ')}.`,
					);
				}
				return { ...pathway, data };
			}),
		)
		.filter(Boolean);

	const glossary = readGlossary()
		.map((entry) => attempt(() => ({ ...entry, data: check(glossarySchema, entry.data, `Glossary entry content/glossary/${entry.id}.yml`) })))
		.filter(Boolean);
	const glossaryIssues = glossaryProblems(glossary.map((e) => ({ id: e.id, ...e.data })));
	if (glossaryIssues.length) problems.push(`Glossary (content/glossary/):\n- ${glossaryIssues.join('\n- ')}`);

	// Uploads are published on the site's own address: only each folder's file types, and plain SVGs.
	const staticIssues = staticFileProblems();
	if (staticIssues.length) problems.push(`Files in static/:\n- ${staticIssues.join('\n- ')}`);

	const banner = attempt(() => check(bannerSchema, readSettings('banner'), 'Banner settings content/settings/banner.yml'));
	const features = attempt(() => check(featuresSchema, readSettings('features'), 'Feature settings content/settings/features.yml'));
	const aliases = attempt(() => courseRedirects()) ?? {};

	// Course pages that were published and have gone with no redirect (scripts/removed-pages.mjs),
	// counted from the `checkFrom` date in removed-pages.yml (unset while the site is being set up).
	const warnings = [];
	const removed = attempt(() => check(removedPagesSchema, readSettings('removed-pages'), 'Removed pages content/settings/removed-pages.yml'));
	const checkFrom = removed?.checkFrom;
	const deleted = removed && checkFrom ? deletedPages(checkFrom) : undefined;
	if (removed && !checkFrom) {
		warnings.push('Pages removed without a redirect aren\'t checked yet: set "Check from" in Site settings → Removed pages (content/settings/removed-pages.yml `checkFrom`) when the site goes live.');
	} else if (removed && !deleted) {
		warnings.push("git history isn't available, so pages removed without a redirect weren't checked.");
	} else if (removed) {
		const current = new Set(courses.flatMap((c) => [c.path, ...c.lessons.map((l) => l.path), ...c.hiddenLessons.map((l) => l.path)]));
		const gone = removedPageProblems({ deleted, current, aliases, removed: (removed.pages ?? []).map((p) => p.path.replace(/\/+$/, '')) });
		if (gone.length) {
			problems.push(
				`Course pages that were published are gone, with no redirect. Learners lose their progress for them, and links to them break:\n- ${gone.join('\n- ')}\n` +
					"If a page moved, add its old address to the new page's `aliases` (Site guide → Moving, renaming and deleting). If it was removed on purpose, add it to Site settings → Removed pages (content/settings/removed-pages.yml), with the reason.",
			);
		}
	}

	if (problems.length) throw new Error(`Content problems:\n\n${problems.join('\n\n')}`);
	for (const warning of [...bannerWarnings(banner), ...staticFileWarnings(), ...labFlagWarningList, ...warnings]) console.warn(`[lms-content] ${warning}`);
	return { courses, labs, guide, pathways, glossary, banner, features, aliases };
}

/** The catalogue as the JSON the site renders from (src/lib/catalog.ts has its type). */
export function toGlobalData({ courses, labs, guide = null, pathways, glossary, features = {}, aliases }, siteDescription) {
	const dates = {};
	// Guide pages can show a video and downloads, like lessons (to demonstrate them): their files by page.
	const guideAttachments = {};
	if (guide) {
		for (const p of guide.pages) if (p.data.attachments?.length) guideAttachments[p.path] = files(p.data.attachments);
		for (const p of guide.pages) dates[p.path] = { created: iso(createdDate(p.file, p.data)), updated: iso(updatedDate(p.file, p.data)) };
		// Like a course overview, the guide's last update is the newest of all its pages.
		dates[guide.path] = { created: iso(createdDate(guide.file, guide.data)), updated: iso(newest([guide, ...guide.pages].map((p) => updatedDate(p.file, p.data)))) };
	}
	const lesson = (l) => {
		dates[l.path] = { created: iso(createdDate(l.file, l.data)), updated: iso(updatedDate(l.file, l.data)) };
		return {
			path: l.path,
			title: l.data.title,
			video: l.data.video ?? null,
			section: l.section || null,
			sectionTitle: l.sectionTitle,
			attachments: files(l.data.attachments),
			// Files from the lesson's ```attachment blocks with `overview: true`: course overview only,
			// as the lesson shows them in its text.
			overviewAttachments: (l.attachmentBlocks ?? []).filter((a) => a.overview).map(({ overview, ...a }) => a),
		};
	};
	const courseData = courses.map((course) => {
		const lessons = course.lessons.map(lesson);
		const hiddenLessons = course.hiddenLessons.map(lesson);
		dates[course.path] = {
			created: iso(createdDate(course.file, course.data)),
			// A course's last update is the newest of the overview and all of its lessons.
			updated: iso(newest([course, ...course.lessons].map((p) => updatedDate(p.file, p.data)))),
		};
		return {
			slug: course.slug,
			path: course.path,
			title: course.data.title,
			description: course.data.description ?? null,
			image: course.data.image ?? null,
			level: course.data.level ?? null,
			summary: lessonSummary(course.lessons.map((l) => l.data)),
			filter: filterText(course.data),
			lessons,
			// Not in any list, progress or count, but their pages still show their video and downloads.
			hiddenLessons,
			attachments: files(course.data.attachments),
		};
	});
	const courseBySlug = new Map(courses.map((c) => [c.slug, c]));
	const termById = new Map(glossary.map((e) => [e.id, e.data.term]));
	return {
		site: { description: siteDescription },
		// Parts of the site switched on (content/settings/features.yml).
		features: { proLabs: proLabsShown(features) },
		courses: courseData,
		pathways: pathways.map(({ id, data }) => {
			const lessons = data.courses.flatMap((slug) => courseBySlug.get(slug).lessons.map((l) => l.data));
			return {
				id,
				path: `/pathways/${id}`,
				title: data.title,
				description: data.description ?? null,
				level: data.level ?? null,
				image: data.image ?? null,
				courses: data.courses,
				summary: lessonSummary(lessons),
				courseSummary: `${data.courses.length} ${data.courses.length === 1 ? 'course' : 'courses'} · ${lessonSummary(lessons)}`,
				filter: filterText(data),
			};
		}),
		labs: labs.map((lab) => {
			dates[lab.path] = { created: iso(createdDate(lab.file, lab.data)), updated: iso(updatedDate(lab.file, lab.data)) };
			const { title, description, level, image, environment, domain, entryPoint, machines, skills } = lab.data;
			// The count from the lab's flags file if it has one, else the page's `flags`.
			const flagList = lab.flagList ?? [];
			const flags = flagList.length || lab.data.flags;
			return {
				slug: lab.slug,
				path: lab.path,
				title,
				description: description ?? null,
				level: level ?? null,
				image: image ?? null,
				environment,
				domain: domain ?? null,
				entryPoint,
				flags,
				flagList,
				machines: machines.map((m) => ({ name: m.name, os: m.os, role: m.role ?? null, network: m.network ?? null, domainJoined: !!m.domainJoined })),
				skills: skills ?? [],
				summary: labSummary({ machines, flags }),
				osCounts: osCounts(machines),
				filter: filterText(lab.data),
			};
		}),
		glossary: glossary.map(({ id, data }) => ({
			id,
			term: data.term,
			aliases: data.aliases ?? [],
			definition: data.definition,
			seeAlso: (data.seeAlso ?? []).map((other) => ({ id: other, term: termById.get(other) ?? other })),
		})),
		guideAttachments,
		dates,
		aliases,
	};
}

/** Every MDX loader in the bundler's rules (the docs plugin's and the pages plugin's). */
function* mdxLoaders(rules = []) {
	for (const rule of rules) {
		if (!rule || typeof rule !== 'object') continue;
		for (const use of Array.isArray(rule.use) ? rule.use : []) {
			if (String(use?.loader).includes('mdx-loader') && Array.isArray(use.options?.dependencies)) yield use;
		}
		yield* mdxLoaders(rule.oneOf);
		yield* mdxLoaders(rule.rules);
	}
}

/** @type {import('@docusaurus/types').PluginModule} */
export default function lmsContent(context) {
	const glossaryStamp = join(context.generatedFilesDir, 'lms-content', 'glossary-version.txt');
	return {
		name: 'lms-content',
		getPathsToWatch: () => [join(CONTENT_DIR, '**/*.{yml,yaml}'), join(DOCS_DIR, '**/*.{md,mdx}')],
		// Pages are marked with the glossary's terms (plugins/remark-glossary.mjs), so a glossary change
		// must recompile them, or `npm run dev` would keep the old terms until a restart. Every page
		// depends on this file, which is rewritten when the glossary changes (loadContent runs again then).
		configureWebpack(config) {
			for (const use of mdxLoaders(config.module?.rules)) use.options.dependencies.push(glossaryStamp);
			return {};
		},
		async postBuild({ outDir }) {
			// The content checks have already failed the build on any diagram with problems.
			for (const rel of filesUnder(STATIC_DIR)) {
				if (!DRAWIO_SVG.test(rel) || !existsSync(join(outDir, rel))) continue;
				writeFileSync(join(outDir, rel), drawioSvgFile(readDrawioSvgFile(join(STATIC_DIR, rel))));
			}
		},
		async loadContent() {
			const version = glossaryVersion();
			if (!existsSync(glossaryStamp) || readFileSync(glossaryStamp, 'utf8') !== version) {
				mkdirSync(dirname(glossaryStamp), { recursive: true });
				writeFileSync(glossaryStamp, version);
			}
			return toGlobalData(loadCatalog(), context.siteConfig.tagline);
		},
		async contentLoaded({ content, actions }) {
			// The glossary is only for its own pages, so it isn't in the global data every page loads:
			// each glossary route gets it as a data module instead (the term pages just their entry).
			const { glossary, ...globalData } = content;
			actions.setGlobalData(globalData);
			const route = (path, props, modules) => actions.addRoute({ path, component: '@site/src/components/CatalogPage.tsx', exact: true, props, ...(modules && { modules }) });
			route('/courses/', { page: 'courses' });
			route('/pathways/', { page: 'pathways' });
			route('/labs/', { page: 'labs' });
			route('/glossary/', { page: 'glossary' }, { glossary: await actions.createData('glossary.json', JSON.stringify(glossary)) });
			for (const pathway of content.pathways) route(`${pathway.path}/`, { page: 'pathway', id: pathway.id });
			// One page per glossary term, which site search indexes (src/components/GlossaryTerm.tsx).
			for (const entry of glossary) {
				route(`/glossary/${entry.id}/`, { page: 'term', id: entry.id }, { entry: await actions.createData(`glossary-${entry.id}.json`, JSON.stringify(entry)) });
			}
		},
	};
}

