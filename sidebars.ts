// One sidebar per course, plus the course list and the pro labs, built from the folders under
// docs/ (scripts/content.mjs, buildSidebars). Which one a page shows is set by `displayed_sidebar`
// (scripts/frontmatter.mjs). In `npm run dev`, adding, removing or reordering lessons reloads this.
import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';
import { buildSidebars } from './scripts/content.mjs';

// buildSidebars is plain JavaScript, so TypeScript sees its literal types as strings.
const sidebars = buildSidebars() as SidebarsConfig;

export default sidebars;
