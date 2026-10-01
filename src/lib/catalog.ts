// The course catalogue in the browser: what plugins/lms-content.mjs publishes as global data
// (toGlobalData), with types. Every page has it, so components can list courses, find a lesson's
// course, or check progress against a course's lessons without extra requests.
import { usePluginData } from '@docusaurus/useGlobalData';
import { normalise } from './progress';

export type Attachment = { file: string; title: string; description?: string; ext: string; type: string; size: string };
export type Lesson = {
	path: string;
	title: string;
	video: string | null;
	section: string | null;
	sectionTitle: string | null;
	attachments: Attachment[];
};
export type Level = 'Beginner' | 'Intermediate' | 'Advanced';
export type Course = {
	slug: string;
	path: string;
	title: string;
	description: string | null;
	image: string | null;
	level: Level | null;
	summary: string;
	filter: string;
	lessons: Lesson[];
	/** `sidebar.hidden` lessons: only their own pages use these. */
	hiddenLessons: Lesson[];
	attachments: Attachment[];
};
export type Pathway = {
	id: string;
	path: string;
	title: string;
	description: string | null;
	level: Level | null;
	image: string | null;
	courses: string[];
	summary: string;
	courseSummary: string;
	filter: string;
};
export type Machine = { name: string; os: string; role: string | null; network: string | null; domainJoined: boolean };
/** A pro lab flag as the site gets it (scripts/lab-flags.mjs): never its value, only its hash. */
export type LabFlag = { id: string; machine: string | null; label: string; hash: string };
export type Lab = {
	slug: string;
	path: string;
	title: string;
	description: string | null;
	level: Level | null;
	image: string | null;
	environment: 'domain' | 'standalone';
	domain: string | null;
	entryPoint: string;
	flags: number;
	/** The lab's flags, if content/lab-flags/<slug>.yml has them (else learners can't submit flags). */
	flagList: LabFlag[];
	machines: Machine[];
	skills: string[];
	summary: string;
	osCounts: [string, number][];
	filter: string;
};
/** A glossary term. Not in the catalogue: the glossary routes get them as route data (plugins/lms-content.mjs). */
export type GlossaryEntry = { id: string; term: string; aliases: string[]; definition: string; seeAlso: { id: string; term: string }[] };
export type Catalog = {
	site: { description: string };
	courses: Course[];
	pathways: Pathway[];
	labs: Lab[];
	/** Site guide page path → its downloads (only pages that have some). */
	guideAttachments: Record<string, Attachment[]>;
	/** Page path (no trailing slash) → ISO dates. */
	dates: Record<string, { created?: string; updated?: string }>;
	/** Old page path → new path, for moved pages. */
	aliases: Record<string, string>;
};

export function useCatalog(): Catalog {
	return usePluginData('lms-content') as Catalog;
}

export { normalise };

/** Lookups by slug, path or id, built once per catalogue (the global data never changes in a page's lifetime). */
type Index = {
	courseBySlug: Map<string, Course>;
	/** Every lesson, hidden ones too, with its course. */
	lessonByPath: Map<string, { lesson: Lesson; course: Course }>;
	labByPath: Map<string, Lab>;
	pathwayById: Map<string, Pathway>;
};
const indexes = new WeakMap<Catalog, Index>();

function indexOf(catalog: Catalog): Index {
	let index = indexes.get(catalog);
	if (!index) {
		index = {
			courseBySlug: new Map(catalog.courses.map((c) => [c.slug, c])),
			lessonByPath: new Map(catalog.courses.flatMap((course) => [...course.lessons, ...course.hiddenLessons].map((lesson) => [lesson.path, { lesson, course }] as const))),
			labByPath: new Map(catalog.labs.map((l) => [l.path, l])),
			pathwayById: new Map(catalog.pathways.map((p) => [p.id, p])),
		};
		indexes.set(catalog, index);
	}
	return index;
}

/** The course a page belongs to (overview or lesson), by path. */
export function courseOf(catalog: Catalog, path: string): Course | undefined {
	const slug = normalise(path).match(/^\/courses\/([^/]+)/)?.[1];
	return slug === undefined ? undefined : indexOf(catalog).courseBySlug.get(slug);
}

/** A lesson (listed or hidden) and its course, by the lesson's path. */
export const lessonOf = (catalog: Catalog, path: string) => indexOf(catalog).lessonByPath.get(normalise(path));

/** A pro lab by its page path. */
export const labOf = (catalog: Catalog, path: string) => indexOf(catalog).labByPath.get(normalise(path));

/** A pathway by id. */
export const pathwayOf = (catalog: Catalog, id: string | undefined) => (id === undefined ? undefined : indexOf(catalog).pathwayById.get(id));

/** A pathway's courses, in its order. */
export const pathwayCourses = (catalog: Catalog, pathway: Pathway) =>
	pathway.courses.map((slug) => indexOf(catalog).courseBySlug.get(slug)).filter((c): c is Course => c !== undefined);

/** A course's lesson paths in order. */
export const lessonPaths = (course: Course) => course.lessons.map((l) => l.path);

/** Every lesson path in a pathway, course by course. */
export const pathwayLessons = (catalog: Catalog, pathway: Pathway) => pathwayCourses(catalog, pathway).flatMap(lessonPaths);

export const withSlash = (path: string) => `${normalise(path)}/`;

/** A course overview path (/courses/<course>/), or undefined. */
export const overviewSlug = (path: string) => normalise(path).match(/^\/courses\/([^/]+)$/)?.[1];

/**
 * A course overview's link from inside the course (the sidebar's Overview, the first lesson's
 * Previous): the overview then keeps the course's own sidebar instead of the course list
 * (src/theme/DocRoot/Layout).
 */
export const inCourseHref = (overview: string) => `${withSlash(overview)}?view=course`;
