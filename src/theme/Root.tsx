// Wraps the whole app. Once per visit, progress saved under the old paths of moved pages
// (`aliases` frontmatter) is moved to their new paths.
// On the staging site (SITE_ENV=staging, docusaurus.config.ts), a strip above every page says so.
import React, { useEffect } from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import { useCatalog } from '../lib/catalog';
import { migrateAliases } from '../lib/progress';

export default function Root({ children }: { children: React.ReactNode }) {
	const { aliases } = useCatalog();
	const { siteConfig } = useDocusaurusContext();
	useEffect(() => migrateAliases(aliases), [aliases]);
	return (
		<>
			{siteConfig.customFields?.staging === true && (
				<aside className="staging-banner" aria-label="Staging site">
					<strong>Staging</strong> Unpublished changes: this isn’t the live site.
				</aside>
			)}
			{children}
		</>
	);
}
