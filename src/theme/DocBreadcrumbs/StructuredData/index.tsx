// The breadcrumbs' JSON-LD for search engines, as Docusaurus writes it, except that "<" is escaped
// (\u003c, which JSON reads back as "<"). The JSON goes into the page's HTML as-is, so a page title
// containing "</script>" would otherwise end the script and could start one of its own.
import React, { type ReactNode } from 'react';
import Head from '@docusaurus/Head';
import { useBreadcrumbsStructuredData } from '@docusaurus/plugin-content-docs/client';
import type { Props } from '@theme/DocBreadcrumbs/StructuredData';

export default function DocBreadcrumbsStructuredData(props: Props): ReactNode {
	const structuredData = useBreadcrumbsStructuredData({ breadcrumbs: props.breadcrumbs });
	return (
		<Head>
			<script type="application/ld+json">{JSON.stringify(structuredData).replace(/</g, '\\u003c')}</script>
		</Head>
	);
}
