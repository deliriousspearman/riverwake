// Slim site footer under every page's content: site name and description, links back to the
// catalogue and to the site guide for editors (docs/guide/), on docs pages an "Edit this page" link
// (its file in GitLab, from src/theme/DocItem/Paginator), and a warning when the browser blocks site
// storage. Where progress is kept is explained at the top of the Settings page (src/pages/settings.tsx).
import React from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import { useStorageWorks } from '../lib/progress';

export default function SiteFooter({ storageWarning = true, editUrl }: { storageWarning?: boolean; editUrl?: string }) {
	const { siteConfig } = useDocusaurusContext();
	const storageWorks = useStorageWorks();

	return (
		<div className="site-footer not-content">
			<div className="site-footer-row">
				<p className="site-footer-brand">
					<strong>{siteConfig.title}</strong>
					{siteConfig.tagline && <span>{siteConfig.tagline}</span>}
				</p>
				<nav className="site-footer-links" aria-label="Footer">
					<Link to="/courses/">Courses</Link>
					<Link to="/pathways/">Pathways</Link>
					<Link to="/labs/">Pro labs</Link>
					<Link to="/glossary/">Glossary</Link>
					<Link to="/guide/">Site guide</Link>
					<Link to="/settings/">Settings</Link>
					{/* Docs pages only: the page's file in GitLab's editor, for the site's editors. */}
					{editUrl && (
						<a className="site-footer-edit" href={editUrl}>
							Edit this page
						</a>
					)}
				</nav>
			</div>
			{/* Lesson pages show the warning next to their "Mark as complete" button instead, and the Settings page in its own content. */}
			{storageWarning && (
				<p className="storage-warning" hidden={storageWorks}>
					This browser is blocking site storage, so progress can’t be saved. Allow site data for this site to keep it.
				</p>
			)}
		</div>
	);
}
