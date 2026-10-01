// Wraps Docusaurus's breadcrumbs in the site's breadcrumb bar: the trail on the left and, on pages
// with an "On this page" column, a button on the right that collapses or shows it. The bar is pinned
// under the navbar unless "Pin the breadcrumb bar" is off in Settings (src/css/site/page-layout.css).
//
// The collapsed state is a preference (`toc: 'hidden'`, src/lib/preferences.ts), mirrored on <html>
// as data-lms-toc before the page is drawn, so the CSS hides the column and turns the button's icon
// and the tooltip's wording from the first frame; React only fills in the button's label for screen
// readers once the page is running. The button is an icon at the far right of the bar, after a
// separator, with its tooltip drawn by CSS (src/css/site/page-layout.css). The column only exists on
// wide screens (Docusaurus shows a dropdown inside the text on narrow ones), so the button and its
// separator are hidden there too.
import React from 'react';
import DocBreadcrumbs from '@theme-original/DocBreadcrumbs';
import type DocBreadcrumbsType from '@theme/DocBreadcrumbs';
import type { WrapperProps } from '@docusaurus/types';
import { useDoc, useSidebarBreadcrumbs } from '@docusaurus/plugin-content-docs/client';
import { setPreferences, usePreferences } from '../../lib/preferences';

type Props = WrapperProps<typeof DocBreadcrumbsType>;

function TocToggle() {
	const { toc } = usePreferences();
	const hidden = toc === 'hidden';
	return (
		<button
			type="button"
			className="lms-toc-toggle"
			aria-expanded={!hidden}
			aria-label={hidden ? 'Show “On this page”' : 'Hide “On this page”'}
			onClick={() => setPreferences({ toc: hidden ? undefined : 'hidden' })}
		>
			<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
				<rect x="3" y="4" width="18" height="16" rx="2" />
				<path d="M15 4v16" />
				<path className="lms-toc-toggle-arrow" d="M8 10l2 2-2 2" />
			</svg>
		</button>
	);
}

export default function DocBreadcrumbsWrapper(props: Props) {
	const breadcrumbs = useSidebarBreadcrumbs();
	const { toc, frontMatter } = useDoc();
	// The same test as Docusaurus's DocItem/Layout uses to show the column.
	const hasToc = !frontMatter.hide_table_of_contents && toc.length > 0;
	if (!breadcrumbs) return <DocBreadcrumbs {...props} />;
	return (
		<div className="lms-crumb-bar">
			<DocBreadcrumbs {...props} />
			{hasToc && <span className="lms-crumb-bar-sep" aria-hidden="true" />}
			{hasToc && <TocToggle />}
		</div>
	);
}
