// Filter bar for the catalogue pages (/courses/, /pathways/, /labs/): a text filter, a level filter
// (only when some item has a level), and on pages with progress the "Hide completed" switch
// (remembered in this browser, src/lib/preferences.ts; also on the Settings page). Also the two empty-state notes, which CSS shows from the cards'
// state (src/css/site/catalogue.css, `.catalog-empty`). The search box, the empty note and the word matching are
// shared with the glossary's filter (GlossaryList.tsx).
import React, { useEffect, useRef, useState } from 'react';
import { getHideCompleted, setHideCompleted } from '../lib/preferences';
import type { IsShown } from './Progress';

const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

export type Filter = { text: string; level: string; hideCompleted: boolean };

/** The typed words, lower-case. */
export const searchWords = (text: string) => text.toLowerCase().split(/\s+/).filter(Boolean);

/** Whether `haystack` (lower-case) contains every one of `words`. */
export const hasAllWords = (haystack: string, words: string[]) => words.every((word) => haystack.includes(word));

/** Which cards match: every typed word in the title/description, and the chosen level. Make it once per filter change. */
export function filterMatcher(filter: Filter): IsShown {
	const words = searchWords(filter.text);
	return (item) => hasAllWords(item.filter, words) && (filter.level === '' || item.level?.toLowerCase() === filter.level);
}

/** The text filter box (catalogue pages and the glossary). */
export function SearchField({ label, placeholder, value, onChange, inputRef }: { label: string; placeholder: string; value: string; onChange: (text: string) => void; inputRef?: React.Ref<HTMLInputElement> }) {
	return (
		<label className="catalog-search">
			<span className="sr-only">{label}</span>
			<input ref={inputRef} type="search" placeholder={placeholder} autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} />
		</label>
	);
}

/** "Nothing matches" with a button that undoes the filter (shown by CSS when it applies). */
export function EmptyNote({ className, children, action, onAction }: { className: string; children: React.ReactNode; action: string; onAction: () => void }) {
	return (
		<p className={`catalog-empty ${className}`}>
			{children}
			<button type="button" className="link-button" onClick={onAction}>
				{action}
			</button>
		</p>
	);
}

/** Filter state, with the "Hide completed" choice restored from and saved to localStorage. */
export function useFilter(): [Filter, (change: Partial<Filter>) => void] {
	const [filter, setFilter] = useState<Filter>({ text: '', level: '', hideCompleted: false });
	useEffect(() => {
		if (getHideCompleted()) setFilter((f) => ({ ...f, hideCompleted: true }));
	}, []);
	const update = (change: Partial<Filter>) => {
		setFilter((f) => ({ ...f, ...change }));
		if (change.hideCompleted !== undefined) setHideCompleted(change.hideCompleted);
	};
	return [filter, update];
}

export default function CatalogFilter({
	noun,
	levels = [],
	progress = false,
	filter,
	onChange,
}: {
	/** Plural noun for the items, e.g. "courses". */
	noun: string;
	/** Levels present among the items; the level filter is left out if empty. */
	levels?: (string | null)[];
	/** Show the "Hide completed" switch (courses, pathways, and labs by their flags). */
	progress?: boolean;
	filter: Filter;
	onChange: (change: Partial<Filter>) => void;
}) {
	const present = LEVELS.filter((level) => levels.includes(level));
	const text = useRef<HTMLInputElement>(null);
	const hideSwitch = useRef<HTMLInputElement>(null);
	return (
		<>
			<div className="catalog-bar">
				<SearchField label={`Filter ${noun}`} placeholder={`Filter ${noun}…`} value={filter.text} onChange={(value) => onChange({ text: value })} inputRef={text} />
				{present.length > 0 && (
					<select className="catalog-level" aria-label="Level" value={filter.level} onChange={(e) => onChange({ level: e.target.value })}>
						<option value="">All levels</option>
						{present.map((level) => (
							<option key={level} value={level.toLowerCase()}>
								{level}
							</option>
						))}
					</select>
				)}
				{progress && (
					<label className="catalog-filter">
						<input ref={hideSwitch} type="checkbox" role="switch" checked={filter.hideCompleted} onChange={(e) => onChange({ hideCompleted: e.target.checked })} />
						Hide completed
					</label>
				)}
			</div>
			<EmptyNote
				className="catalog-no-match"
				action="Clear filters"
				onAction={() => {
					onChange({ text: '', level: '' });
					text.current?.focus();
				}}
			>
				No {noun} match.
			</EmptyNote>
			{progress && (
				<EmptyNote
					className="catalog-all-done"
					action="Show completed"
					onAction={() => {
						onChange({ hideCompleted: false });
						hideSwitch.current?.focus();
					}}
				>
					You’ve completed all of these. Nice work.
				</EmptyNote>
			)}
		</>
	);
}
