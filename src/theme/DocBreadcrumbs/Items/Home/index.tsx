// Replaces the breadcrumbs' home icon. On lesson pages the trail starts with "Courses"
// (Courses › Course › Section › Lesson); elsewhere it starts with the sidebar's group (the
// course list, the course, or Pro Labs), so there's no home link. On phones the breadcrumb bar
// leaves "Courses" out (src/css/site/page-layout.css), to keep room for the course and lesson.
import React from 'react';
import Link from '@docusaurus/Link';
import { useLocation } from '@docusaurus/router';

export default function HomeBreadcrumbItem() {
	const { pathname } = useLocation();
	if (!/^\/courses\/[^/]+\/.+/.test(pathname)) return null;
	return (
		<li className="breadcrumbs__item lms-crumb-home">
			<Link className="breadcrumbs__link" to="/courses/">
				Courses
			</Link>
		</li>
	);
}
