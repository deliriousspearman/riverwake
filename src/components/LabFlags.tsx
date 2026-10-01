// Pro lab flags on a lab's page (src/lib/lab-flags.ts): the "Submit a flag" panel under the stats,
// the Flags column of the Machines table, and the Flags checklist after it. Only for a lab with
// flags in content/lab-flags/; the page's HTML shows nothing captured, then this browser's progress.
import React, { useId, useState } from 'react';
import type { Lab, LabFlag } from '../lib/catalog';
import { canCheckFlags, flagName, labFlagSummary, submitFlag, useLabFlags, type Captured } from '../lib/lab-flags';

const day = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** "3 of 8 flags captured", with the bar (the course progress row's markup and styles). */
export function FlagProgress({ lab, captured, short = false }: { lab: Lab; captured: Captured; short?: boolean }) {
	const { count, total } = labFlagSummary(lab, captured);
	return (
		<div className="progress-row">
			<progress data-progress-bar value={count} max={total || 1} aria-label={`${lab.title} flags captured`} />
			<span data-progress-count>{short ? `${count} / ${total} flags` : `${count} of ${total} flags captured`}</span>
		</div>
	);
}

type Status = { kind: 'captured' | 'already' | 'wrong' | 'error'; text: string } | undefined;

/** The form learners paste a flag into, with their progress and what the last submission did. */
export function LabFlagPanel({ lab }: { lab: Lab }) {
	const captured = useLabFlags(lab.slug);
	const [text, setText] = useState('');
	const [busy, setBusy] = useState(false);
	const [status, setStatus] = useState<Status>();
	const id = useId();
	if (!lab.flagList.length) return null;
	const { complete } = labFlagSummary(lab, captured);

	const submit = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!text.trim() || busy) return;
		if (!canCheckFlags()) {
			setStatus({ kind: 'error', text: 'This browser can’t check flags here (it needs the site’s secure https address).' });
			return;
		}
		setBusy(true);
		try {
			const outcome = await submitFlag(lab, text);
			if (outcome.result === 'captured') {
				setText('');
				setStatus({ kind: 'captured', text: `Captured: ${flagName(outcome.flag)}` });
			} else if (outcome.result === 'already') {
				setText('');
				setStatus({ kind: 'already', text: `Already captured on ${day(outcome.at)}: ${flagName(outcome.flag)}` });
			} else {
				setStatus({ kind: 'wrong', text: 'That isn’t one of this lab’s flags. Check for a missing part or extra characters.' });
			}
		} finally {
			setBusy(false);
		}
	};

	return (
		<section className={`lab-flag-panel not-content${complete ? ' is-complete' : ''}`} aria-labelledby={`${id}-title`}>
			<h2 id={`${id}-title`}>{complete ? 'All flags captured' : 'Submit a flag'}</h2>
			<form className="lab-flag-form" onSubmit={submit}>
				<label className="sr-only" htmlFor={`${id}-flag`}>
					Flag
				</label>
				<input
					id={`${id}-flag`}
					type="text"
					value={text}
					onChange={(event) => setText(event.target.value)}
					placeholder="Paste a flag…"
					autoComplete="off"
					autoCapitalize="off"
					spellCheck={false}
				/>
				<button type="submit" className="lms-button primary" disabled={!text.trim() || busy}>
					Submit
				</button>
			</form>
			<FlagProgress lab={lab} captured={captured} />
			{/* Kept in the page while empty, so screen readers announce it when it changes. */}
			<p className="lab-flag-status" role="status" data-kind={status?.kind}>
				{status && (
					<>
						{status.kind === 'captured' && <span aria-hidden="true">✓ </span>}
						{status.text}
					</>
				)}
			</p>
		</section>
	);
}

/** A machine's flags in the Machines table: ✓ captured, ○ not yet. */
export function MachineFlags({ flags, captured }: { flags: LabFlag[]; captured: Captured }) {
	if (!flags.length) return <>—</>;
	const done = flags.filter((f) => captured[f.id]).length;
	return (
		<span className="lab-machine-flags">
			{flags.map((f) => (
				<span key={f.id} className="lab-flag-mark" data-captured={captured[f.id] ? '' : undefined} title={`${f.label}: ${captured[f.id] ? 'captured' : 'not captured yet'}`} aria-hidden="true">
					{captured[f.id] ? '✓' : '○'}
				</span>
			))}
			<span className="sr-only">
				{done} of {flags.length} captured
			</span>
		</span>
	);
}

/** Every flag, machines' first (in the file's order), then any that aren't on one machine. */
export function FlagChecklist({ lab, captured }: { lab: Lab; captured: Captured }) {
	const ordered = [...lab.flagList.filter((f) => f.machine), ...lab.flagList.filter((f) => !f.machine)];
	return (
		<ul className="lab-flag-list">
			{ordered.map((f) => (
				<li key={f.id} data-captured={captured[f.id] ? '' : undefined}>
					<span className="lab-flag-mark" aria-hidden="true">
						{captured[f.id] ? '✓' : '○'}
					</span>
					<span className="lab-flag-name">{flagName(f)}</span>
					<span className="lab-flag-when">{captured[f.id] ? `Captured ${day(captured[f.id])}` : <span className="sr-only">Not captured yet</span>}</span>
				</li>
			))}
		</ul>
	);
}
