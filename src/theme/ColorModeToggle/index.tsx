// Replaces Docusaurus's light/dark/system button (which cycles through the three) with a dropdown
// with an icon, the current choice ("Dark", "Light" or "Auto")
// and a caret, opening a native <select>.
//
// Pages are built ahead of time, so the server can't know a visitor's choice. The visible icon and
// label are therefore picked by CSS from <html data-theme-choice>, which Docusaurus sets before the
// page is painted, so the right label shows even before React starts; the <select> on top of them
// (transparent) does the choosing, with its own label for screen readers.
import React from 'react';
import clsx from 'clsx';
import useIsBrowser from '@docusaurus/useIsBrowser';
import IconLightMode from '@theme/Icon/LightMode';
import IconDarkMode from '@theme/Icon/DarkMode';
import IconSystemColorMode from '@theme/Icon/SystemColorMode';
import type { Props } from '@theme/ColorModeToggle';

const AUTO = 'auto';

function ColorModeToggle({ className, respectPrefersColorScheme, value, onChange }: Props) {
	const isBrowser = useIsBrowser();
	return (
		<label className={clsx('lms-theme-select', className)}>
			<span className="lms-theme-icon" aria-hidden="true">
				<IconDarkMode data-choice="dark" />
				<IconLightMode data-choice="light" />
				<IconSystemColorMode data-choice="system" />
			</span>
			<span className="lms-theme-label" aria-hidden="true">
				<span data-choice="dark">Dark</span>
				<span data-choice="light">Light</span>
				<span data-choice="system">Auto</span>
			</span>
			<svg className="lms-theme-caret" aria-hidden="true" viewBox="0 0 24 24" width="16" height="16">
				<path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
			</svg>
			<select
				aria-label="Select theme"
				value={value ?? AUTO}
				disabled={!isBrowser}
				onChange={(event) => onChange(event.target.value === AUTO ? null : (event.target.value as 'light' | 'dark'))}
			>
				<option value="dark">Dark</option>
				<option value="light">Light</option>
				{respectPrefersColorScheme && <option value={AUTO}>Auto</option>}
			</select>
		</label>
	);
}

export default React.memo(ColorModeToggle);
