# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Codex, a course site built with Docusaurus 3.10: courses of lessons (optionally in sections), pathways, pro labs, a glossary, per-browser progress, quizzes/exercises/timelines/diagrams/terminals/recordings, themes, a banner, a Sveltia CMS admin editor at `/admin/`, and a site guide for editors at `/guide/`. There are no accounts: progress lives in each visitor's `localStorage`.

Pages keep their own frontmatter field names (`kind`, `sidebar.order`, `sidebar.hidden`, `aliases`, …); `scripts/frontmatter.mjs` maps what Docusaurus needs as pages are read. Add the mapping there rather than renaming fields in content, and keep `cms/config.yml` in step.

## Commands

Node 20+ (the pipeline uses Node 22; `node --test` there won't accept a directory, hence the glob).

```sh
npm install
npm run dev          # dev server on :3000 (shows drafts); runs scripts/prepare.mjs first
npm run build        # production build to build/; fails on any content problem (prebuild: prepare.mjs, check-mermaid.mjs; postbuild: site-size.mjs, the GitLab Pages size limit)
npm run serve        # serve build/ (search only works here, its index is built at build time)
npm run typecheck    # tsc
npm test             # node --test tests/*.test.mjs
node --test tests/content.test.mjs                        # one test file
node --test --test-name-pattern="guide" tests/*.test.mjs  # tests by name
```

A production-like build needs `SITE_URL` (e.g. `SITE_URL=https://codex.pages.example.com npm run build`). `docusaurus.config.ts` throws if `SITE_URL` has a path: the site only works at a domain root (links, `/videos/`, `/vendor/` and progress keys are root paths).

## Architecture

**Content model** (`scripts/content.mjs` is the single reader of content from disk):
- `docs/courses/<course>/index.md` is a course overview (`kind: course`); lessons are `docs/courses/<course>/<lesson>.md` or one level of numbered section folders `<NN-section>/<lesson>.md`. Order: root lessons, then sections by folder name, each by `sidebar.order` (`scripts/sections.mjs`).
- `docs/labs/<lab>.md` are pro labs; `docs/guide/` is the site guide for editors (read like a course folder by `readGuide`, linked from the footer). It is also the live reference for every lesson feature (there is no demo course): guide pages may set `video`, `captions` and `attachments` like a lesson (`guideAttachments` in the catalogue), which `DocItem/Content` shows.
- `content/pathways/*.yml`, `content/glossary/*.yml`, `content/settings/{theme,banner}.yml`.
- `content/lab-flags/<lab>.yml`: a pro lab's flags (`machine`, `label`, `flag`). Never put flag values in `docs/labs/*.md`: frontmatter ships in the public JS. `plugins/lms-content.mjs` publishes only `flagList` (`scripts/lab-flags.mjs`: hash = sha256 of `codex-flag:<slug>:<flag trimmed>`, id = its first 16 hex); `src/lib/lab-flags.ts` hashes a submission the same way (tests check they agree) and keeps captures in `lms-lab-flags-v1` (not in backups or Reset). UI in `src/components/LabFlags.tsx`.
- `draft: true` (on a lesson or a course overview) leaves pages out of production builds; `sidebar.hidden` keeps a lesson reachable but out of lists and progress.

**How it's wired:** content is read straight from disk at config time, before the docs plugin loads, so sidebars and redirects exist early:
- `sidebars.ts` → `buildSidebars()`: one sidebar per course, plus `courses`, `labs` and `guide`. Pages pick theirs via `displayed_sidebar`, set in `scripts/frontmatter.mjs` (`sidebarFor`) through `markdown.parseFrontMatter`, which also maps the pages' own fields (`sidebar.order` → `sidebar_position`) and sets `hide_title`.
- `plugins/lms-content.mjs` validates everything against the zod schemas in `scripts/schema.mjs` (plus `labProblems`, pathway and glossary checks, and the uploads under `static/` via `scripts/static-files.mjs`) and throws one error listing every problem with its file. It publishes the catalogue as global data (`src/lib/catalog.ts` types it; components use `useCatalog()`, and look things up with its cached helpers `courseOf`, `lessonOf`, `labOf`, `pathwayOf`, `pathwayCourses` rather than `.find`), except the glossary, which only its own routes get (as route data modules), and adds the catalogue routes (`/courses/`, `/pathways/`, `/labs/`, `/glossary/…`). Page dates come from frontmatter or git history (`scripts/dates.mjs`; `content/imported-dates.json` keeps the original dates of pages that predate this repo), which is why the pipeline clones with `GIT_DEPTH: 0`.
- Course/lesson aliases (old paths) become client redirects (`courseRedirects`) and migrate stored progress. `scripts/removed-pages.mjs` fails the build for any course/lesson file git history shows was deleted or renamed whose address is now neither a page, an alias, nor listed in `content/settings/removed-pages.yml` (needs full history; skipped with a warning in a shallow clone).
- `plugins/remark-lms-blocks.mjs`: ` ```quiz `, ` ```exercise `, ` ```asciinema `, ` ```timeline ` (YAML, rendered by `scripts/blocks.mjs`) and ` ```terminal[-colour] ` (`scripts/terminal.mjs`) become explicit MDX JSX with the markup the stylesheets in `src/css/site/` (one per block: `quiz.css`, `exercise.css`, `timeline.css`, …) and `src/client/*` (`clientModules`) expect. Invalid blocks fail the build. `timeline` is CSS-only. ` ```mermaid ` is Docusaurus's own (`@docusaurus/theme-mermaid`, `markdown.mermaid`), drawn in the browser by `src/theme/Mermaid` with colours, outline width and corner radius read from the theme's CSS variables (`src/lib/mermaid.ts`, so any theme works). `scripts/check-mermaid.mjs` (npm `prebuild`) parses every diagram in `docs/` and fails with the file and line; it runs as a plain Node script because Mermaid can't be loaded through Docusaurus's plugin loader.
- `plugins/remark-glossary.mjs` marks the first use of each glossary term on lesson and lab pages at build time (not guides/overviews; `glossary: false` opts out).
- `plugins/lms-csp.mjs` adds a per-page Content-Security-Policy `<meta>` after the build (`scripts/csp.mjs`) and fails the build if a page embeds an image/video/frame from another site.
- `src/theme/DocItem/Content` wraps page content by kind (`pageKind()` in `src/components/DocParts.tsx`: course, lesson, lab, guide): title with picture and dates, lesson video and downloads, course lesson list, lab details. `src/lib/progress.ts` is the `localStorage` store (`lms-progress-v1`, `lms-last-lesson-v1`). Progress and the last lesson are cached separately; use the narrowest hook (`useIsDone(path)`, `useProgressMap`, `useLastLesson`, `useStorageWorks`) so a component only re-renders when what it shows changes. Backup, restore and reset are on the Settings page (`src/pages/settings.tsx`, linked from the footer in `src/components/SiteFooter.tsx`), with the visitor's preferences (`src/lib/preferences.ts`, key `lms-preferences-v1`; "Hide completed" keeps its older `lms-hide-completed`). Each preference is mirrored on `<html>` as `data-lms-<name>`, which CSS reads (`src/css/site/preferences.css`); `src/head/preferences.js` (copied to `static/head/` by `prepare.mjs`, loaded by `headTags`) sets them before the page is drawn so nothing jumps. Players read speed and captions from `getPreferences()` as they start. Shared card parts (`CourseProgressCard`, `LevelChip`, `CardList`, `completeText`) live in `src/components/Progress.tsx`.
- Themes are chosen at build time from `content/settings/theme.yml` (`scripts/themes.mjs` loads the fonts, then the site's stylesheets `src/css/site/*.css` in the order listed in `SITE_STYLESHEETS` (`theme.css` holds the variables every other file uses; the order matters where two rules set the same thing, so add a new file there, in place), then `src/css/themes/*.css` over them).

**Admin editor:** `cms/config.yml` and `cms/index.html` (the page, with its own CSP `<meta>`) are templates rendered into `static/admin/` by `scripts/prepare.mjs`, which also copies `cms/frame-guard.js` there. `${VAR}` comes from the environment and only the variables listed in `prepare.mjs` are allowed, since the output is public (`CI_PROJECT_PATH`, `CMS_GITLAB_URL`, `CMS_BRANCH`, `CMS_APP_ID`, `SITE_URL`, …; defaults point at `group/codex` on `https://gitlab.example.com`). Keep its fields in step with `scripts/schema.mjs`: `tests/cms.test.mjs` checks both directions (every editor field is in the schema, every schema field is editable except `NOT_IN_EDITOR`) and validates the config against Sveltia's own JSON schema. `static/admin/`, `static/vendor/` and `static/head/` are generated and git-ignored. The page preview (`cms/preview.mjs`, registered with `CMS.registerPreviewTemplate` for courses, lessons, labs and guide) renders the Markdown with mdast → hast → DOM (raw HTML dropped, never `innerHTML`: the editor's GitLab token is on this origin) and the site's blocks through `renderCodeBlock` from `plugins/remark-lms-blocks.mjs`, the same code as the build; `prepare.mjs` bundles it with esbuild (stand-ins for its Node-only imports) and bundles the theme's stylesheets and fonts plus `cms/preview.css` for `CMS.registerPreviewStyle`.

**Security rules** (README → Security). The admin editor keeps the editor's GitLab token in `localStorage` on the site's origin, so nothing on the site may run script it didn't ship:
- The CSP hashes only Docusaurus's own inline scripts: those between `<body>` and `<div id="__docusaurus">` (the theme script), or the client-redirects redirect line on pages without the app root. Any other inline script fails the build. Don't add inline scripts; use `clientModules`, or for something that must run before the page is drawn a file like `src/head/preferences.js`. `baseUrlIssueBanner` is off for this reason.
- `plugins/rehype-safe-html.mjs` (docs `rehypePlugins`) fails on raw `<script>`/`<iframe>`/`<form>`/…, `on*` attributes and `javascript:` URLs in content. `src/theme/DocBreadcrumbs/StructuredData` escapes `<` in the JSON-LD, so a title can't end its script.
- `scripts/static-files.mjs`: each `static/` folder takes only its own file types (`STATIC_TYPES`; a new folder must be added there), and SVGs must have no scripts, handlers, `<foreignObject>` or outside links.

**Diagrams:** `templates/drawio/` holds seven draw.io templates (one per layout) and a shape library in the site's style, all generated by `templates/drawio/generate.mjs` (edit that, not the files; not published; editors download them from GitLab, see `docs/guide/02-content/diagrams.md`). Diagrams go on pages as `<name>.drawio.svg` exports (SVG with "Include a copy of my diagram", so the file is also the editable diagram). `plugins/remark-drawio.mjs` puts each one into the page as inline SVG (selectable text, the site's fonts via `src/css/site/drawio.css`, click to enlarge), read through the allowlist in `scripts/drawio-svg.mjs`: only drawing elements and attributes; HTML labels (`<foreignObject>`, from draw.io's Formatted Text or Word wrap), scripts, handlers and outside links fail the build; `<style>` (draw.io's Google Fonts import) and `style` attributes (`light-dark()` colours) are dropped. The same reader checks uploads (`scripts/static-files.mjs`) and, in `lms-content`'s postBuild, rewrites the published copy of each file cleaned. So the templates use plain-text labels (no `html=1`, no `whiteSpace=wrap`; a host's address is a child text cell); `tests/drawio.test.mjs` checks that.

**Videos** are in `static/videos/` via Git LFS (`.gitattributes`); `tests/videos.test.mjs` fails if one was committed without LFS. Keep them short: GitLab Pages doesn't serve byte ranges, so seeking in long videos is poor.

## Publishing

One branch, one site. `.gitlab-ci.yml`: merge requests run `check` (test, typecheck, build); every push to `main` (including each admin editor save, which commits straight to `main`) runs the `pages` job (test, build with `SITE_URL=$CI_PAGES_URL`, publish `build/` to GitLab Pages, artifacts expire after 1 day). A failed pipeline publishes nothing. There is no staging site. Only Maintainers can push to `main`, so admin editor users need Maintainer access. The pipeline image is pinned by digest. Server-side hardening (Pages headers, certificate, 2FA, runner) is a checklist in the README, not something the repo can enforce.

## Offline installations and copies

- The site and the admin editor load nothing from the internet: the editor's UI fonts are copied from pinned @fontsource packages by `scripts/prepare.mjs` (it fails if Sveltia's font URLs or versions change), and its page policy names no outside host but GitLab (`tests/cms.test.mjs`).
- The pipeline's image is `$PIPELINE_IMAGE` (default: the pinned `node:22-bookworm`), and `npm ci` uses `$NPM_CACHE`. Offline, `ci/Dockerfile` builds an image with a pre-filled npm cache (README → Running offline); keep its `FROM` the same as the pinned image (`tests/ci.test.mjs`).
- draw.io offline: `templates/drawio/generate.mjs --no-font-source`, with the fonts in `templates/drawio/fonts/`.

## Conventions

- Build-time checks fail with the file and the problem; content rules belong in `scripts/schema.mjs` / plugin checks, with tests in `tests/` (throwaway content folders via `tests/helpers.mjs`; `importTs` there loads a `src/` TypeScript module whose own imports are packages or types). Build-time readers cache: `readFrontmatter` by file mtime and size, git dates from one `git log` pass (`scripts/dates.mjs`).
- Files are commented at the top with what they do and how they fit in; follow that style.
- The `lms-` prefix on CSS classes and variables, plugin names and storage keys is just a name (learning management system). Never rename the `localStorage` keys: every learner would lose their progress.
- `README.md` documents workflows for maintainers; `docs/guide/` documents them for editors. Update both when a workflow changes.
