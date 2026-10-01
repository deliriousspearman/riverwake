// Home page "Continue learning" banner for returning visitors: resumes the last lesson visited, or
// the next unfinished one in its course (wrapping round to any skipped earlier).
import React from 'react';
import { lessonOf, useCatalog } from '../lib/catalog';
import { isDoneIn, useLastLesson, useProgressMap } from '../lib/progress';
import { completeText, LinkButton } from './Progress';

export default function ContinueBanner() {
	const catalog = useCatalog();
	const progress = useProgressMap();
	const lastLesson = useLastLesson();
	const found = lastLesson ? lessonOf(catalog, lastLesson) : undefined;
	// Hidden lessons aren't part of the course's order, so they can't be resumed from here.
	const course = found && found.course.lessons.includes(found.lesson) ? found.course : undefined;
	const lesson = course && found?.lesson;
	const from = course && lesson ? course.lessons.indexOf(lesson) : 0;
	const ordered = course ? [...course.lessons.slice(from), ...course.lessons.slice(0, from)] : [];
	const target = ordered.find((l) => !isDoneIn(progress, l.path));
	if (!course || !target) return null;
	const count = course.lessons.filter((l) => isDoneIn(progress, l.path)).length;
	return (
		<section className="continue-banner not-content" aria-labelledby="continue-heading">
			<div className="continue-text">
				<h2 id="continue-heading">Continue learning</h2>
				<p>
					<span>{course.title}</span>
					<span className="continue-sep" aria-hidden="true">
						›
					</span>
					<strong>{target.title}</strong>
				</p>
				<p className="continue-count">{completeText({ count, total: course.lessons.length })}</p>
			</div>
			<LinkButton to={`${target.path}/`}>{target === lesson ? 'Resume lesson →' : 'Next lesson →'}</LinkButton>
		</section>
	);
}
