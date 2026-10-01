// Lesson pages: a "Complete & continue →" button above the previous/next links (marks the lesson
// complete and goes to the next lesson in the course; just "Mark as complete" on the last lesson).
// Once complete, the main action becomes "Next lesson →", with a small "Mark as not complete"
// link. On a course's last lesson, completing it shows an end-of-course panel instead: "Course
// complete" (or how many lessons are left), and what to take next in each pathway that includes
// the course. Hidden lessons get no button: they aren't in the course's lesson list.
import React, { useEffect, useMemo, useRef } from 'react';
import Link from '@docusaurus/Link';
import { useHistory } from '@docusaurus/router';
import clsx from 'clsx';
import { lessonOf, lessonPaths, normalise, pathwayCourses, useCatalog, withSlash } from '../lib/catalog';
import { canSave, markComplete, markIncomplete, recordLastLesson, useIsDone, useStorageWorks } from '../lib/progress';
import { completeText, progressClasses, useSummary } from './Progress';

export default function LessonActions({ permalink, next }: { permalink: string; next?: string }) {
	const catalog = useCatalog();
	const history = useHistory();
	const path = normalise(permalink);
	const found = lessonOf(catalog, path);
	const course = found?.course;
	const listed = !!found && found.course.lessons.includes(found.lesson);
	const done = useIsDone(path);
	const storageWorks = useStorageWorks();
	const summary = useSummary(course ? lessonPaths(course) : []);
	const isLast = !next;
	// The course that follows this one in each pathway, once per course (the first pathway names it).
	const nextUp = useMemo(() => {
		const map = new Map<string, { pathway: string; title: string; href: string }>();
		if (!isLast || !course) return map;
		for (const pathway of catalog.pathways) {
			const courses = pathwayCourses(catalog, pathway);
			const following = courses[courses.indexOf(course) + 1];
			if (courses.includes(course) && following && !map.has(following.slug)) map.set(following.slug, { pathway: pathway.title, title: following.title, href: withSlash(following.path) });
		}
		return map;
	}, [catalog, course, isLast]);
	const toggle = useRef<HTMLButtonElement>(null);
	const firstDoneAction = useRef<HTMLDivElement>(null);
	const focusAfter = useRef<'done' | 'toggle' | null>(null);

	// Lesson pages record themselves as the last lesson visited ("Continue learning" on the home page).
	useEffect(() => {
		if (listed) recordLastLesson(path);
	}, [listed, path]);

	// Keep keyboard focus nearby when the button that was pressed disappears.
	useEffect(() => {
		if (focusAfter.current === 'done') firstDoneAction.current?.querySelector<HTMLElement>('a, button')?.focus();
		if (focusAfter.current === 'toggle') toggle.current?.focus();
		focusAfter.current = null;
	}, [done]);

	if (!course || !listed) return null;

	return (
		<div className="lesson-complete">
			<button
				ref={toggle}
				type="button"
				className="lesson-action"
				hidden={done}
				onClick={() => {
					markComplete(path);
					// "Complete & continue": go straight on — unless progress can't be saved, in which case
					// leaving would lose it, so stay and show the warning.
					if (next && canSave()) history.push(next);
					else focusAfter.current = 'done';
				}}
			>
				{next ? 'Complete & continue →' : 'Mark as complete'}
			</button>
			<div className="lesson-done" hidden={!done} ref={firstDoneAction}>
				{next && (
					<Link className="lesson-action" to={next}>
						Next lesson →
					</Link>
				)}
				{isLast && (
					<section className={clsx('course-end', progressClasses(summary))} aria-labelledby="course-end-heading">
						<h2 id="course-end-heading">
							<span className="course-end-done">Course complete</span>
							<span className="course-end-open">End of course</span>
						</h2>
						<p className="course-end-summary">
							<strong>{course.title}</strong>
							<span className="continue-sep" aria-hidden="true">
								·
							</span>
							<span>{completeText(summary)}</span>
						</p>
						<p className="course-end-open">
							Some lessons aren’t marked complete yet. {summary.next && <Link to={summary.next}>Continue →</Link>}
						</p>
						{nextUp.size > 0 ? (
							<ul className="course-end-next">
								{[...nextUp.values()].map((n) => (
									<li key={n.href}>
										<span>Next in the {n.pathway} pathway</span>
										<Link className="lesson-action" to={n.href}>
											{n.title} →
										</Link>
									</li>
								))}
							</ul>
						) : (
							<p>
								<Link className="lesson-action" to="/courses/">
									Browse all courses →
								</Link>
							</p>
						)}
					</section>
				)}
				<p className="lesson-done-status">
					<span className="lesson-done-check" aria-hidden="true">
						✓
					</span>{' '}
					Lesson completed
					<button
						type="button"
						className="link-button"
						onClick={() => {
							markIncomplete(path);
							focusAfter.current = 'toggle';
						}}
					>
						Mark as not complete
					</button>
				</p>
			</div>
			<p className="storage-warning" role="status" hidden={storageWorks}>
				This browser is blocking site storage, so your progress can’t be saved after you leave this page.
			</p>
		</div>
	);
}
