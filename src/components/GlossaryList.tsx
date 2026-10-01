// /glossary/: every glossary term (content/glossary/), A–Z with letter links and a filter. Each
// entry has the term's file name as its id, so /glossary/#kerberoasting links straight to it (the
// lesson tooltips do). The terms come as route data (plugins/lms-content.mjs), not from the
// catalogue every page loads.
import React, { useMemo, useRef, useState } from 'react';
import useBrokenLinks from '@docusaurus/useBrokenLinks';
import { letterOf } from '../../scripts/summary.mjs';
import type { GlossaryEntry } from '../lib/catalog';
import { EmptyNote, hasAllWords, SearchField, searchWords } from './CatalogFilter';
import { SeeAlso } from './GlossaryTerm';

const anchor = (letter: string) => (letter === '#' ? 'other' : letter);

export default function GlossaryList({ entries }: { entries: GlossaryEntry[] }) {
	// Lesson tooltips link to /glossary/#<id>: tell the build's link check these anchors exist.
	const brokenLinks = useBrokenLinks();
	for (const entry of entries) brokenLinks.collectAnchor(entry.id);
	const [text, setText] = useState('');
	const input = useRef<HTMLInputElement>(null);
	// Worked out once, not on every keystroke: each entry's searchable text, and the entries by letter.
	const { groups, haystacks, alphabet } = useMemo(() => {
		const groups = new Map<string, GlossaryEntry[]>();
		for (const entry of entries) {
			const letter = letterOf(entry.term);
			groups.set(letter, [...(groups.get(letter) ?? []), entry]);
		}
		return {
			groups,
			haystacks: new Map(entries.map((e) => [e.id, [e.term, ...e.aliases, e.definition].join(' ').toLowerCase()])),
			alphabet: [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', ...(groups.has('#') ? ['#'] : [])],
		};
	}, [entries]);
	const words = searchWords(text);
	const shown = (e: GlossaryEntry) => hasAllWords(haystacks.get(e.id)!, words);
	const anyShown = entries.some(shown);
	return (
		<div className="glossary not-content" data-no-match={anyShown ? undefined : ''}>
			<div className="catalog-bar">
				<SearchField label="Filter terms" placeholder="Filter terms…" value={text} onChange={setText} inputRef={input} />
			</div>
			<nav className="glossary-letters" aria-label="Jump to letter">
				{alphabet.map((letter) =>
					groups.has(letter) ? (
						<a key={letter} href={`#letter-${anchor(letter)}`}>
							{letter}
						</a>
					) : (
						<span key={letter} aria-hidden="true">
							{letter}
						</span>
					),
				)}
			</nav>
			<EmptyNote
				className="glossary-no-match"
				action="Clear the filter"
				onAction={() => {
					setText('');
					input.current?.focus();
				}}
			>
				No terms match.
			</EmptyNote>
			{[...groups].map(([letter, inLetter]) => (
				<section key={letter} className="glossary-letter" id={`letter-${anchor(letter)}`} aria-labelledby={`heading-${anchor(letter)}`} hidden={!inLetter.some(shown)}>
					<h2 id={`heading-${anchor(letter)}`}>{letter}</h2>
					<dl>
						{inLetter.map((entry) => (
							<div key={entry.id} className="glossary-entry" id={entry.id} hidden={!shown(entry)}>
								<dt>
									{entry.term}
									{entry.aliases.length > 0 && <span className="glossary-aliases">{entry.aliases.join(' · ')}</span>}
								</dt>
								<dd>
									<p>{entry.definition}</p>
									<SeeAlso items={entry.seeAlso} link={(other) => <a href={`#${other.id}`}>{other.term}</a>} />
								</dd>
							</div>
						))}
					</dl>
				</section>
			))}
		</div>
	);
}
