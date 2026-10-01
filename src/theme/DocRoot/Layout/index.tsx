// Wraps the docs layout. A course overview is part of the catalogue: opened from the course list it
// shows the list of courses in the sidebar (its `displayed_sidebar`, scripts/frontmatter.mjs). Opened
// from inside the course (`?view=course`, see inCourseHref in src/lib/catalog.ts) it keeps the
// course's own sidebar, so going back to the overview doesn't drop learners out of the course.
import React from 'react';
import Layout from '@theme-original/DocRoot/Layout';
import type LayoutType from '@theme/DocRoot/Layout';
import type { WrapperProps } from '@docusaurus/types';
import { useLocation } from '@docusaurus/router';
import useIsBrowser from '@docusaurus/useIsBrowser';
import { DocsSidebarProvider, useDocsVersion } from '@docusaurus/plugin-content-docs/client';
import { overviewSlug } from '../../../lib/catalog';

type Props = WrapperProps<typeof LayoutType>;

export default function LayoutWrapper(props: Props) {
	const { pathname, search } = useLocation();
	const { docsSidebars } = useDocsVersion();
	// Static pages are built without the query string: switch sidebars only once the page is running
	// in the browser (straight away when navigating within the site, just after load otherwise).
	const isBrowser = useIsBrowser();
	const slug = overviewSlug(pathname);
	const name = slug && isBrowser && new URLSearchParams(search).get('view') === 'course' ? `course-${slug}` : undefined;
	if (!name || !docsSidebars[name]) return <Layout {...props} />;
	return (
		<DocsSidebarProvider name={name} items={docsSidebars[name]}>
			<Layout {...props} />
		</DocsSidebarProvider>
	);
}
