// Course cards: the first few on the home page (`limit`), all of them on /courses/. `data-filter`
// and `data-level` are what the filter bar matches (CatalogFilter.tsx).
import React from 'react';
import { useCatalog } from '../lib/catalog';
import { CardList, CourseProgressCard, type IsShown } from './Progress';

export default function CourseList({ limit, isShown }: { limit?: number; isShown?: IsShown }) {
	return (
		<CardList items={useCatalog().courses} limit={limit} className="course-list" empty="No courses published yet.">
			{(course) => <CourseProgressCard key={course.slug} course={course} as="article" className="course-card" heading="h2" filterable hidden={isShown ? !isShown(course) : undefined} />}
		</CardList>
	);
}
