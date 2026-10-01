// Pathway cards (curated course sequences, content/pathways/*.yml): the first few on the home page
// (`limit`), all of them on /pathways/.
import React from 'react';
import Link from '@docusaurus/Link';
import clsx from 'clsx';
import { lessonPaths, pathwayCourses, pathwayLessons, useCatalog, withSlash, type Course, type Pathway } from '../lib/catalog';
import { CardList, completeText, LevelChip, LinkButton, Picture, ProgressRow, progressClasses, useSummary, type IsShown } from './Progress';

function PathwayCourse({ course }: { course: Course }) {
	const summary = useSummary(lessonPaths(course));
	return (
		<li className={progressClasses(summary)}>
			<Link to={withSlash(course.path)}>{course.title}</Link>
			<span className="pathway-course-count" data-progress-count>
				{summary.count === 0 ? course.summary : completeText(summary)}
			</span>
		</li>
	);
}

/** Memoised: typing in the filter only re-renders the cards it shows or hides. */
const PathwayCard = React.memo(function PathwayCard({ pathway, hidden }: { pathway: Pathway; hidden?: boolean }) {
	const catalog = useCatalog();
	const summary = useSummary(pathwayLessons(catalog, pathway), 'Start pathway →');
	return (
		<article className={clsx('pathway-card', progressClasses(summary))} data-filter={pathway.filter} data-level={pathway.level?.toLowerCase()} hidden={hidden}>
			<header>
				<div className="card-title">
					<Picture src={pathway.image} />
					<h2>
						<Link to={withSlash(pathway.path)}>{pathway.title}</Link>
					</h2>
				</div>
				<LevelChip level={pathway.level} />
			</header>
			{pathway.description && <p>{pathway.description}</p>}
			<ol className="pathway-courses">
				{pathwayCourses(catalog, pathway).map((course) => (
					<PathwayCourse key={course.slug} course={course} />
				))}
			</ol>
			<footer>
				<ProgressRow summary={summary} label={`${pathway.title} progress`} empty={pathway.summary} />
				{summary.next && <LinkButton to={summary.next}>{summary.nextLabel}</LinkButton>}
			</footer>
		</article>
	);
});

export default function PathwayList({ limit, isShown }: { limit?: number; isShown?: IsShown }) {
	return (
		<CardList items={useCatalog().pathways} limit={limit} className="pathway-list" empty="No pathways published yet.">
			{(pathway) => <PathwayCard key={pathway.id} pathway={pathway} hidden={isShown ? !isShown(pathway) : undefined} />}
		</CardList>
	);
}
