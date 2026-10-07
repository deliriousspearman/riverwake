// Home page: a hero with a terminal
// starting a learning session, a "Continue learning" banner for returning visitors, then a preview
// of each part of the catalogue (the first few courses, pathways and pro labs by `order`), each
// linking to its own page, where the full lists and the filter bar live.
import React, { useEffect } from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import { useHistory } from '@docusaurus/router';
import ContinueBanner from '../components/ContinueBanner';
import CourseList from '../components/CourseList';
import LabList from '../components/LabList';
import PathwayList from '../components/PathwayList';
import SiteFooter from '../components/SiteFooter';
import { useCatalog } from '../lib/catalog';

function HeroTerminal() {
	return (
		<div className="hero-terminal" role="img" aria-label="A terminal starting a learning session">
			<div className="hero-terminal-bar">
				<span>learner@codex: ~</span>
			</div>
			<div className="hero-terminal-body">
				<p>
					<span className="prompt">$</span> ./start --pace=self --account=none
				</p>
				<p className="ok">[+] No sign-up needed</p>
				<p className="ok">[+] Progress saved in this browser</p>
				<p className="ok">[+] Videos and terminal recordings ready</p>
				<p>
					<span className="prompt">$</span> <span className="cursor" />
				</p>
			</div>
		</div>
	);
}

function Section({ id, title, link, children }: { id: string; title: string; link: React.ReactNode; children: React.ReactNode }) {
	return (
		<section className="home-section not-content" aria-labelledby={id}>
			<div className="home-section-head">
				<h2 id={id}>{title}</h2>
				{link}
			</div>
			{children}
		</section>
	);
}

export default function Home() {
	const { courses, pathways, labs, features } = useCatalog();
	const history = useHistory();
	// The catalogue used to be tabs on this page: send old #pathways and #labs links to their pages.
	useEffect(() => {
		const moved: Record<string, string> = { '#pathways': '/pathways/', '#labs': '/labs/' };
		const follow = () => moved[location.hash] && history.replace(moved[location.hash]);
		follow();
		window.addEventListener('hashchange', follow);
		return () => window.removeEventListener('hashchange', follow);
	}, [history]);

	return (
		<Layout title="Learn cyber security" description="Free, self-paced cyber security courses. No account needed.">
			<main className="lms-splash">
				<div className="lms-hero">
					<div className="lms-hero-text">
						<h1 className="lms-hero-title">Learn cyber security</h1>
						<p className="lms-hero-tagline">Free, self-paced courses. Work through the text and videos at your own speed — no sign-up required.</p>
					</div>
					<div className="lms-hero-html">
						<HeroTerminal />
					</div>
				</div>
				<div className="lms-splash-content">
					<ContinueBanner />
					<Section id="home-courses" title="Courses" link={<Link to="/courses/">View all courses ({courses.length}) →</Link>}>
						<CourseList limit={3} />
					</Section>
					<Section id="home-pathways" title="Pathways" link={<Link to="/pathways/">View all pathways ({pathways.length}) →</Link>}>
						<p className="catalog-intro">Curated sequences of courses. Work through them in order.</p>
						<PathwayList limit={2} />
					</Section>
					{features.proLabs && labs.length > 0 && (
						<Section id="home-labs" title="Pro Labs" link={<Link to="/labs/">View all pro labs ({labs.length}) →</Link>}>
							<p className="catalog-intro">Realistic networks of vulnerable machines to attack from start to finish.</p>
							<LabList limit={2} />
						</Section>
					)}
					<SiteFooter />
				</div>
			</main>
		</Layout>
	);
}
