// Replaces Docusaurus's previous/next links on docs pages (same links, same component):
// - lesson pages get the "Complete & continue" button above them (src/components/LessonActions.tsx);
// - a Previous link from a lesson to its course overview keeps the course's sidebar (`?view=course`);
// - every docs page ends with the site footer, with an "Edit this page" link to the page's file in
//   GitLab's editor (for editors; `editBase` in docusaurus.config.ts).
import React from 'react';
import DocPaginator from '@theme/DocPaginator';
import { useDoc } from '@docusaurus/plugin-content-docs/client';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import LessonActions from '../../../components/LessonActions';
import SiteFooter from '../../../components/SiteFooter';
import { pageKind } from '../../../components/DocParts';
import { inCourseHref, overviewSlug } from '../../../lib/catalog';

export default function DocItemPaginator() {
	const { metadata } = useDoc();
	const editBase = useDocusaurusContext().siteConfig.customFields?.editBase as string | undefined;
	// `source` is the page's file, e.g. "@site/docs/courses/web/01-intro.md".
	const editUrl = editBase && metadata.source.startsWith('@site/') ? editBase + metadata.source.slice('@site/'.length) : undefined;
	const lesson = pageKind(metadata.permalink) === 'lesson';
	const { previous, next } = metadata;
	const toOverview = lesson && previous && overviewSlug(previous.permalink) !== undefined;
	return (
		<>
			{lesson && <LessonActions permalink={metadata.permalink} next={next?.permalink} />}
			<DocPaginator className="docusaurus-mt-lg" previous={toOverview ? { ...previous, permalink: inCourseHref(previous.permalink) } : previous} next={next} />
			<SiteFooter storageWarning={!lesson} editUrl={editUrl} />
		</>
	);
}
