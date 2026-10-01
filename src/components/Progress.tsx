// Progress bars, counters and Continue links, and the card parts the catalogue lists share.
import React, { useMemo } from 'react';
import Link from '@docusaurus/Link';
import clsx from 'clsx';
import { lessonPaths, withSlash, type Course, type Level } from '../lib/catalog';
import { summarise, useProgressMap, type ProgressSummary } from '../lib/progress';

/** Progress through `lessons`, recomputed only when progress or the lessons change. */
export function useSummary(lessons: string[], startLabel?: string): ProgressSummary {
	const progress = useProgressMap();
	// `lessons` is usually a new array each render: key the memo on its contents instead.
	const key = lessons.join('\n');
	return useMemo(() => summarise(progress, lessons, startLabel), [progress, key, startLabel]);
}

/** "3 / 8 complete". */
export const completeText = ({ count, total }: { count: number; total: number }) => `${count} / ${total} complete`;

/** "x / n complete" (or `empty` before anything is done) with a bar that shows once started. */
export function ProgressRow({ summary, label, empty, children }: { summary: ProgressSummary; label: string; empty?: string; children?: React.ReactNode }) {
	return (
		<div className="progress-row">
			<progress data-progress-bar value={summary.count} max={summary.total || 1} aria-label={label} />
			<span data-progress-count>{summary.count === 0 && empty ? empty : completeText(summary)}</span>
			{children}
		</div>
	);
}

/** Card classes the CSS uses: `is-started` reveals the bar, `is-complete` marks the card. */
export const progressClasses = (summary: ProgressSummary) => [summary.started && 'is-started', summary.complete && 'is-complete'].filter(Boolean).join(' ');

/** A primary button-style link. */
export function LinkButton({ to, children, variant = 'primary', ...rest }: { to: string; children: React.ReactNode; variant?: 'primary' | 'minimal' } & Record<string, unknown>) {
	return (
		<Link className={`lms-button ${variant}`} to={to} {...rest}>
			{children}
		</Link>
	);
}

/** Square course, pathway or lab picture. */
export function Picture({ src, large = false }: { src: string | null; large?: boolean }) {
	if (!src) return null;
	return <img className={large ? 'picture picture-lg' : 'picture'} src={src} alt="" width={256} height={256} loading={large ? undefined : 'lazy'} />;
}

/** Beginner / Intermediate / Advanced badge (coloured by `data-level` in src/css/site/catalogue.css). */
export function LevelChip({ level }: { level: Level | null }) {
	if (!level) return null;
	return (
		<span className="level-chip" data-level={level.toLowerCase()}>
			{level}
		</span>
	);
}

/**
 * A course with its picture, description and progress, and a Continue link once started: the cards
 * on the course lists (`as="article"`) and the steps of a pathway (`as="li"`).
 */
export const CourseProgressCard = React.memo(function CourseProgressCard({
	course,
	as: Tag,
	className,
	heading: Heading,
	hidden,
	filterable = false,
}: {
	course: Course;
	as: 'article' | 'li';
	className: string;
	heading: 'h2' | 'h3';
	hidden?: boolean;
	/** Adds the attributes the catalogue filter matches (CatalogFilter.tsx). */
	filterable?: boolean;
}) {
	const summary = useSummary(lessonPaths(course));
	// A card's title row is its header; a pathway step's is a plain block.
	const Title = Tag === 'article' ? 'header' : 'div';
	return (
		<Tag
			className={clsx(className, progressClasses(summary))}
			hidden={hidden}
			{...(filterable ? { 'data-filter': course.filter, 'data-level': course.level?.toLowerCase() } : {})}
		>
			<Title className="card-title">
				<Picture src={course.image} />
				<Heading>
					<Link to={withSlash(course.path)}>{course.title}</Link>
				</Heading>
			</Title>
			{course.description && <p>{course.description}</p>}
			<ProgressRow summary={summary} label={`${course.title} progress`} empty={course.summary}>
				{/* Straight to the next unfinished lesson; shown once started. */}
				{summary.next && (
					<Link className="card-continue" to={summary.next}>
						Continue →
					</Link>
				)}
			</ProgressRow>
		</Tag>
	);
});

/** Whether a catalogue card matches the filter bar (CatalogFilter.tsx). */
export type IsShown = (item: { filter: string; level: string | null }) => boolean;

/** A catalogue list: the first `limit` items (all if unset), or a note when there are none. */
export function CardList<T>({ items, limit, className, empty, children }: { items: T[]; limit?: number; className: string; empty: string; children: (item: T) => React.ReactNode }) {
	const shown = items.slice(0, limit);
	return (
		<div className={`${className} not-content`}>
			{shown.map(children)}
			{shown.length === 0 && <p>{empty}</p>}
		</div>
	);
}
