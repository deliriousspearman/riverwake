// The colour themes a visitor can pick (the navbar's theme menu, src/theme/ColorModeToggle, and the
// Settings page). Each is a light or dark base: Docusaurus's colour mode (<html data-theme>) still
// says which, so everything written for light and dark mode (Prism, Mermaid, `[data-theme='light']`
// rules) keeps working. Hacklab Night and Hacklab Day are the site theme's own colours
// (content/settings/theme.yml, src/css/site/theme.css); every other palette is a preference,
// `palette` (src/lib/preferences.ts), set on <html> as data-lms-palette, whose colours are in
// src/css/site/palettes.css. Ids are short and plain ([a-z0-9]): src/head/preferences.js only sets
// values like that.
//
// A new palette: add it here and add its block to palettes.css (tests/site.test.mjs checks both
// lists match, every variable is set, and the text is readable).

export type Base = 'light' | 'dark';
export type Palette = { id: string; label: string; base: Base };

/** In menu order: the site's own two, then the others, darks first. */
export const PALETTES: readonly Palette[] = [
	{ id: 'night', label: 'Hacklab Night', base: 'dark' },
	{ id: 'day', label: 'Hacklab Day', base: 'light' },
	{ id: 'dracula', label: 'Dracula', base: 'dark' },
	{ id: 'mocha', label: 'Catppuccin Mocha', base: 'dark' },
	{ id: 'tokyo', label: 'Tokyo Night', base: 'dark' },
	{ id: 'nord', label: 'Nord', base: 'dark' },
	{ id: 'gruvbox', label: 'Gruvbox Dark', base: 'dark' },
	{ id: 'onedark', label: 'One Dark', base: 'dark' },
	{ id: 'solardark', label: 'Solarized Dark', base: 'dark' },
	{ id: 'contrast', label: 'High Contrast', base: 'dark' },
	{ id: 'latte', label: 'Catppuccin Latte', base: 'light' },
	{ id: 'solarlight', label: 'Solarized Light', base: 'light' },
];

/** The site theme's own colours: no `palette` preference, just Docusaurus's light or dark mode. */
export const SITE_PALETTES: Record<Base, string> = { dark: 'night', light: 'day' };

/** The palettes stored as a preference (all but the site's own two). */
export const STORED_PALETTES = PALETTES.map((palette) => palette.id).filter((id) => !Object.values(SITE_PALETTES).includes(id));

/** The palette showing, from the `palette` preference and Docusaurus's colour mode. */
export function currentPalette(stored: string | undefined, colorMode: Base): Palette {
	return PALETTES.find((palette) => palette.id === stored && STORED_PALETTES.includes(stored)) ?? paletteById(SITE_PALETTES[colorMode]);
}

export function paletteById(id: string): Palette {
	return PALETTES.find((palette) => palette.id === id) ?? PALETTES[0];
}

/** What choosing `id` changes: the preference (undefined for the site's own two) and the colour mode. */
export function paletteChoice(id: string): { palette: string | undefined; colorMode: Base } {
	const palette = paletteById(id);
	return { palette: STORED_PALETTES.includes(palette.id) ? palette.id : undefined, colorMode: palette.base };
}
