// The catalogue pages, added as routes by plugins/lms-content.mjs: /courses/, /pathways/,
// /pathways/<id>/, /labs/ and /glossary/.
//
// They use Docusaurus's own docs layout (DocRoot/Layout) with a sidebar provided here, so the left
// nav, its hide button and the mobile menu look and work exactly as on the docs pages: the list
// pages have one group listing every course, pathway or lab. The glossary has no sidebar.
// The glossary pages get their terms as route data (`glossary`, or one term's `entry`), not from
// the catalogue every page loads.
import React, { useMemo } from 'react';
import Head from '@docusaurus/Head';
import Layout from '@theme/Layout';
// The original layout: the wrapper in src/theme/DocRoot/Layout is only for docs pages (it needs
// their docs version).
import DocRootLayout from '@theme-original/DocRoot/Layout';
import { HtmlClassNameProvider } from '@docusaurus/theme-common';
import { DocsSidebarProvider } from '@docusaurus/plugin-content-docs/client';
import type { PropSidebar } from '@docusaurus/plugin-content-docs';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import clsx from 'clsx';
import { pathwayOf, useCatalog, withSlash, type Catalog, type GlossaryEntry, type Pathway } from '../lib/catalog';
import CatalogFilter, { filterMatcher, useFilter } from './CatalogFilter';
import CourseList from './CourseList';
import GlossaryList from './GlossaryList';
import GlossaryTerm from './GlossaryTerm';
import LabList from './LabList';
import PathwayList from './PathwayList';
import PathwayOverview from './PathwayOverview';
import { Picture } from './Progress';
import SiteFooter from './SiteFooter';

type Page = 'courses' | 'pathways' | 'labs' | 'glossary' | 'pathway' | 'term';
type ListPageName = Exclude<Page, 'pathway' | 'term'>;
type Kind = 'courses' | 'pathways' | 'labs';

/** One non-collapsible group listing every course, pathway or lab (like the course sidebars). */
function sectionSidebar(catalog: Catalog, kind: Kind): PropSidebar {
	const lists = {
		courses: { label: 'Courses', items: catalog.courses },
		pathways: { label: 'Pathways', items: catalog.pathways },
		labs: { label: 'Pro Labs', items: catalog.labs },
	};
	const { label, items } = lists[kind];
	return [
		{
			type: 'category',
			label,
			collapsible: false,
			collapsed: false,
			className: 'sidebar-single-group',
			items: items.map((item) => ({ type: 'link', label: item.title, href: withSlash(item.path), unlisted: false })),
		},
	];
}

function ListPage({ kind }: { kind: Kind }) {
	const catalog = useCatalog();
	const [filter, setFilter] = useFilter();
	const isShown = useMemo(() => filterMatcher(filter), [filter]);
	const levels = useMemo(() => catalog[kind].map((item) => item.level), [catalog, kind]);
	return (
		<div className={clsx('catalog not-content')} data-catalog="" data-hide-completed={filter.hideCompleted ? '' : undefined}>
			<CatalogFilter noun={kind === 'labs' ? 'pro labs' : kind} levels={levels} progress filter={filter} onChange={setFilter} />
			{kind === 'courses' && <CourseList isShown={isShown} />}
			{kind === 'pathways' && <PathwayList isShown={isShown} />}
			{kind === 'labs' && <LabList isShown={isShown} />}
		</div>
	);
}

const PAGES = {
	courses: {
		title: 'Courses',
		description: 'All the free, self-paced cyber security courses.',
		intro: (
			<>
				Each course is a short series of lessons you work through at your own pace. Take them in any order, or follow a <Link to="/pathways/">pathway</Link>.
			</>
		),
	},
	pathways: {
		title: 'Pathways',
		description: 'Curated sequences of cyber security courses.',
		intro: <>Pathways are curated sequences of courses. Work through them in order.</>,
	},
	labs: {
		title: 'Pro Labs',
		description: 'Realistic lab environments to attack from start to finish.',
		intro: (
			<>
				Pro labs are realistic networks of vulnerable machines to attack from start to finish. Access comes from your instructor; this site describes each environment so you can
				prepare.
			</>
		),
	},
	glossary: {
		title: 'Glossary',
		description: 'Short explanations of the security terms used in the courses.',
		intro: (
			<>
				Short explanations of the terms used in the courses. In lessons, the first use of a term is underlined: hover over it, or tap it, to see its meaning.
			</>
		),
	},
};

type Props = { page: Page; id?: string; glossary?: GlossaryEntry[]; entry?: GlossaryEntry };

function Content({ page, pathway, glossary, entry }: { page: Page; pathway?: Pathway; glossary?: GlossaryEntry[]; entry?: GlossaryEntry }) {
	if (pathway) {
		return (
			<>
				<header className="lms-page-header">
					<div className={pathway.image ? 'title-with-picture' : undefined}>
						<Picture src={pathway.image} large />
						<h1>{pathway.title}</h1>
					</div>
				</header>
				<PathwayOverview pathway={pathway} />
			</>
		);
	}
	if (entry) return <GlossaryTerm entry={entry} />;
	const { title, intro } = PAGES[page as ListPageName];
	return (
		<>
			<header className="lms-page-header">
				<h1>{title}</h1>
			</header>
			<p className="catalog-intro not-content">{intro}</p>
			{page === 'glossary' ? <GlossaryList entries={glossary ?? []} /> : <ListPage kind={page as Kind} />}
		</>
	);
}

export default function CatalogPage({ page, id, glossary, entry }: Props) {
	const catalog = useCatalog();
	const pathway = page === 'pathway' ? pathwayOf(catalog, id) : undefined;
	const term = page === 'term' ? entry : undefined;
	const list = page === 'pathway' || page === 'term' ? undefined : PAGES[page as ListPageName];
	const title = pathway?.title ?? term?.term ?? list!.title;
	const description = pathway ? pathway.description : term ? term.definition : list!.description;
	const kind: Kind | undefined = page === 'pathway' ? 'pathways' : page === 'glossary' || page === 'term' ? undefined : page;
	const sidebar = useMemo(() => kind && sectionSidebar(catalog, kind), [catalog, kind]);
	// Link previews need a full URL (SITE_URL), and can't be SVG on most sites: otherwise the site's
	// card (themeConfig.image) is used. Docs pages get theirs from `image` (scripts/frontmatter.mjs).
	const ogImage = useBaseUrl(pathway?.image ?? '', { absolute: true });
	const ownPreview = !!pathway?.image && !/\.svg$/i.test(pathway.image);
	const main = (
		<div className="lms-catalog-content">
			<Content page={page} pathway={pathway} glossary={glossary} entry={term} />
			<SiteFooter />
		</div>
	);
	return (
		<HtmlClassNameProvider className={clsx('lms-catalog-page', `lms-catalog-${page}`)}>
			<Layout title={title} description={description ?? undefined}>
				<Head>{ownPreview && <meta property="og:image" content={ogImage} />}</Head>
				{kind && sidebar ? (
					<DocsSidebarProvider name={`catalog-${kind}`} items={sidebar}>
						<DocRootLayout>{main}</DocRootLayout>
					</DocsSidebarProvider>
				) : (
					<main className="container margin-vert--lg lms-no-sidebar">{main}</main>
				)}
			</Layout>
		</HtmlClassNameProvider>
	);
}
