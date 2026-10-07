// Mermaid diagrams (```mermaid blocks) in the site's colours: src/theme/Mermaid draws each diagram
// with mermaidConfig(), which reads the colours, body font, outline width and corner radius of the
// selected theme (content/settings/theme.yml), colour mode and visitor's colour theme from the page's
// CSS variables (src/css/site/theme.css, palettes.css and src/css/themes/), so diagrams follow
// whichever theme is chosen. Mermaid
// needs real colours, not var(--…), to work out its own shades.
//
// Lessons can mark flowchart nodes with two classes, no `classDef` needed:
//   web01:::highlight   the node the lesson is about (accent outline)
//   attacker:::attack   an attacker or attack step (red outline)
import type { MermaidConfig } from 'mermaid';

type Palette = {
	dark: boolean;
	panel: string;
	node: string;
	subtle: string;
	text: string;
	muted: string;
	border: string;
	line: string;
	accent: string;
	accentLow: string;
	red: string;
	font: string;
	outline: string;
	radius: string;
};

// Palette entry → the CSS variable it comes from, and Hacklab's dark value if the variable is missing.
const VARIABLES: Record<Exclude<keyof Palette, 'dark'>, [string, string]> = {
	panel: ['--lms-panel', '#1a2332'],
	node: ['--lms-panel-2', '#202c3f'],
	subtle: ['--sl-color-black', '#111927'],
	text: ['--sl-color-gray-1', '#e4e9f4'],
	muted: ['--sl-color-gray-2', '#a4b1cd'],
	border: ['--sl-color-gray-4', '#52627f'],
	line: ['--sl-color-gray-3', '#8494b5'],
	accent: ['--sl-color-accent', '#9fef00'],
	accentLow: ['--sl-color-accent-low', '#2a3d12'],
	red: ['--lms-hard', '#ff3e3e'],
	// The page's body font, already loaded, so Mermaid measures labels with the font they're drawn in.
	font: ['--sl-font', "'Figtree Variable', sans-serif"],
	outline: ['--lms-border-width', '2px'],
	radius: ['--lms-radius-sm', '0px'],
};

/** The current theme's values, read from the page (call it in the browser, once the colour mode is applied). */
function readPalette(): Palette {
	const style = getComputedStyle(document.documentElement);
	const entries = Object.entries(VARIABLES).map(([key, [variable, fallback]]) => [key, style.getPropertyValue(variable).trim() || fallback]);
	return { dark: document.documentElement.dataset.theme !== 'light', ...Object.fromEntries(entries) } as Palette;
}

/** Mermaid's config for the theme and colour mode the page shows now. */
export const mermaidConfig = (): MermaidConfig => config(readPalette());

function config(p: Palette): MermaidConfig {
	return {
		startOnLoad: false,
		// Labels are text only: no HTML, links or click handlers from the diagram source.
		securityLevel: 'strict',
		theme: 'base',
		fontFamily: p.font,
		themeVariables: {
			darkMode: p.dark,
			fontFamily: p.font,
			fontSize: '15px',
			background: p.panel,
			primaryColor: p.node,
			primaryTextColor: p.text,
			primaryBorderColor: p.border,
			secondaryColor: p.subtle,
			secondaryTextColor: p.text,
			secondaryBorderColor: p.border,
			tertiaryColor: p.subtle,
			tertiaryTextColor: p.text,
			tertiaryBorderColor: p.border,
			lineColor: p.line,
			textColor: p.text,
			mainBkg: p.node,
			nodeBorder: p.border,
			clusterBkg: p.subtle,
			clusterBorder: p.border,
			titleColor: p.text,
			edgeLabelBackground: p.panel,
			noteBkgColor: p.accentLow,
			noteTextColor: p.text,
			noteBorderColor: p.accent,
			actorBkg: p.node,
			actorBorder: p.border,
			actorTextColor: p.text,
			actorLineColor: p.line,
			signalColor: p.muted,
			signalTextColor: p.text,
			labelBoxBkgColor: p.node,
			labelBoxBorderColor: p.border,
			labelTextColor: p.text,
			loopTextColor: p.text,
			activationBkgColor: p.subtle,
			activationBorderColor: p.border,
			sequenceNumberColor: p.panel,
		},
		// The theme's outline width and corner radius, and the two node classes.
		themeCSS: `
			.node rect, .node polygon, .node circle, .node path, .cluster rect, rect.actor, .note { stroke-width: ${p.outline}; }
			.node rect, .cluster rect, rect.actor { rx: ${p.radius}; ry: ${p.radius}; }
			.node.highlight rect, .node.highlight polygon, .node.highlight circle, .node.highlight path { stroke: ${p.accent}; }
			.node.attack rect, .node.attack polygon, .node.attack circle, .node.attack path { stroke: ${p.red}; }
			.flowchart-link, .messageLine0, .messageLine1 { stroke-width: ${p.outline}; }
		`,
	};
}


/**
 * Roughly how tall a diagram will be once drawn (px, its panel included), from its source, for the
 * placeholder src/theme/Mermaid shows until Mermaid has drawn it, so the page below doesn't jump as
 * much when it appears. Top-to-bottom flowcharts and state diagrams grow with each arrow, sequence
 * diagrams with each line; left-to-right flowcharts stay short. Measured on the site guide's
 * diagrams; a wrong guess only means a smaller jump.
 */
export function estimatedHeight(source: string): number {
	const lines = source.split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('%%'));
	const first = lines[0] ?? '';
	const arrows = lines.filter((line) => /--|->|==>|-\.->/.test(line)).length;
	const clamp = (px: number) => Math.round(Math.min(Math.max(px, 160), 760));
	if (/^(flowchart|graph)\s+(LR|RL)\b/.test(first)) return clamp(140 + 30 * arrows);
	if (/^(flowchart|graph)\b/.test(first)) return clamp(150 + 100 * arrows);
	if (/^stateDiagram/.test(first)) return clamp(120 + 70 * arrows);
	if (/^sequenceDiagram/.test(first)) return clamp(60 + 36 * lines.length);
	return clamp(80 + 30 * lines.length);
}
