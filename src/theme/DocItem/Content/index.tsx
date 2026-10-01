// Wraps Docusaurus's DocItem/Content (the page text) with the site's additions:
// - the title with the course or lab picture beside it and the page dates underneath (the default
//   title is hidden with `hide_title`, set by scripts/frontmatter.mjs);
// - lessons: the video and the lesson's downloads above the text (site guide pages can have them too,
//   to show how they look);
// - course overviews: the lesson checklist with Start/Continue and all the course's downloads after it;
// - pro labs: the stats tiles and the "Submit a flag" panel above the scenario (src/components/
//   LabFlags.tsx), and the machines, flags and skills after it.
import React from 'react';
import Content from '@theme-original/DocItem/Content';
import type ContentType from '@theme/DocItem/Content';
import type { WrapperProps } from '@docusaurus/types';
import { useDoc } from '@docusaurus/plugin-content-docs/client';
import { courseOf, labOf, lessonOf, normalise, useCatalog } from '../../../lib/catalog';
import { CourseDownloads, LabDetails, LabSummary, LessonDownloads, LessonList, LessonVideo, PageHeader, pageKind } from '../../../components/DocParts';
import { LabFlagPanel } from '../../../components/LabFlags';

type Props = WrapperProps<typeof ContentType>;

export default function ContentWrapper(props: Props) {
	const { metadata, frontMatter } = useDoc();
	const catalog = useCatalog();
	const path = normalise(metadata.permalink);
	const kind = pageKind(path);
	const course = kind === 'course' ? courseOf(catalog, path) : undefined;
	const lab = kind === 'lab' ? labOf(catalog, path) : undefined;
	const lesson = kind === 'lesson' ? lessonOf(catalog, path)?.lesson : undefined;
	const downloads = lesson?.attachments ?? (kind === 'guide' ? catalog.guideAttachments[path] : undefined);
	// An SVG picture is under `picture` (scripts/frontmatter.mjs keeps it out of link previews).
	const fm = frontMatter as { video?: string; captions?: string; image?: string; picture?: string };
	const image = kind === 'course' || kind === 'lab' ? (fm.picture ?? fm.image ?? null) : null;

	return (
		<div className={kind ? `lms-doc lms-doc-${kind}` : undefined}>
			<PageHeader title={metadata.title} permalink={metadata.permalink} image={image} />
			{(kind === 'lesson' || kind === 'guide') && fm.video && <LessonVideo src={fm.video} captions={fm.captions} />}
			{downloads && <LessonDownloads items={downloads} />}
			{lab && <LabSummary lab={lab} />}
			{lab && <LabFlagPanel lab={lab} />}
			<Content {...props} />
			{course && <LessonList course={course} />}
			{course && <CourseDownloads course={course} />}
			{lab && <LabDetails lab={lab} />}
		</div>
	);
}
