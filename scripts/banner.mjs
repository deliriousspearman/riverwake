// Site banner (content/settings/banner.yml, edited in the CMS under "Site settings"): limits
// for the admin-set sizes, used by the banner schema in scripts/schema.mjs (keep the CMS fields in
// cms/config.yml in step), and the build-log warnings plugins/lms-content.mjs prints.

export const BANNER_FONT_SIZE = { min: 10, max: 32 }; // px
export const BANNER_HEIGHT = { min: 20, max: 120 }; // px
// WCAG AA for normal-size text. Below this the message is hard to read for many people.
export const BANNER_MIN_CONTRAST = 4.5;

/** Relative luminance of a #rrggbb colour (WCAG 2). */
function luminance(hex) {
	const [r, g, b] = [1, 3, 5].map((i) => {
		const c = parseInt(hex.slice(i, i + 2), 16) / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two #rrggbb colours, from 1 (none) to 21 (black on white). */
export function contrastRatio(a, b) {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}

/** Problems with switched-on banner settings, as build-log warnings (empty if none). */
export function bannerWarnings(banner) {
	if (!banner?.enabled) return [];
	if (!banner.message.trim()) return ['Site banner is switched on but has no message, so it is not shown.'];
	const ratio = contrastRatio(banner.backgroundColor, banner.textColor);
	if (ratio >= BANNER_MIN_CONTRAST) return [];
	return [
		`Site banner: text ${banner.textColor} on ${banner.backgroundColor} has a contrast of ${ratio.toFixed(1)}:1, ` +
			`below ${BANNER_MIN_CONTRAST}:1. Many people will find it hard to read: pick a darker or lighter text colour.`,
	];
}
