// The additions to docs pages: title and dates, lesson video and downloads, the course lesson list
// and downloads, and the pro lab details. src/theme/DocItem/Content places them around the page text.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from '@docusaurus/Link';
import { lessonOf, lessonPaths, normalise, useCatalog, withSlash, type Attachment, type Course, type Lab } from '../lib/catalog';
import { LevelChip, LinkButton, Picture, ProgressRow, progressClasses, useSummary } from './Progress';
import { isDoneIn, useProgressMap } from '../lib/progress';
import { getPreferences } from '../lib/preferences';
import { labFlagSummary, useLabFlags } from '../lib/lab-flags';
import { FlagChecklist, MachineFlags } from './LabFlags';

/** Kind of docs page from its path: a course overview, a lesson, a pro lab, a site guide page, or something else. */
export function pageKind(permalink: string): 'course' | 'lesson' | 'lab' | 'guide' | undefined {
	const path = normalise(permalink);
	if (path === '/guide' || path.startsWith('/guide/')) return 'guide';
	if (/^\/courses\/[^/]+$/.test(path)) return 'course';
	if (/^\/courses\/[^/]+\/.+$/.test(path)) return 'lesson';
	if (/^\/labs\/[^/]+$/.test(path)) return 'lab';
	return undefined;
}

// One formatter for every date (making one per call is the slow part of toLocaleDateString).
const DATE_FORMAT = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' });
const formatDate = (iso: string) => DATE_FORMAT.format(new Date(iso));

/** "Lesson N of M · Created … · Last updated …" under the title of course, lesson and lab pages. */
export function PageDates({ permalink }: { permalink: string }) {
	const catalog = useCatalog();
	const path = normalise(permalink);
	const kind = pageKind(path);
	const { created, updated } = catalog.dates[path] ?? {};
	// Position in the course (hidden lessons aren't in the list, so they show none).
	const found = kind === 'lesson' ? lessonOf(catalog, path) : undefined;
	const lessons = found?.course.lessons ?? [];
	const position = found ? lessons.indexOf(found.lesson) + 1 : 0;
	if (!position && !created && !updated) return null;
	return (
		<p className="page-dates">
			{position > 0 && (
				<span className="page-position">
					Lesson {position} of {lessons.length}
				</span>
			)}
			{created && (
				<span>
					Created <time dateTime={created}>{formatDate(created)}</time>
				</span>
			)}
			{updated && (
				<span title={kind === 'course' ? 'Most recent change to this course or any of its lessons' : undefined}>
					Last updated <time dateTime={updated}>{formatDate(updated)}</time>
				</span>
			)}
		</p>
	);
}

/** The page title, with the course or lab picture beside it, and the dates underneath. */
export function PageHeader({ title, permalink, image }: { title: string; permalink: string; image?: string | null }) {
	const dates = <PageDates permalink={permalink} />;
	return (
		<header className="lms-page-header">
			{image ? (
				<div className="title-with-picture">
					<Picture src={image} large />
					<div>
						<h1>{title}</h1>
						{dates}
					</div>
				</div>
			) : (
				<>
					<h1>{title}</h1>
					{dates}
				</>
			)}
		</header>
	);
}

/**
 * Lesson video. When it can't be loaded (missing file, unsupported format, network error), the
 * player is swapped for a "Video unavailable" notice with Try again.
 * `captions` (a WebVTT file, scripts/captions.mjs) adds subtitles, off until turned on with the
 * player's CC button, or on from the start if the learner chose that in Settings. Settings' playback
 * speed applies too (src/lib/preferences.ts).
 */
export function LessonVideo({ src, captions }: { src: string; captions?: string }) {
	const video = useRef<HTMLVideoElement>(null);
	const retry = useRef<HTMLButtonElement>(null);
	const [failed, setFailed] = useState(false);
	const retrying = useRef(false);
	const fail = () => {
		setFailed(true);
		// After "Try again" fails, the button reappears: keep keyboard focus on it.
		if (retrying.current) setTimeout(() => retry.current?.focus());
		retrying.current = false;
	};
	useEffect(() => {
		// A missing file can fail before hydration, so the error event has already fired: then
		// `error` is set. (Not networkState: it's NETWORK_NO_SOURCE for a moment while any video
		// starts loading, which showed "Video unavailable" for a good video, mostly on a return visit.)
		const v = video.current;
		if (v?.error) fail();
		if (!v) return;
		const preferences = getPreferences();
		// The default rate survives load() (Try again), unlike playbackRate on its own.
		v.defaultPlaybackRate = v.playbackRate = Number(preferences.speed) || 1;
		if (preferences.captions === 'on' && v.textTracks[0]) v.textTracks[0].mode = 'showing';
	}, [src]);
	return (
		<figure className="lesson-video not-content">
			<video ref={video} controls preload="metadata" playsInline src={src} hidden={failed} onError={fail}>
				{captions && <track kind="captions" src={captions} srcLang="en" label="English" />}
				Your browser can’t play this video. <a href={src}>Download it instead</a>.
			</video>
			<div className="video-unavailable" role="status" hidden={!failed}>
				<p>
					<strong>Video unavailable.</strong> The video for this lesson couldn’t be loaded. You can still work through the lesson below.
				</p>
				<button
					ref={retry}
					type="button"
					className="link-button"
					onClick={() => {
						retrying.current = true;
						setFailed(false);
						video.current?.load();
						video.current?.focus();
					}}
				>
					Try again
				</button>
			</div>
		</figure>
	);
}

/** Downloadable files. Each link has `download`, so the browser saves the file. */
export function Attachments({ items }: { items: Attachment[] }) {
	return (
		<ul className="attachments">
			{items.map(({ file, title, description, ext, type, size }) => (
				<li key={file}>
					<span className="attachment-ext" aria-hidden="true">
						{ext}
					</span>
					<div className="attachment-text">
						<a href={file} download>
							{title}
						</a>
						{description && <p>{description}</p>}
					</div>
					<span className="attachment-meta">
						{type} · {size}
					</span>
				</li>
			))}
		</ul>
	);
}

export function LessonDownloads({ items }: { items: Attachment[] }) {
	if (!items.length) return null;
	return (
		<section className="lesson-downloads not-content" aria-labelledby="lesson-downloads-heading">
			<h2 id="lesson-downloads-heading">Downloads for this lesson</h2>
			<Attachments items={items} />
		</section>
	);
}

/** Course overview: progress, Start/Continue, and the lessons as a checklist grouped by section. */
export function LessonList({ course }: { course: Course }) {
	const summary = useSummary(lessonPaths(course));
	const progress = useProgressMap();
	// Lessons grouped by section; lesson numbers continue across sections.
	const groups = useMemo(() => {
		const list: { title: string | null; lessons: Course['lessons']; start: number }[] = [];
		course.lessons.forEach((lesson, i) => {
			if (!list.length || list.at(-1)!.title !== lesson.sectionTitle) list.push({ title: lesson.sectionTitle, lessons: [], start: i + 1 });
			list.at(-1)!.lessons.push(lesson);
		});
		return list;
	}, [course]);
	if (!course.lessons.length) return null;
	return (
		<section className={`lesson-list not-content ${progressClasses(summary)}`}>
			<ProgressRow summary={summary} label="Course progress" />
			{summary.next && <LinkButton to={summary.next}>{summary.nextLabel}</LinkButton>}
			<h2>Lessons</h2>
			{groups.map((group) => (
				<div className="lesson-group" key={group.title ?? 'root'}>
					{group.title && <h3>{group.title}</h3>}
					<ol start={group.start}>
						{group.lessons.map((lesson) => (
							<li key={lesson.path}>
								<Link className={isDoneIn(progress, lesson.path) ? 'is-complete' : undefined} to={withSlash(lesson.path)}>
									{lesson.title}
								</Link>
								{lesson.video && <span className="lesson-meta">Video</span>}
							</li>
						))}
					</ol>
				</div>
			))}
		</section>
	);
}

/** Course overview: the course's own downloads, then every lesson's, in course order. */
export function CourseDownloads({ course }: { course: Course }) {
	const lessons = course.lessons.filter((l) => l.attachments.length);
	if (!course.attachments.length && !lessons.length) return null;
	return (
		<section className="course-downloads not-content" aria-labelledby="course-downloads-heading">
			<h2 id="course-downloads-heading">Downloads</h2>
			{course.attachments.length > 0 && (
				<div className="course-downloads-group">
					<h3>For the whole course</h3>
					<Attachments items={course.attachments} />
				</div>
			)}
			{lessons.map((lesson) => (
				<div className="course-downloads-group" key={lesson.path}>
					<h3>
						Lesson: <Link to={withSlash(lesson.path)}>{lesson.title}</Link>
					</h3>
					<Attachments items={lesson.attachments} />
				</div>
			))}
		</section>
	);
}

/** Pro lab stats under the title: level, environment, machines, flags (with this browser's captured count) and entry point. */
export function LabSummary({ lab }: { lab: Lab }) {
	const captured = useLabFlags(lab.slug);
	const { count } = labFlagSummary(lab, captured);
	return (
		<section className="lab-summary not-content" aria-label="Lab overview">
			<dl className="lab-stats">
				<div>
					<dt>Level</dt>
					<dd>
						<LevelChip level={lab.level} />
					</dd>
				</div>
				<div>
					<dt>Environment</dt>
					<dd>
						{lab.environment === 'domain' ? 'Active Directory' : 'Standalone hosts'}
						{lab.domain && <span className="lab-stat-note">{lab.domain}</span>}
					</dd>
				</div>
				<div>
					<dt>Machines</dt>
					<dd>
						{lab.machines.length}
						<span className="lab-stat-note">{lab.osCounts.map(([os, n]) => `${n} ${os}`).join(' · ')}</span>
					</dd>
				</div>
				<div>
					<dt>Flags</dt>
					<dd>
						{count > 0 ? `${count} / ${lab.flags}` : lab.flags}
						{count > 0 && <span className="lab-stat-note">captured</span>}
					</dd>
				</div>
				<div>
					<dt>Entry point</dt>
					<dd>
						<code>{lab.entryPoint}</code>
					</dd>
				</div>
			</dl>
		</section>
	);
}

/** Pro lab machines (with their flags), the flag checklist and what you'll practise, after the scenario text. */
export function LabDetails({ lab }: { lab: Lab }) {
	const domain = lab.environment === 'domain';
	const captured = useLabFlags(lab.slug);
	const hasFlags = lab.flagList.length > 0;
	const flagsOn = (machine: string) => lab.flagList.filter((f) => f.machine?.toLowerCase() === machine.toLowerCase());
	return (
		<section className="lab-details not-content" aria-labelledby="lab-machines">
			<h2 id="lab-machines">Machines</h2>
			<div className="lab-table-wrap">
				<table className="lab-machines">
					<thead>
						<tr>
							<th scope="col">Name</th>
							<th scope="col">OS</th>
							<th scope="col">Role</th>
							<th scope="col">Network</th>
							{domain && <th scope="col">Domain</th>}
							{hasFlags && <th scope="col">Flags</th>}
						</tr>
					</thead>
					<tbody>
						{lab.machines.map((m) => (
							<tr key={m.name}>
								<th scope="row">{m.name}</th>
								<td>
									<span className="lab-os" data-os={m.os.toLowerCase()}>
										{m.os}
									</span>
								</td>
								<td>{m.role ?? '—'}</td>
								<td>{m.network ?? '—'}</td>
								{domain && <td>{m.domainJoined ? <span className="lab-joined">✓ Joined</span> : <span className="lab-not-joined">Not joined</span>}</td>}
								{hasFlags && (
									<td>
										<MachineFlags flags={flagsOn(m.name)} captured={captured} />
									</td>
								)}
							</tr>
						))}
					</tbody>
				</table>
			</div>
			{hasFlags && (
				<>
					<h2 id="lab-flags">Flags</h2>
					<FlagChecklist lab={lab} captured={captured} />
				</>
			)}
			{lab.skills.length > 0 && (
				<>
					<h2>What you’ll practise</h2>
					<ul className="lab-skills">
						{lab.skills.map((skill) => (
							<li key={skill}>{skill}</li>
						))}
					</ul>
				</>
			)}
		</section>
	);
}
