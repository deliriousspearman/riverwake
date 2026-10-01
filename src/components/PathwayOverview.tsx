// A pathway's overview page (/pathways/<id>/): level, size, overall progress with a Start/Continue
// button, then its courses as numbered steps, each with its own progress and a Continue link.
import React from 'react';
import clsx from 'clsx';
import { pathwayCourses, pathwayLessons, useCatalog, type Pathway } from '../lib/catalog';
import { CourseProgressCard, LevelChip, LinkButton, ProgressRow, progressClasses, useSummary } from './Progress';

export default function PathwayOverview({ pathway }: { pathway: Pathway }) {
	const catalog = useCatalog();
	const summary = useSummary(pathwayLessons(catalog, pathway), 'Start pathway →');
	return (
		<section className={clsx('pathway-overview not-content', progressClasses(summary))}>
			<div className="pathway-meta">
				<LevelChip level={pathway.level} />
				<span>{pathway.courseSummary}</span>
			</div>
			{pathway.description && <p className="pathway-lead">{pathway.description}</p>}
			<div className="pathway-progress">
				<ProgressRow summary={summary} label={`${pathway.title} progress`} empty="Not started yet" />
				{summary.next && <LinkButton to={summary.next}>{summary.nextLabel}</LinkButton>}
			</div>
			<h2>Courses in this pathway</h2>
			<ol className="pathway-steps">
				{pathwayCourses(catalog, pathway).map((course) => (
					<CourseProgressCard key={course.slug} course={course} as="li" className="pathway-step" heading="h3" />
				))}
			</ol>
		</section>
	);
}
