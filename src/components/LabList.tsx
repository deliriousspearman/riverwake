// Pro lab cards (docs/labs/*.md), one per lab environment, linking to its page: the first few on
// the home page (`limit`), all of them on /labs/. A lab with flags shows this browser's captured
// flags once one is (src/lib/lab-flags.ts), and is marked complete when all are.
import React from 'react';
import Link from '@docusaurus/Link';
import { useCatalog, withSlash, type Lab } from '../lib/catalog';
import { labFlagSummary, useLabFlags } from '../lib/lab-flags';
import { FlagProgress } from './LabFlags';
import { CardList, LevelChip, Picture, progressClasses, type IsShown } from './Progress';

/** Memoised: typing in the filter only re-renders the cards it shows or hides. */
const LabCard = React.memo(function LabCard({ lab, hidden }: { lab: Lab; hidden?: boolean }) {
	const captured = useLabFlags(lab.slug);
	const summary = labFlagSummary(lab, captured);
	return (
		<article className={`lab-card ${progressClasses(summary)}`.trim()} data-filter={lab.filter} data-level={lab.level?.toLowerCase()} hidden={hidden}>
			<header>
				<div className="card-title">
					<Picture src={lab.image} />
					<h2>
						<Link to={withSlash(lab.path)}>{lab.title}</Link>
					</h2>
				</div>
				<LevelChip level={lab.level} />
			</header>
			{lab.description && <p>{lab.description}</p>}
			<ul className="lab-tags" aria-label="Environment">
				<li className="lab-env" data-environment={lab.environment}>
					{lab.environment === 'domain' ? 'Active Directory' : 'Standalone'}
				</li>
				{lab.osCounts.map(([os, n]) => (
					<li key={os}>
						{n} {os}
					</li>
				))}
			</ul>
			{lab.flagList.length > 0 && <FlagProgress lab={lab} captured={captured} short />}
			<footer>
				<span className="lab-count">{lab.summary}</span>
				<span className="lab-view" aria-hidden="true">
					View lab →
				</span>
			</footer>
		</article>
	);
});

export default function LabList({ limit, isShown }: { limit?: number; isShown?: IsShown }) {
	return (
		<CardList items={useCatalog().labs} limit={limit} className="lab-list" empty="No pro labs published yet.">
			{(lab) => <LabCard key={lab.slug} lab={lab} hidden={isShown ? !isShown(lab) : undefined} />}
		</CardList>
	);
}
