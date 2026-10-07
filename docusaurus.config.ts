// Docusaurus configuration for Codex, the course site.
// See CLAUDE.md for how the pieces fit together.
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import { themes as prismThemes } from 'prism-react-renderer';
import { courseRedirects, proLabsShown, readSettings } from './scripts/content.mjs';
import { toDocusaurus } from './scripts/frontmatter.mjs';
import { selectedTheme, themeStylesheets } from './scripts/themes.mjs';
import remarkDrawio from './plugins/remark-drawio.mjs';
import remarkGlossary from './plugins/remark-glossary.mjs';
import remarkLmsBlocks from './plugins/remark-lms-blocks.mjs';
import rehypeSafeHtml from './plugins/rehype-safe-html.mjs';

// Old paths of moved courses and lessons (`aliases` frontmatter) → their current page.
const moved = courseRedirects();
// The site theme ("Site settings → Theme" in the CMS, content/settings/theme.yml).
const theme = selectedTheme();
// The site banner ("Site settings → Banner"), validated by the lms-content plugin.
const banner = readSettings('banner');
const showBanner = banner.enabled === true && typeof banner.message === 'string' && banner.message.trim() !== '';
// Pro labs on or off ("Site settings → Features"). Off, their pages still build, but the navbar, search
// and sitemap leave them out (the footer and home page read it from the catalogue).
const showLabs = proLabsShown();

// "Edit this page" links (src/theme/DocItem/Paginator): each page's file in GitLab's editor. The same
// GitLab address and project as the admin editor (scripts/prepare.mjs).
const GITLAB_URL = (process.env.CMS_GITLAB_URL || process.env.CI_SERVER_URL || 'https://gitlab.example.com').replace(/\/$/, '');
const EDIT_BASE = `${GITLAB_URL}/${process.env.CI_PROJECT_PATH || 'group/codex'}/-/edit/${process.env.CMS_BRANCH || process.env.CI_DEFAULT_BRANCH || 'main'}/`;

const TITLE = 'Codex';
const DESCRIPTION = 'Free, self-paced cyber security courses.';
// A staging build (SITE_ENV=staging; the pipeline has no staging site for now): a strip on every
// page (src/theme/Root.tsx) and "(staging)" in the tab title, so it's never mistaken for the live site.
const STAGING = process.env.SITE_ENV === 'staging';

// The site only works at the root of its domain (links, /videos/, /vendor/ and saved progress all
// use root paths). GitLab Pages without a unique domain serves projects under /<project>/, which
// would build a site whose scripts and links 404, so stop here instead.
const SITE_URL = process.env.SITE_URL || 'http://localhost:3000';
if (new URL(SITE_URL).pathname.replace(/\/$/, '') !== '') {
	throw new Error(
		`SITE_URL ${SITE_URL} has a path; the site must be served at the root of a domain ` +
			'(GitLab Pages: turn on "Use unique domain" under Deploy → Pages, or set a custom domain).',
	);
}

const config: Config = {
	title: STAGING ? `${TITLE} (staging)` : TITLE,
	tagline: DESCRIPTION,
	// Keep the staging site out of search engines.
	noIndex: STAGING,
	favicon: 'favicon.svg',
	// Public URL of the site, e.g. https://learn.example.com (set in the environment when deploying).
	url: SITE_URL,
	baseUrl: '/',
	// Pages at /courses/<course>/<lesson>/, with a trailing slash.
	trailingSlash: true,
	onBrokenLinks: 'throw',
	// Docusaurus's "wrong baseUrl" warning is an inline script on the home page; baseUrl is always
	// "/" here (SITE_URL is checked above), and the page's CSP only allows Docusaurus's theme script.
	baseUrlIssueBanner: false,
	future: {
		// Docusaurus v4 behaviour, except CSS cascade layers: with them, Infima's rules are given
		// extra specificity that the site's stylesheets (plain `:root` variables, class selectors)
		// can't override without `!important` everywhere.
		v4: { removeLegacyPostBuildHeadAttribute: true, useCssCascadeLayers: false, siteStorageNamespacing: true, fasterByDefault: true, mdx1CompatDisabledByDefault: true },
		// Rspack and SWC: much faster builds (@docusaurus/faster).
		faster: true,
	},
	i18n: { defaultLocale: 'en', locales: ['en'] },

	markdown: {
		// .md files are CommonMark (no JSX); .mdx files are MDX.
		format: 'detect',
		// ```mermaid blocks become diagrams, drawn in the browser (src/theme/Mermaid, src/lib/mermaid.ts).
		mermaid: true,
		hooks: { onBrokenMarkdownLinks: 'throw' },
		// The pages keep their own frontmatter; map what Docusaurus needs (scripts/frontmatter.mjs).
		parseFrontMatter: async (params) => {
			const result = await params.defaultParseFrontMatter(params);
			return { ...result, frontMatter: toDocusaurus(result.frontMatter, params.filePath) };
		},
	},

	presets: [
		[
			'classic',
			{
				docs: {
					path: 'docs',
					// Courses, labs and the guide at /courses/…, /labs/… and /guide/….
					routeBasePath: '/',
					sidebarPath: './sidebars.ts',
					// Keep "01-" prefixes in URLs and ids (section folders are numbered).
					numberPrefixParser: false,
					// Quiz, exercise, recording and terminal blocks, draw.io diagrams (.drawio.svg) put into the
					// page, then glossary terms (not inside those).
					beforeDefaultRemarkPlugins: [remarkLmsBlocks, remarkDrawio, remarkGlossary],
					// Raw HTML that could run script (<script>, onerror=…, javascript: links) fails the build.
					rehypePlugins: [rehypeSafeHtml],
					// Dates come from the lms-content plugin (course overviews use the newest lesson's).
					showLastUpdateTime: false,
					breadcrumbs: true,
				},
				blog: false,
				theme: { customCss: themeStylesheets(theme) },
				sitemap: { lastmod: null, ignorePatterns: showLabs ? [] : ['/labs/**'] },
			} satisfies Preset.Options,
		],
	],

	plugins: [
		'./plugins/lms-content.mjs',
		'./plugins/lms-csp.mjs',
		[
			'@docusaurus/plugin-client-redirects',
			{ redirects: Object.entries(moved).map(([from, to]) => ({ from: `${from}/`, to: `${to}/` })) },
		],
	],

	themes: [
		'@docusaurus/theme-mermaid',
		[
			'@easyops-cn/docusaurus-search-local',
			{
				indexDocs: true,
				indexBlog: false,
				// Lessons and labs are docs, indexed by heading. Other pages are indexed whole, one result
				// each: of those, only the glossary's term pages (/glossary/<id>/), so searching a term
				// finds its definition. The catalogue lists would only repeat the courses' own text, and
				// the Settings page has nothing to find.
				// Labs only while they're switched on.
				docsRouteBasePath: showLabs ? ['courses', 'labs'] : ['courses'],
				indexPages: true,
				ignoreFiles: ['glossary', 'settings', /^pathways(\/|$)/, ...(showLabs ? [] : [/^labs(\/|$)/])],
				// On staging every page is `noindex` (for search engines), which this would otherwise skip.
				forceIgnoreNoIndex: STAGING,
				language: ['en'],
				// No typo tolerance: combined with prefix matching on the word being typed, one wrong
				// letter let short terms match unrelated words ("arin" found "bring" and "print").
				// Prefixes still match ("kerb" finds Kerberos).
				fuzzyMatchingDistance: 0,
				hashed: true,
				highlightSearchTermsOnTargetPage: false,
				searchBarShortcutHint: true,
				// Glossary tooltips are in the page HTML (plugins/remark-glossary.mjs): keep their
				// definitions out of the search results' text.
				// The site footer is the same on every page. A term page's "See also" and back link would
				// make it a result for the other terms it names.
				ignoreCssSelectors: ['.glossary-tip', '.site-footer', '.glossary-see', '.glossary-term-back'],
			},
		],
	],

	// This browser's preferences (text size, width, …: the Settings page) on <html> before the page
	// is drawn. A file, not an inline script: the page policy allows no inline scripts of our own.
	headTags: [{ tagName: 'script', attributes: { src: '/head/preferences.js' } }],

	// Browser scripts for the content blocks.
	clientModules: ['./src/client/quiz.ts', './src/client/glossary.ts', './src/client/asciinema.ts', './src/client/copy.ts', './src/client/zoom.ts', './src/client/toc-scroll.ts'],

	themeConfig: {
		// Link-preview picture for every page without a PNG/JPEG/WebP one of its own (source:
		// templates/social-card/codex-card.svg).
		image: 'images/social/codex.png',
		// Dark (Hacklab Night) for everyone at first, whatever the device prefers; the theme menu
		// (src/theme/ColorModeToggle) offers the other colour themes, each light or dark underneath.
		colorMode: { defaultMode: 'dark', respectPrefersColorScheme: false },
		docs: { sidebar: { hideable: true, autoCollapseCategories: false } },
		navbar: {
			title: TITLE,
			items: [
				{ to: '/courses/', label: 'Courses', position: 'left', activeBaseRegex: '^/courses/' },
				{ to: '/pathways/', label: 'Pathways', position: 'left', activeBaseRegex: '^/pathways/' },
				...(showLabs ? [{ to: '/labs/', label: 'Pro Labs', position: 'left' as const, activeBaseRegex: '^/labs/' }] : []),
				{ to: '/glossary/', label: 'Glossary', position: 'left', activeBaseRegex: '^/glossary/' },
				{ type: 'search', position: 'right' },
			],
		},
		...(showBanner
			? {
					announcementBar: {
						id: `banner-${banner.message.length}`,
						content: banner.message.replace(/&/g, '&amp;').replace(/</g, '&lt;'),
						backgroundColor: banner.backgroundColor ?? '#ffaf00',
						textColor: banner.textColor ?? '#0e1a02',
						isCloseable: false,
					},
				}
			: {}),
		tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
		prism: {
			theme: prismThemes.nightOwlLight,
			darkTheme: prismThemes.nightOwl,
			additionalLanguages: ['bash', 'powershell', 'nginx', 'python', 'sql', 'yaml'],
		},
	} satisfies Preset.ThemeConfig,

	customFields: {
		staging: STAGING,
		editBase: EDIT_BASE,
		// Banner size and weight: Docusaurus's announcement bar only takes colours
		// (src/theme/AnnouncementBar applies these).
		banner: showBanner
			? { fontSize: banner.fontSize ?? 15, height: banner.height ?? 40, bold: banner.bold ?? true, italic: banner.italic ?? false }
			: null,
	},
};

export default config;
