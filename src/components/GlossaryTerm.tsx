// One glossary term's own page (/glossary/<id>/), added as a route by plugins/lms-content.mjs.
// Mainly so site search can find a term: the search plugin indexes each of these pages as one result
// titled with the term (docusaurus.config.ts), where the /glossary/ list would be one result for
// every term at once. It also gives each term a link to share.
import React from 'react';
import Link from '@docusaurus/Link';
import type { GlossaryEntry } from '../lib/catalog';

/** "See also: A, B" with each term linked by `link` (the list's anchors, or the terms' own pages). */
export function SeeAlso({ items, link }: { items: GlossaryEntry['seeAlso']; link: (other: GlossaryEntry['seeAlso'][number]) => React.ReactNode }) {
	if (!items.length) return null;
	return (
		<p className="glossary-see">
			See also:{' '}
			{items.map((other, i) => (
				<React.Fragment key={other.id}>
					{i > 0 && ', '}
					{link(other)}
				</React.Fragment>
			))}
		</p>
	);
}

export default function GlossaryTerm({ entry }: { entry: GlossaryEntry }) {
	return (
		<>
			<header className="lms-page-header">
				<h1>{entry.term}</h1>
				{entry.aliases.length > 0 && <p className="glossary-aliases">Also: {entry.aliases.join(' · ')}</p>}
			</header>
			<div className="glossary-term-page not-content">
				<div className="glossary-entry">
					<p className="glossary-definition-text">{entry.definition}</p>
					<SeeAlso items={entry.seeAlso} link={(other) => <Link to={`/glossary/${other.id}/`}>{other.term}</Link>} />
				</div>
				<p className="glossary-term-back">
					<Link to={`/glossary/#${entry.id}`}>All glossary terms →</Link>
				</p>
			</div>
		</>
	);
}
