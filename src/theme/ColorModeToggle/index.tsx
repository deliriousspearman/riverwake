// Replaces Docusaurus's light/dark/system button with a dropdown of the colour themes
// (src/lib/palettes.ts): an icon (sun or moon, for the theme's light or dark base), the current
// theme's name and a caret, opening a native <select>. Choosing one sets the `palette` preference
// (none for Hacklab Night and Day, the site's own colours) and Docusaurus's colour mode to the
// theme's base.
//
// Pages are built ahead of time, so the server can't know a visitor's choice. The visible icon and
// label are therefore picked by CSS (src/css/site/navbar.css) from <html data-theme> and
// data-lms-palette, which are set before the page is painted (by Docusaurus and
// src/head/preferences.js), so the right name shows even before React starts; the <select> on top
// of them (transparent) does the choosing, with its own label for screen readers.
import React, { useEffect } from 'react';
import clsx from 'clsx';
import useIsBrowser from '@docusaurus/useIsBrowser';
import IconLightMode from '@theme/Icon/LightMode';
import IconDarkMode from '@theme/Icon/DarkMode';
import type { Props } from '@theme/ColorModeToggle';
import { currentPalette, paletteChoice, PALETTES } from '../../lib/palettes';
import { setPreferences, usePreferences } from '../../lib/preferences';

const GROUPS = [
	['dark', 'Dark'],
	['light', 'Light'],
] as const;

function ColorModeToggle({ className, value, onChange }: Props) {
	const isBrowser = useIsBrowser();
	const { palette } = usePreferences();
	const mode = value === 'light' ? 'light' : 'dark';
	const current = currentPalette(palette, mode);
	// A theme set without its base (restored from a backup, or chosen in another tab before this one
	// heard about the mode): switch to the base, so light/dark rules, Prism and Mermaid match.
	useEffect(() => {
		if (current.base !== mode) onChange(current.base);
	}, [current.base, mode, onChange]);
	const choose = (id: string) => {
		const choice = paletteChoice(id);
		setPreferences({ palette: choice.palette });
		onChange(choice.colorMode);
	};
	return (
		<label className={clsx('lms-theme-select', className)}>
			<span className="lms-theme-icon" aria-hidden="true">
				<IconDarkMode data-choice="dark" />
				<IconLightMode data-choice="light" />
			</span>
			<span className="lms-theme-label" aria-hidden="true">
				{PALETTES.map((option) => (
					<span key={option.id} data-palette={option.id}>
						{option.label}
					</span>
				))}
			</span>
			<svg className="lms-theme-caret" aria-hidden="true" viewBox="0 0 24 24" width="16" height="16">
				<path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
			</svg>
			<select aria-label="Colour theme" value={current.id} disabled={!isBrowser} onChange={(event) => choose(event.target.value)}>
				{GROUPS.map(([base, label]) => (
					<optgroup key={base} label={label}>
						{PALETTES.filter((option) => option.base === base).map((option) => (
							<option key={option.id} value={option.id}>
								{option.label}
							</option>
						))}
					</optgroup>
				))}
			</select>
		</label>
	);
}

export default React.memo(ColorModeToggle);
