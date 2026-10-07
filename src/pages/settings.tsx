// Settings page (/settings/, linked from the site footer): this browser's progress and preferences.
// - Progress (src/lib/progress.ts): how much is done, forgetting the "Continue learning" lesson,
//   backup and restore (a backup file is how a learner moves progress to another browser or device;
//   restoring merges, so nothing is lost), and reset.
// - Preferences (src/lib/preferences.ts): the colour theme (src/lib/palettes.ts), hide completed courses,
//   every course on pathway cards, glossary terms, video captions and
//   playback speed, text size, text width, "On this page", the pinned breadcrumb bar, code line
//   wrapping, jumping to headings and motion. Each applies as soon as it's changed.
// Laid out like the glossary: no sidebar, the page header, then sections.
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import { useColorMode } from '@docusaurus/theme-common';
import {
	forgetLastLesson,
	isDoneIn,
	migrateAliases,
	progressBackup,
	resetProgress,
	restoreProgress,
	useLastLesson,
	useProgressMap,
	useStorageWorks,
} from '../lib/progress';
import { fillPreferences, getHideCompleted, preferencesBackup, resetPreferences, setHideCompleted, setPreferences, SPEEDS, usePreferences, type Preferences } from '../lib/preferences';
import { lessonOf, lessonPaths, useCatalog, withSlash } from '../lib/catalog';
import { currentPalette, paletteChoice, PALETTES } from '../lib/palettes';
import SiteFooter from '../components/SiteFooter';

/** Saves this browser's progress, with its preferences, as codex-progress-<date>.json. */
function downloadBackup() {
	const blob = new Blob([JSON.stringify({ ...progressBackup(), preferences: preferencesBackup() }, null, 2)], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const link = Object.assign(document.createElement('a'), { href: url, download: `codex-progress-${new Date().toISOString().slice(0, 10)}.json` });
	document.body.append(link);
	link.click();
	link.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
	return (
		<section className="settings-section" aria-labelledby={id}>
			<h2 id={id}>{title}</h2>
			{children}
		</section>
	);
}

/** One setting: its name and explanation, and the control (given the id and description id). */
function Row({ name, help, children }: { name: string; help: React.ReactNode; children: (ids: { id: string; describedBy: string }) => React.ReactNode }) {
	const id = useId();
	return (
		<div className="settings-row">
			<div>
				<label htmlFor={id}>{name}</label>
				<p id={`${id}-help`}>{help}</p>
			</div>
			{children({ id, describedBy: `${id}-help` })}
		</div>
	);
}

function Switch({ ids, checked, onChange }: { ids: { id: string; describedBy: string }; checked: boolean; onChange: (checked: boolean) => void }) {
	return (
		<span className="settings-switch">
			<input id={ids.id} aria-describedby={ids.describedBy} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
		</span>
	);
}

function Choice<T extends string>({ ids, value, options, onChange }: { ids: { id: string; describedBy: string }; value: T; options: [T, string][]; onChange: (value: T) => void }) {
	return (
		<select id={ids.id} aria-describedby={ids.describedBy} className="catalog-level" value={value} onChange={(e) => onChange(e.target.value as T)}>
			{options.map(([option, label]) => (
				<option key={option} value={option}>
					{label}
				</option>
			))}
		</select>
	);
}

/** The lesson "Continue learning" goes to, with a button to forget it. */
function ContinueLearning() {
	const catalog = useCatalog();
	const last = useLastLesson();
	const found = last ? lessonOf(catalog, last) : undefined;
	if (!found) return <p>No lesson to continue yet: the home page’s “Continue learning” appears once you’ve opened one.</p>;
	return (
		<div className="settings-row">
			<div>
				<span className="settings-name">Continue learning</span>
				<p>
					The home page offers to take you back to <Link to={withSlash(found.lesson.path)}>{found.lesson.title}</Link> ({found.course.title}).
				</p>
			</div>
			<button type="button" className="lms-button outline" onClick={forgetLastLesson}>
				Forget it
			</button>
		</div>
	);
}

/** Choices that change how the site looks and plays (src/lib/preferences.ts). */
function PreferenceSections() {
	const preferences = usePreferences();
	const set = (change: Preferences) => setPreferences(change);
	const { colorMode, setColorMode } = useColorMode();
	const choosePalette = (id: string) => {
		const choice = paletteChoice(id);
		set({ palette: choice.palette });
		setColorMode(choice.colorMode);
	};
	const resetAll = () => {
		resetPreferences();
		setColorMode('dark');
	};
	// "Hide completed" is read after hydration, like the catalogue pages do.
	const [hideCompleted, setHide] = useState(false);
	useEffect(() => setHide(getHideCompleted()), []);
	return (
		<>
			<Section id="look" title="Colours">
				<Row name="Colour theme" help="The site’s colours: Hacklab Night and Day are its own, the others are well-known themes from code editors. The menu at the top of every page changes it too.">
					{(ids) => (
						<Choice
							ids={ids}
							value={currentPalette(preferences.palette, colorMode).id}
							options={PALETTES.map((palette) => [palette.id, palette.label])}
							onChange={choosePalette}
						/>
					)}
				</Row>
			</Section>
			<Section id="courses" title="Courses and lessons">
				<Row name="Hide completed courses" help="On the course and pathway lists. The lists’ own “Hide completed” switch is the same setting.">
					{(ids) => (
						<Switch
							ids={ids}
							checked={hideCompleted}
							onChange={(checked) => {
								setHide(checked);
								setHideCompleted(checked);
							}}
						/>
					)}
				</Row>
				<Row name="Show every course on pathway cards" help="Pathway cards list the first few courses and “+ more courses” for the rest. On lists them all, so the cards can get long.">
					{(ids) => <Switch ids={ids} checked={preferences.pathways === 'all'} onChange={(on) => set({ pathways: on ? 'all' : undefined })} />}
				</Row>
				<Row name="Glossary terms" help="Underline the first use of each glossary term in a lesson, with its meaning on hover or tap. Off shows them as plain text.">
					{(ids) => <Switch ids={ids} checked={preferences.glossary !== 'off'} onChange={(on) => set({ glossary: on ? undefined : 'off' })} />}
				</Row>
			</Section>
			<Section id="playback" title="Videos and recordings">
				<Row name="Captions" help="Turn on lesson video captions from the start, where a video has them. You can still switch them off in the player.">
					{(ids) => <Switch ids={ids} checked={preferences.captions === 'on'} onChange={(on) => set({ captions: on ? 'on' : undefined })} />}
				</Row>
				<Row name="Playback speed" help="For lesson videos and terminal recordings, as they start.">
					{(ids) => <Choice ids={ids} value={preferences.speed ?? '1'} options={SPEEDS.map((speed) => [speed, speed === '1' ? 'Normal' : `${speed}×`])} onChange={(speed) => set({ speed })} />}
				</Row>
			</Section>
			<Section id="reading" title="Reading">
				<Row name="Text size" help="Makes the whole site larger, like zooming in, and is remembered for this site.">
					{(ids) => (
						<Choice
							ids={ids}
							value={preferences.text ?? ''}
							options={[
								['', 'Standard'],
								['large', 'Large'],
								['larger', 'Larger'],
							]}
							onChange={(text) => set({ text: text || undefined })}
						/>
					)}
				</Row>
				<Row name="Text width" help="A wider column on lesson and guide pages, on screens with room for it, so more fits on each line. Full uses all the space beside the sidebar and “On this page”.">
					{(ids) => (
						<Choice
							ids={ids}
							value={preferences.width ?? ''}
							options={[
								['', 'Standard'],
								['wide', 'Wide'],
								['full', 'Full'],
							]}
							onChange={(width) => set({ width: width || undefined })}
						/>
					)}
				</Row>
				<Row name="Show “On this page”" help="The list of the page’s headings beside lesson and guide pages, on screens wide enough for it. The button at the right of the breadcrumb bar shows and hides it too.">
					{(ids) => <Switch ids={ids} checked={preferences.toc !== 'hidden'} onChange={(on) => set({ toc: on ? undefined : 'hidden' })} />}
				</Row>
				<Row name="Pin the breadcrumb bar" help="Keep the bar with the page’s place in its course (and the “On this page” button) at the top of the screen as you scroll, instead of scrolling it away with the page.">
					{(ids) => <Switch ids={ids} checked={preferences.breadcrumbs !== 'scroll'} onChange={(on) => set({ breadcrumbs: on ? undefined : 'scroll' })} />}
				</Row>
				<Row name="Wrap long code lines" help="Code too wide for the page wraps onto the next line instead of scrolling sideways. Each code block’s “Toggle word wrap” button still switches it.">
					{(ids) => <Switch ids={ids} checked={preferences.wrap === 'on'} onChange={(on) => set({ wrap: on ? 'on' : undefined })} />}
				</Row>
				<Row name="Jump to headings" help="When you choose a heading in “On this page”: a quick scroll there, so you can see where you’ve moved to, or straight there. With motion reduced it always goes straight there.">
					{(ids) => (
						<Choice
							ids={ids}
							value={preferences.scroll ?? ''}
							options={[
								['', 'Quick scroll'],
								['instant', 'Instantly'],
							]}
							onChange={(scroll) => set({ scroll: scroll || undefined })}
						/>
					)}
				</Row>
				<Row name="Motion" help="Animations such as the blinking cursor and sliding switches. The site already reduces them if your device asks it to.">
					{(ids) => (
						<Choice
							ids={ids}
							value={preferences.motion ?? ''}
							options={[
								['', 'Follow this device'],
								['reduce', 'Reduce'],
							]}
							onChange={(motion) => set({ motion: motion || undefined })}
						/>
					)}
				</Row>
				<p className="settings-defaults">
					<button type="button" className="link-button" onClick={resetAll}>
						Put these settings back to their defaults
					</button>
				</p>
			</Section>
		</>
	);
}

/** "3 of 15 lessons complete in this browser." */
function ProgressCount() {
	const { courses } = useCatalog();
	const progress = useProgressMap();
	const lessons = useMemo(() => courses.flatMap(lessonPaths), [courses]);
	const done = lessons.filter((path) => isDoneIn(progress, path)).length;
	return (
		<p>
			<strong>
				{done} of {lessons.length}
			</strong>{' '}
			lessons complete in this browser.
		</p>
	);
}

export default function Settings() {
	const { aliases } = useCatalog();
	const storageWorks = useStorageWorks();
	const file = useRef<HTMLInputElement>(null);
	const [status, setStatus] = useState('');
	// Counts restores that changed settings, to show the restored "Hide completed" (read once).
	const [restored, setRestored] = useState(0);

	const restore = async (chosen: File | undefined) => {
		if (!chosen) return;
		try {
			const backup = JSON.parse(await chosen.text());
			const added = restoreProgress(backup);
			// The backup may be from before a lesson moved.
			migrateAliases(aliases);
			// Its settings only where this browser has none of its own (older backups have none).
			const settings = fillPreferences(backup.preferences);
			if (settings) setRestored((n) => n + 1);
			const parts = [
				added && `${added} completed ${added === 1 ? 'lesson' : 'lessons'}`,
				settings && `${settings} ${settings === 1 ? 'setting' : 'settings'}`,
			].filter(Boolean);
			setStatus(parts.length ? `Restored: ${parts.join(' and ')} added.` : 'Nothing new: this browser already has everything in that backup.');
		} catch {
			setStatus('That file isn’t a progress backup from this site.');
		}
		// Choosing the same file again should restore again.
		if (file.current) file.current.value = '';
	};

	const reset = () => {
		if (!confirm('Clear all course progress in this browser?')) return;
		resetProgress();
		setStatus('');
	};

	return (
		<Layout title="Settings" description="Back up, move or reset your course progress.">
			<main className="container margin-vert--lg lms-no-sidebar">
				<div className="lms-catalog-content">
					<header className="lms-page-header">
						<h1>Settings</h1>
					</header>
					<p className="catalog-intro not-content">Everything here is saved only in this browser, and changes take effect straight away. No account, no cookies, no analytics.</p>
					<div className="settings not-content">
						<Section id="progress" title="Your progress">
							<ProgressCount />
							<ContinueLearning />
							<p className="storage-warning" hidden={storageWorks}>
								This browser is blocking site storage, so progress can’t be saved. Allow site data for this site to keep it.
							</p>
						</Section>
						<PreferenceSections key={restored} />
						<Section id="backup" title="Move your progress">
							<p className="settings-help">
								To carry on in another browser or on another device, download a backup here and restore it there. Restoring adds to what that browser already has, so nothing
								completed is lost. The backup includes your settings above, but they only fill in ones that browser hasn’t changed, so a phone keeps its own text size.
							</p>
							<div className="settings-actions">
								<button type="button" className="lms-button primary" onClick={downloadBackup}>
									Download a backup
								</button>
								<button type="button" className="lms-button outline" onClick={() => file.current?.click()}>
									Restore from a backup
								</button>
								<input ref={file} type="file" accept=".json,application/json" hidden onChange={(event) => restore(event.target.files?.[0])} />
							</div>
							{/* What restoring did. Kept in the page while empty, so screen readers announce it when it changes. */}
							<p className="settings-status" role="status">
								{status}
							</p>
						</Section>
						<Section id="reset" title="Reset progress">
							<p className="settings-help">
								Clears every completed lesson, your quiz answers and the “Continue learning” point in this browser. It can’t be undone, unless you have a backup.
							</p>
							<div className="settings-actions">
								<button type="button" className="lms-button danger" onClick={reset}>
									Reset progress
								</button>
							</div>
						</Section>
					</div>
					<SiteFooter storageWarning={false} />
				</div>
			</main>
		</Layout>
	);
}
