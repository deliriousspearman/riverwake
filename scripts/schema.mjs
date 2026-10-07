// Content schemas (zod). Docusaurus only
// validates the frontmatter fields it knows about, so plugins/lms-content.mjs checks every course,
// lesson and lab page, pathway, glossary entry and the banner settings against these, and fails the
// build listing every problem. Keep the fields in cms/config.yml in sync with these.
//
// The page fields are the site's own names; scripts/frontmatter.mjs maps the few Docusaurus needs
// (sidebar.order → position).
import { existsSync, statSync } from 'node:fs';
import * as z from 'zod';
import { attachmentProblems } from './attachments.mjs';
import { BANNER_FONT_SIZE, BANNER_HEIGHT } from './banner.mjs';
import { captionProblems } from './captions.mjs';
import { STATIC_DIR } from './content.mjs';
import { OPERATING_SYSTEMS } from './labs.mjs';

// The CMS saves a field that was left empty as '' or null (e.g. `lastUpdated: ''`,
// `sections: null`). Treat those as "not set", so clearing a field in the CMS never fails the build.
const unset = (value) => (value === '' || value === null ? undefined : value);
const optional = (schema) => z.preprocess(unset, schema.optional());

// Pictures are shown at 72 px at most, so 256×256 is plenty. Files in static/ are served as they
// are (no resizing), so a large photo would be downloaded in full on every home page visit.
// Keep in sync with `max_file_size` on the picture fields in cms/config.yml.
export const PICTURE_MAX_KB = 200;

/** Picture fields are checked against static/ (`staticDir` is for tests). */
export const picture = (staticDir = STATIC_DIR) =>
	z
		.string()
		.regex(/^\/[\w./-]+\.(png|jpe?g|webp|avif|gif|svg)$/i, 'must be a path like /images/<name>.png')
		.refine((path) => !path.includes('..') && existsSync(`${staticDir}${path}`), {
			message: 'image not found under static/ — check the path',
		})
		.refine((path) => !existsSync(`${staticDir}${path}`) || statSync(`${staticDir}${path}`).size <= PICTURE_MAX_KB * 1024, {
			message: `image is larger than ${PICTURE_MAX_KB} KB: resize it to 256×256 (WebP, PNG or JPEG) and upload it again`,
		});

// A colour as #rrggbb (what the CMS colour picker saves). Lower-case for comparisons.
const hexColour = z
	.string()
	.regex(/^#[0-9a-fA-F]{6}$/, 'must be a colour like #ffaf00')
	.transform((colour) => colour.toLowerCase());

// Downloadable files for a course or lesson (scripts/attachments.mjs has the rules).
const attachments = z.array(
	z.object({
		file: z.string().superRefine((path, ctx) => {
			for (const message of attachmentProblems(path)) ctx.addIssue({ code: 'custom', message });
		}),
		title: z.string().min(1),
		description: optional(z.string()),
	}),
);

const level = z.enum(['Beginner', 'Intermediate', 'Advanced']);

/** Course overview, lesson and lab pages (docs/courses/**, docs/labs/*). */
export const pageSchema = z
	.object({
		title: z.string().min(1),
		description: optional(z.string()),
		draft: optional(z.boolean()),
		sidebar: optional(
			z.object({
				order: optional(z.number()),
				label: optional(z.string()),
				hidden: optional(z.boolean()),
			}),
		),
		// `course` = a course overview (courses/<slug>/index.md), `lesson` = a lesson page,
		// `lab` = a pro lab (labs/<slug>.md).
		kind: optional(z.enum(['course', 'lesson', 'lab'])),
		// Course or lab position on the home page and in the sidebar (lower first).
		order: optional(z.number()),
		// Course or lab picture (course index pages and labs only).
		image: optional(picture()),
		// Set to false to not mark glossary terms on this page (lessons and labs).
		glossary: optional(z.boolean()),
		attachments: optional(attachments),
		// Optional section titles, keyed by section folder name (scripts/sections.mjs).
		sections: optional(z.record(z.string(), z.string())),
		// Lesson video, e.g. /videos/<course>/<lesson>.mp4 (in git under static/videos/, via Git LFS).
		video: optional(
			z
				.string()
				.regex(/^\/videos\/[A-Za-z0-9/_.-]+\.(mp4|webm)$/, 'must look like /videos/<course>/<file>.mp4')
				.refine((path) => !path.includes('..'), 'must not contain ".."'),
		),
		// The video's captions, e.g. /captions/<course>/<lesson>.vtt (in git under static/; scripts/captions.mjs).
		captions: optional(
			z.string().superRefine((path, ctx) => {
				for (const message of captionProblems(path)) ctx.addIssue({ code: 'custom', message });
			}),
		),
		// Page dates. Optional overrides: otherwise taken from git history (scripts/dates.mjs).
		created: optional(z.coerce.date()),
		lastUpdated: optional(z.union([z.boolean(), z.coerce.date()])),
		// Pro lab fields. How they fit together is checked by labProblems in scripts/labs.mjs.
		level: optional(level),
		environment: optional(z.enum(['domain', 'standalone'])),
		domain: optional(z.string()),
		entryPoint: optional(z.string()),
		flags: optional(z.number().int().positive()),
		machines: optional(
			z.array(
				z.object({
					name: z.string(),
					os: z.enum(OPERATING_SYSTEMS),
					role: optional(z.string()),
					network: optional(z.string()),
					domainJoined: optional(z.boolean()),
				}),
			),
		),
		skills: optional(z.array(z.string())),
		// Old paths of this page after it was moved or renamed (redirects and progress, see
		// courseRedirects in scripts/content.mjs).
		aliases: optional(z.array(z.string().regex(/^\/courses\/[\w./-]+\/?$/, 'must be an old path like /courses/<course>/<lesson>'))),
	})
	// Other fields (e.g. Docusaurus's own) are allowed.
	.passthrough()
	.superRefine((data, ctx) => {
		if (data.captions && !data.video) ctx.addIssue({ code: 'custom', path: ['captions'], message: 'captions need a `video` on the same page' });
	});

/** Pathways: content/pathways/*.yml */
export const pathwaySchema = z.object({
	title: z.string(),
	description: optional(z.string()),
	level: optional(level),
	image: optional(picture()),
	order: optional(z.number()),
	// Course folder names (docs/courses/<name>), in the order to take them.
	courses: z.array(z.string()).min(1),
});

/** Glossary: content/glossary/*.yml */
export const glossarySchema = z.object({
	term: z.string().min(1),
	aliases: optional(z.array(z.string().min(1))),
	definition: z.string().min(1),
	seeAlso: optional(z.array(z.string())),
});

/**
 * Pages removed on purpose: content/settings/removed-pages.yml (scripts/removed-pages.mjs). Each
 * address also covers everything under it, so a course's address covers all its lessons.
 * `checkFrom` is the day the check starts (the site going live), as YYYY-MM-DD; unset, it's off.
 */
export const removedPagesSchema = z.object({
	checkFrom: optional(z.coerce.date().transform((date) => date.toISOString().slice(0, 10))),
	pages: optional(
		z.array(
			z.object({
				path: z
					.string()
					.regex(/^\/courses\/[\w./-]+$/, 'must be an old address like /courses/<course>/<lesson>')
					.refine((path) => !path.includes('..'), 'must not contain ".."'),
				reason: z.string().min(1),
			}),
		),
	),
});

/** Pro lab flags: content/lab-flags/<lab slug>.yml (scripts/lab-flags.mjs checks the rest). */
export const labFlagsSchema = z.object({
	// The lab's file name (the admin editor saves it; the build checks it matches the file's name).
	lab: optional(z.string().min(1)),
	flags: z
		.array(
			z.object({
				machine: optional(z.string().min(1)),
				label: z.string().min(1),
				flag: z.coerce.string().trim().min(1),
			}),
		)
		.min(1),
});

/** Site banner: content/settings/banner.yml */
export const bannerSchema = z.object({
	enabled: z.boolean().default(false),
	message: z.string().default(''),
	backgroundColor: hexColour.default('#ffaf00'),
	textColor: hexColour.default('#0e1a02'),
	fontSize: z.number().int().min(BANNER_FONT_SIZE.min).max(BANNER_FONT_SIZE.max).default(15),
	height: z.number().int().min(BANNER_HEIGHT.min).max(BANNER_HEIGHT.max).default(40),
	bold: z.boolean().default(true),
	italic: z.boolean().default(false),
});

/** Parts of the site that can be switched off: content/settings/features.yml */
export const featuresSchema = z.object({
	// Pro labs in the navbar, footer, home page, search and sitemap.
	proLabs: z.boolean().default(true),
});

/** Parse `data` with `schema`; throws one error listing every problem, prefixed with `where`. */
export function check(schema, data, where) {
	const result = schema.safeParse(data);
	if (result.success) return result.data;
	const problems = result.error.issues.map((issue) => `${issue.path.join('.') || '(file)'}: ${issue.message}`);
	throw new Error(`${where}:\n- ${problems.join('\n- ')}`);
}
