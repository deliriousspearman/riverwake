// Wraps sidebar links:
// - a completed lesson gets `is-complete` (a tick, see src/css/site/sidebar.css);
// - a course sidebar's Overview link (class `sidebar-course-overview`, set in scripts/content.mjs)
//   keeps that sidebar on the overview (`?view=course`, see src/theme/DocRoot/Layout). Only the link
//   target changes: `item.href` stays as it is, so the link is still marked current there.
// It relies on the item alone, not on the sidebar context: on small screens Docusaurus renders the
// sidebar inside the navbar's menu, where that context isn't available.
import React from 'react';
import clsx from 'clsx';
import Link from '@theme-original/DocSidebarItem/Link';
import type LinkType from '@theme/DocSidebarItem/Link';
import type { WrapperProps } from '@docusaurus/types';
import { inCourseHref } from '../../../lib/catalog';
import { useIsDone } from '../../../lib/progress';

type Props = WrapperProps<typeof LinkType>;

export default function LinkWrapper(props: Props) {
	const { href, className } = props.item;
	// Re-renders only when this lesson's own state changes, not on every progress change.
	const done = useIsDone(href) && href.startsWith('/courses/');
	const overview = className?.split(' ').includes('sidebar-course-overview');
	return (
		<Link
			{...props}
			item={{ ...props.item, className: clsx(className, done && 'is-complete') }}
			// The original spreads extra props onto its <Link> after `to`, so this replaces the target.
			{...(overview ? { to: inCourseHref(href) } : {})}
		/>
	);
}
