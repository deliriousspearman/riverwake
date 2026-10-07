// Site themes. The theme is chosen in content/settings/theme.yml ("Site
// settings → Theme" in the CMS) and applied at build time: docusaurus.config.ts loads the theme's
// fonts, the site's stylesheets (src/css/site/, in SITE_STYLESHEETS order; theme.css's variables are
// Hacklab's values) and the theme's own stylesheet, which overrides only what it changes.
// Changing the theme needs a new build, so it goes live with the next deploy.
//
// To add a theme: add it here (fonts are @fontsource packages, which must be dependencies), add
// its stylesheet under src/css/themes/, and add it to the Theme options in cms/config.yml (keep
// the two lists the same). A theme can build on another by listing that theme's stylesheet first
// (see hardline-classic).
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { parse } from 'yaml';

const SETTINGS = new URL('../content/settings/theme.yml', import.meta.url);
const require = createRequire(import.meta.url);

export const DEFAULT_THEME = 'hacklab';

const FIGTREE = ['@fontsource-variable/figtree/index.css', '@fontsource-variable/figtree/wght-italic.css'];
const CHAKRA = ['@fontsource/chakra-petch/500.css', '@fontsource/chakra-petch/700.css'];
const MONO = ['@fontsource-variable/jetbrains-mono/index.css'];

export const THEMES = {
	hacklab: {
		label: 'Hacklab',
		description: 'Navy panels, lime accent, rounded corners, Chakra Petch headings.',
		fonts: [...CHAKRA, ...FIGTREE, ...MONO],
		stylesheets: [],
	},
	hardline: {
		label: 'Hardline',
		description: 'Hacklab with square corners, heavier outlines and monospace headings.',
		fonts: [...FIGTREE, ...MONO],
		stylesheets: ['./src/css/themes/hardline.css'],
	},
	'hardline-classic': {
		label: 'Hardline Classic',
		description: 'Hardline with Hacklab’s Chakra Petch headings and rounded toggle switches.',
		fonts: [...CHAKRA, ...FIGTREE, ...MONO],
		stylesheets: ['./src/css/themes/hardline.css', './src/css/themes/hardline-classic.css'],
	},
	nightshift: {
		label: 'Nightshift',
		description: 'Hacklab with a teal accent, rounder corners, soft glows and Figtree headings.',
		fonts: [...FIGTREE, ...MONO],
		stylesheets: ['./src/css/themes/nightshift.css'],
	},
};

/** The theme named in the settings file (`settingsFile` is for tests); Hacklab if none is set. */
export function selectedTheme(settingsFile = SETTINGS) {
	const settings = existsSync(settingsFile) ? (parse(readFileSync(settingsFile, 'utf8')) ?? {}) : {};
	const name = settings.theme ?? DEFAULT_THEME;
	if (!Object.hasOwn(THEMES, name)) {
		throw new Error(`Unknown theme "${name}" in content/settings/theme.yml. Use one of: ${Object.keys(THEMES).join(', ')}.`);
	}
	return name;
}

/**
 * The site's stylesheets (src/css/site/<name>.css), one per part of the site, in the order they load.
 * Order matters where two rules set the same thing: theme.css (the variables) first, then page
 * structure (navbar … banner), then components and blocks. A new file must be added here
 * (tests/site.test.mjs checks).
 */
export const SITE_STYLESHEETS = [
	'theme',
	'palettes',
	'navbar',
	'sidebar',
	'page-layout',
	'page-text',
	'code',
	'drawio',
	'timeline',
	'buttons',
	'splash',
	'catalogue-layout',
	'preferences',
	'banner',
	'recordings',
	'continue-banner',
	'quiz',
	'exercise',
	'video',
	'progress',
	'page-title',
	'hero-terminal',
	'catalogue',
	'pathway-steps',
	'lesson-list',
	'lesson-actions',
	'footer',
	'settings',
	'labs',
	'home',
	'pathway-overview',
	'downloads',
	'glossary',
	'glossary-terms',
	'zoom',
];

/** Docusaurus `customCss` for a theme: its fonts, the site's stylesheets, then the theme's own. */
export function themeStylesheets(name) {
	const { fonts, stylesheets } = THEMES[name];
	return [...fonts.map((font) => require.resolve(font)), ...SITE_STYLESHEETS.map((file) => `./src/css/site/${file}.css`), ...stylesheets];
}
