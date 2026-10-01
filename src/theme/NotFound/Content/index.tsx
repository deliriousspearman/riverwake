// The 404 page: a short explanation, links to the courses and
// pathways, and the course list.
import React from 'react';
import CourseList from '../../../components/CourseList';
import { LinkButton } from '../../../components/Progress';
import SiteFooter from '../../../components/SiteFooter';

export default function NotFoundContent({ className }: { className?: string }) {
	return (
		<main className={`container margin-vert--lg lms-splash ${className ?? ''}`}>
			<div className="lms-hero lms-hero-plain">
				<div className="lms-hero-text">
					<h1 className="lms-hero-title">Page not found</h1>
					<p className="lms-hero-tagline">
						This page doesn't exist, or it has moved. Lessons sometimes move when a course is reorganised, so try the courses below or search (Ctrl K) for the lesson's title.
					</p>
					<div className="lms-hero-actions">
						<LinkButton to="/courses/">All courses →</LinkButton>
						<LinkButton to="/pathways/" variant="minimal">
							Pathways
						</LinkButton>
					</div>
				</div>
			</div>
			<p className="catalog-intro not-content">Or pick up a course:</p>
			<CourseList />
			<SiteFooter />
		</main>
	);
}
