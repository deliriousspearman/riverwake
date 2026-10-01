# Codex

Codex, the course site, built with [Docusaurus](https://docusaurus.io) 3.10:

- courses of lessons (optionally in sections), pathways, pro labs and a glossary;
- progress saved in the browser, with "Complete & continue", progress bars and "Continue learning";
- quizzes, exercises, timelines, Mermaid diagrams, draw.io network diagrams (shown as part of the page,
  with selectable text), coloured terminal windows and terminal recordings;
- the Hacklab themes, a site banner, and an admin editor (Sveltia CMS) at `/admin/`;
- a site guide for editors at `/guide/`.

There are no accounts: progress (completed lessons, and quiz answers) lives in each visitor's
`localStorage`. The Settings page
(`/settings/`, linked from the footer) moves it to another browser or device as a small JSON file
("Download a backup", then "Restore from a backup"; restoring merges, so nothing already completed
is lost), and resets it. It also holds each visitor's preferences, kept in the same browser: hide
completed courses, glossary underlines, video captions and playback speed, text size, text width,
wrapping long code lines, showing "On this page" (also collapsed and shown by the button at the right of the breadcrumb bar), pinning the breadcrumb bar under the navbar (on by default), how "On this page" moves to a heading (a quick scroll by default, or instantly) and reduced motion. Backups carry these too, but restoring only fills in the ones the other browser
hasn't changed from the default.

## Install and run

Requires Node 20 or newer.

```sh
npm install
npm run dev          # development server with live reload, on http://localhost:3000
npm run build        # production build to build/
npm run serve        # serve build/ locally (same as `npm start`)
npm run typecheck    # TypeScript check of src/ and the config
npm test             # tests of the build scripts and content rules (tests/, Node's test runner)
```

`npm run dev` and `npm run build` first run `scripts/prepare.mjs`, which copies the admin editor
and the recording player's stylesheet from `node_modules` into `static/`.

Search only works in a production build (`npm run build`, then `npm run serve`), because its
index is created by the build. It covers lessons and labs (a result per heading) and the glossary:
each term has its own page, `/glossary/<term>/`, so searching a term finds its definition.

A build fails when content breaks a rule, and the error names the file and the problem. For
example:

- a quiz with no correct answer, or a misspelled field in a block;
- a pathway that names a course that doesn't exist;
- a pro lab that is missing required fields;
- a course picture over 200 KB, any other image over 1 MB (images over 500 KB get a warning), or a
  download of a type that isn't allowed;
- a file in `static/` of a type its folder doesn't take, or an SVG with a script in it;
- a Mermaid diagram that can't be drawn (checked by `scripts/check-mermaid.mjs` before the build);
- a draw.io diagram (`.drawio.svg`) with HTML labels, no copy of the diagram, or anything that isn't
  drawing (`scripts/drawio-svg.mjs`), or one in a page without alt text;
- a course or lesson page that was published and has gone (deleted or renamed, per git history)
  with no redirect (`aliases`) and no entry in `content/settings/removed-pages.yml`;
- raw HTML in a page that could run script (`<script>`, `onerror="…"`, `javascript:` links), or
  an inline script that isn't Docusaurus's own (see [Security](#security)).

## Publishing

The site is published with GitLab Pages by the pipeline in `.gitlab-ci.yml`. There is one branch,
`main`, and one site:

```
main ──push──▶ pipeline: npm test, build ──▶ GitLab Pages   https://<pages address>/
```

- **Every push to `main` publishes.** That includes the admin editor's saves, which are commits to
  `main`. The site updates a few minutes later. When several pushes arrive close together, each new
  pipeline cancels the older ones still running (`interruptible` jobs, `workflow: auto_cancel`), so
  only the latest is built and published.
- **Nothing broken is published.** The pipeline runs `npm test` and the build first, and both fail
  on broken code or content (see above). If either fails, the site stays as it was. Merge requests
  are tested and built too.
- **There is no staging site.** Check changes locally (`npm run dev`) or in the admin editor's
  preview before saving: it renders quizzes, timelines and the other blocks with the site's own code
  and styles, and shows the build's message for a block the build would reject. A `SITE_ENV=staging` build still adds a "Staging" strip, for when there is
  one again.

GitLab Pages only serves the built files:

- **Videos** are part of the site: they're kept in the repository with Git LFS and published with
  every deploy (see [Videos](#videos)).
- **Response headers** can't be set per site. Each page's Content-Security-Policy `<meta>` tag
  applies, but framing protection and the other headers have to come from the Pages server (see
  [Security checklist for a new installation](#security-checklist-for-a-new-installation)).
- **Captions:** check that a lesson's captions show in Firefox, which needs `.vtt` files served as
  `text/vtt`.

### One-time setup

1. **Turn on GitLab Pages** for the GitLab instance (admin: `pages_external_url` in
   `/etc/gitlab/gitlab.rb`, wildcard DNS for the Pages domain and a certificate for it; see
   GitLab's "GitLab Pages administration" docs). **Git LFS** must be on too, for the instance
   (`gitlab_rails['lfs_enabled']`, on by default) and the project (Settings → General → Visibility):
   lesson videos are stored with it.
2. **Push the project** to an empty GitLab project with git-lfs installed (`git lfs install` once
   per machine): `git remote add origin <project URL>`, then `git push -u origin main`. The videos
   upload with it. The first pipeline runs straight away; set the variables below first, or run it
   again afterwards (Build → Pipelines → Run pipeline).
3. **Give the site its own domain.** The site only works at the root of a domain. In the project,
   Deploy → Pages → "Use unique domain" must be on (the default for new projects), or add a custom
   domain and set a `SITE_URL` CI/CD variable to it. If Pages would put the site under a path such
   as `/codex/`, the build fails and says so. Under Settings → General → Visibility, set who
   can see the Pages site. If Deploy → Pages only shows a setup wizard, don't use it: it commits a
   `.gitlab-ci.yml` of its own. The project already has one; once a pipeline has published, the
   Pages settings appear instead.
4. **Protect `main`** (Settings → Repository → Protected branches): allowed to push and merge
   Maintainers, force push off. The admin editor saves straight to `main`, so editors need
   **Maintainer** access. That also lets them change the project's CI/CD settings, so give it only
   to people you trust with the site.
5. **Runner.** A small dedicated VM (2 vCPU, 4 GB) with Docker Engine and `gitlab-runner`, using the
   Docker executor (the pipeline uses the `node:22-bookworm` image, pinned by digest). It needs to reach GitLab,
   Docker Hub and the npm registry (without internet access, see [Running offline](#running-offline)).
   Register it as a project runner with "Run untagged jobs" ticked.
6. **Admin editor sign-in.** Create a GitLab application (User settings → Applications, or the
   group's): not confidential, scope `api`, redirect URI `https://<pages address>/admin/` (add a
   line for each other address the site is served at). Put its ID in a `CMS_APP_ID` CI/CD variable.
   The editor signs in at GitLab's own address (`CI_SERVER_URL`, from the pipeline). If editors'
   browsers reach GitLab at another address (a proxy, or GitLab's `external_url` is an internal
   address), set `CMS_GITLAB_URL` in `.gitlab-ci.yml` to the address they use.

### Running offline

Everything the site and the admin editor show is served by the site itself: fonts, scripts,
diagrams, search and the recording player. Neither a learner's nor an editor's browser contacts
anything but the site and GitLab. Building it needs packages, though, so a GitLab without internet
access needs these, prepared on a machine that has it:

- **The pipeline's image.** `ci/Dockerfile` builds an image with Node and every npm package the
  project uses already downloaded. Build it, tagged with the lock file's hash, and save it:

  ```sh
  TAG=$(sha256sum package-lock.json | cut -c1-12)
  docker build -f ci/Dockerfile -t codex-ci:$TAG .
  docker save codex-ci:$TAG | gzip > codex-ci-$TAG.tar.gz
  ```

  On the offline side, `docker load -i codex-ci-$TAG.tar.gz`, tag and push it to the GitLab
  container registry (or any registry the runner can reach), then set three CI/CD variables:
  `PIPELINE_IMAGE` to its address, `NPM_CACHE` to `/opt/npm-cache` and `NPM_CONFIG_OFFLINE` to
  `true`. The jobs then install everything from the image. **Rebuild it whenever
  `package-lock.json` changes**: a package missing from it fails the pipeline at `npm ci`, naming it.
- **The runner.** Install `gitlab-runner` and its `gitlab-runner-helper-images` package (the helper
  image every job needs, which the runner otherwise downloads from GitLab's registry), both from
  the same release.
- **draw.io**, for network diagrams: a copy inside the network, from the `jgraph/drawio` image
  (`docker run -d -p 8080:8080 jgraph/drawio`, saved and loaded like the pipeline's image), or
  the draw.io desktop app. Generate the templates with
  `node templates/drawio/generate.mjs templates/drawio --no-font-source`, so they don't ask for
  Google Fonts, and have editors install the fonts in `templates/drawio/fonts/` once.
- **Adding or updating packages** (`npm install`) needs the npm registry, so do it on the machine
  with internet access, commit `package-lock.json`, and rebuild the image.

## Starting a new site from this project

The project is a site, not just its content: to run another one, start from a copy with placeholder
content and change these.

- **Content.** Courses, labs, pathways and glossary terms are files (see [Updating content](#updating-content)),
  or use the admin editor. The site guide (`docs/guide/`) documents every feature for editors; keep it
  and update its examples if you like.
- **Name and look.** `TITLE` and `DESCRIPTION` in `docusaurus.config.ts`, the theme in
  `content/settings/theme.yml`, the favicon (`static/favicon.svg`) and the link-preview picture
  (`templates/social-card/`).
- **Pro lab flags.** `content/lab-flags/` holds placeholders: set the real ones, or delete a lab's
  file and give the lab page a `flags` count instead.
- **CI/CD variables:** `CMS_APP_ID` (admin editor sign-in), `SITE_URL` for a custom domain, and the
  offline ones if GitLab has no internet access (see [Running offline](#running-offline)).
- **GitLab.** The [one-time setup](#one-time-setup) and the
  [security checklist](#security-checklist-for-a-new-installation).


## Security

The site is static and has no accounts, so the risks are about what runs in a visitor's or an
editor's browser. The admin editor keeps the signed-in editor's GitLab token in the browser, on the
same address as the site. So the site must never run a script it didn't ship, and the build makes
sure of that:

- **Every page has a Content-Security-Policy** (`<meta>` tag, `plugins/lms-csp.mjs` and
  `scripts/csp.mjs`). It allows the site's own script files and only Docusaurus's own inline
  scripts, by hash. Any other inline script fails the build. (So the preferences script that must
  run before the page is drawn is a file, `src/head/preferences.js`, copied to `/head/`.)
- **Content can't carry script.** Raw HTML in a page that could run script fails the build, naming
  the file (`plugins/rehype-safe-html.mjs`). Quiz, exercise and timeline text is only ever text, and
  page titles are escaped wherever they appear.
- **Uploads can't carry script.** Each `static/` folder takes only its own file types, with no HTML
  or JavaScript anywhere, and SVGs must be plain pictures (`scripts/static-files.mjs`). Downloads
  can't be HTML or SVG.
- **Diagrams put into pages are rebuilt from an allowlist.** A `.drawio.svg` is shown inline, so
  `scripts/drawio-svg.mjs` reads it into drawing elements and attributes only (no `<style>`, no
  `style` attributes, ids made local) and fails the build on HTML, scripts, handlers or outside
  links. The published copy of the file is replaced with the cleaned one after the build.
- **The admin editor's page** (`cms/index.html`) has its own, looser policy (the editor talks to the
  GitLab API) and refuses to run inside a frame (`cms/frame-guard.js`).
- **Pinned dependencies.** The admin editor, the recording player and the pipeline's Node image
  are pinned to exact versions, and the editor is served from the site, not a CDN.
  `serialize-javascript` is raised to a fixed version through `overrides` in `package.json` (it's
  only used by the build). `npm audit` still lists `webpack-dev-server`, which only runs with
  `npm run dev` on your own machine.

### Security checklist for a new installation

The build protects the site itself (above); GitLab needs setting up to match. Do these when
installing the project somewhere new.

**Accounts and tokens**

- Turn on two-factor authentication for every account that can edit, and require it for admins
  (Admin → Settings → General → Sign-in restrictions).
- Edit content with an account that is a Maintainer of this project only, not a GitLab admin: a
  stolen editor token then can't reach the rest of GitLab.
- For scripts and automation, use a project access token (Settings → Access tokens; Maintainer,
  short expiry) rather than an admin's personal access token.

**Pages response headers.** GitLab Pages can't set headers per site, but an admin can add them to
every Pages site in `/etc/gitlab/gitlab.rb`, then run `sudo gitlab-ctl reconfigure`:

```ruby
gitlab_pages['headers'] = [
  "X-Frame-Options: DENY",
  "X-Content-Type-Options: nosniff",
  "Referrer-Policy: strict-origin-when-cross-origin",
  "Permissions-Policy: camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy: frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
]
```

These stop other sites showing the site or the admin editor in a frame (clickjacking), and stop
browsers guessing file types. Check them with `curl -sI https://<pages address>/admin/`. Each page's
own script policy still comes from its `<meta>` tag.

**A trusted certificate for the Pages domain**, e.g. a Let's Encrypt wildcard certificate for
`*.<pages domain>` (DNS challenge). With a self-signed certificate, people learn to click through
browser warnings, and anyone on the network could pose as the site and capture an editor's sign-in.

**Project settings**

- Deploy → Pages: access "Everyone". A "private" setting is ignored while Pages access control is
  off on the instance, and locks learners out as soon as it's turned on.
- Settings → Merge requests: "Pipelines must succeed".
- Settings → CI/CD → Variables: minimum role to use pipeline variables, Maintainer.
- Settings → CI/CD → Job token permissions: limit access to this project.
- Settings → CI/CD → General pipelines: "Use separate caches for protected branches" on.

**Runner.** In the runner's `config.toml`, `privileged = false` and no `/var/run/docker.sock`
volume. Ideally give this project a runner of its own (or a protected one for the `pages` job), so
jobs from other projects or merge requests can't affect the one that publishes.

**Admin editor sign-in.** The GitLab application (step 5 of the one-time setup) must be **not
confidential**, have only the `api` scope, and have exactly `https://<pages address>/admin/` as its
redirect URI.

## Project layout

```
docs/courses/<course>/…       courses and lessons (Markdown)
docs/labs/<lab>.md            pro labs
docs/guide/                   the site guide for editors (footer → Site guide): how to edit and publish
content/pathways/*.yml        pathways
content/glossary/*.yml        glossary terms
content/lab-flags/*.yml       each pro lab's flags (values; only their hashes are published)
content/settings/*.yml        site settings: theme.yml, banner.yml
content/imported-dates.json   original dates of pages that predate this repository (scripts/dates.mjs)
static/                       images, downloads (files/), captions, recordings (casts/), videos, favicon
cms/                          admin editor templates: config.yml, index.html (with its policy), frame-guard.js,
                              and its page preview (preview.mjs, preview.css; bundled by scripts/prepare.mjs)
plugins/                      the site's own Docusaurus and remark plugins
scripts/                      build-time helpers the plugins and config use
tests/                        tests of those helpers (npm test)
templates/social-card/        source of the link-preview picture (static/images/social/codex.png)
templates/drawio/             draw.io templates (7 layouts), shapes and their generator (not published; guide → Network diagrams)
src/components/               React components (catalogue pages, cards, lesson parts)
src/theme/                    Docusaurus theme components wrapped or replaced ("swizzled")
src/client/                   browser scripts for quizzes, glossary tips, recordings, copy buttons, click to enlarge
src/lib/                      catalogue data types, the progress store and preferences
src/head/                     preferences.js: applies preferences in <head>, before the page is drawn
src/pages/                    the home page and the Settings page
src/css/site/                 the site's styles, one file per part (theme.css: the variables; navbar, quiz, …),
                              loaded in the order listed in scripts/themes.mjs
src/css/themes/               the other themes, overriding theme.css's variables
docusaurus.config.ts          site configuration
sidebars.ts                   one sidebar per course, plus the course list, pro labs and the site guide
```

## Plugins

### Docusaurus plugins and packages (not custom)

| Package | What it does here |
|---|---|
| `@docusaurus/core`, `@docusaurus/preset-classic` | The site itself: docs, pages, sitemap and the classic theme (navbar, sidebars, breadcrumbs, "On this page", light/dark mode, announcement bar). |
| `@docusaurus/faster` | Rspack and SWC for faster builds. |
| `@docusaurus/plugin-client-redirects` | Redirects the old addresses of moved lessons and courses (their `aliases` field) to the new ones. |
| `@easyops-cn/docusaurus-search-local` | Offline search. Glossary tooltip text is kept out of the results. |
| `@fontsource/chakra-petch`, `@fontsource-variable/figtree`, `@fontsource-variable/jetbrains-mono` | Self-hosted fonts for headings, body text and code. |
| `asciinema-player` | Plays terminal recordings. |
| `@docusaurus/theme-mermaid` | ` ```mermaid ` diagrams (flowcharts, sequence diagrams, …), drawn in the browser. Mermaid is only downloaded on pages that have one. |
| `@sveltia/cms` | The admin editor at `/admin/`. |
| `prism-react-renderer` | Syntax highlighting (Night Owl themes). |
| `zod`, `yaml`, `unist-util-visit`, `mdast-util-from-markdown`, `parse5` | Libraries the custom plugins use: content checks, YAML, Markdown and HTML trees. |

### Custom plugins (in this repository)

| Plugin | What it does |
|---|---|
| `plugins/lms-content.mjs` | Reads courses, lessons, labs, the site guide, pathways, the glossary and the banner settings, and checks them (`scripts/schema.mjs` and the rules in `scripts/`). Any problem fails the build. It publishes the catalogue to every page as site data (the glossary only to the glossary pages) and adds the pages `/courses/`, `/pathways/`, `/pathways/<id>/`, `/labs/` and `/glossary/`. It also works out the "Created" and "Last updated" dates. |
| `plugins/remark-lms-blocks.mjs` | Turns the special code blocks into their markup at build time: ` ```quiz `, ` ```exercise `, ` ```asciinema `, ` ```timeline ` and ` ```terminal ` (with its colour variants). It also gives shell code blocks (` ```sh ` and similar) a terminal window frame. |
| `plugins/remark-drawio.mjs` | Puts draw.io diagrams (`.drawio.svg` images on a line of their own) into the page as SVG, through the allowlist in `scripts/drawio-svg.mjs`, so their text can be selected and found. |
| `plugins/remark-glossary.mjs` | Marks the first use of each glossary term on lesson and lab pages, with its definition in a tooltip, at build time. |
| `plugins/lms-csp.mjs` | Adds a Content-Security-Policy to every page after the build, allowing only Docusaurus's own inline scripts. The build fails if a page has any other inline script, or embeds an image or video from another site. It also stops fonts being embedded in a way the policy would block. |
| `plugins/rehype-safe-html.mjs` | Fails the build, naming the file, if a page's raw HTML could run script: `<script>`, `<iframe>`, `<form>` and similar, `on…` attributes, `javascript:` links. |
| `sidebars.ts` + `scripts/content.mjs` | Builds one sidebar per course (Overview, lessons, then sections), the course list, the pro labs list and the site guide's sidebar, straight from the folders. |
| `scripts/frontmatter.mjs` | Maps the pages' own fields to Docusaurus's as pages are read (for example `sidebar.order` becomes the position, and each page gets its sidebar). |
| `scripts/themes.mjs` | Loads the theme chosen in `content/settings/theme.yml`: Hacklab, Hardline, Hardline Classic or Nightshift. |
| `scripts/prepare.mjs` | Copies the admin editor and the recording player's stylesheet into `static/`, and fills in the admin editor's page and settings from `cms/` (only the variables it lists). |
| `scripts/static-files.mjs` | Checks the uploads under `static/` (run with the content checks): each folder takes only its own file types, SVGs must be plain pictures, and `.drawio.svg` diagrams pass `scripts/drawio-svg.mjs`. |

### Theme components (in `src/theme/`)

These wrap or replace parts of Docusaurus's theme. Re-check them after upgrading Docusaurus.

| Component | Change |
|---|---|
| `DocItem/Content` (wrapped) | Adds the title with the course or lab picture and the page dates, the lesson video and downloads, the lesson list on course overviews, and the stats and machine list on lab pages. |
| `DocItem/Paginator` (replaced, same parts) | Adds "Complete & continue" and the end-of-course panel above previous/next, and the site footer under them. |
| `DocRoot/Layout` (wrapped) | A course overview opened from inside its course (`?view=course`) keeps the course's sidebar. |
| `DocSidebarItem/Link` (wrapped) | Adds ticks for completed lessons, and makes the Overview link keep the course sidebar. |
| `Mermaid` (replaced) | Draws ` ```mermaid ` diagrams in the selected theme's colours, outline width and corners for the current light/dark mode, read from the page's CSS variables (`src/lib/mermaid.ts`), with `:::highlight` and `:::attack` node classes. |
| `DocBreadcrumbs` (wrapped) | Puts the breadcrumbs in the breadcrumb bar, pinned under the navbar, with the button that collapses "On this page" on the right. Uses `useSidebarBreadcrumbs` and `useDoc` to know whether there's a trail and a table of contents. |
| `DocBreadcrumbs/StructuredData` (replaced) | The breadcrumbs' data for search engines, with `<` escaped so a page title can't end its script. |
| `DocBreadcrumbs/Items/Home` (replaced) | Starts the breadcrumbs with "Courses" on lesson pages instead of a home icon. |
| `AnnouncementBar` (wrapped) | Applies the banner's text size, bar height, bold and italic settings. |
| `NotFound/Content` (replaced) | The 404 page, with the course list. |
| `CodeBlock/Buttons/WordWrapButton` (wrapped) | With "Wrap long code lines" on in Settings, code blocks too wide for the page start wrapped, as if their "Toggle word wrap" button had been pressed. Uses `useCodeBlockContext` from `@docusaurus/theme-common/internal`. |
| `Root` | Moves saved progress from the old addresses of moved pages to their new ones. |

## Updating content

### Editing here

The site guide (`docs/guide/`, linked from the footer) explains editing and publishing for editors,
and shows every lesson feature working with the Markdown that produces it (its "Images, downloads
and video" page has a live video and downloads). Keep it in step when a workflow or feature changes.

**A course** is a folder: `docs/courses/<course>/index.md` is its overview.

```yaml
---
kind: course
title: Lorem Ipsum Course 4
description: Shown on the course card.
order: 4                     # position in the lists (lower first)
image: /images/icons/badge/courses/lorem-course-4.svg   # optional, square, up to 200 KB
sections:                    # optional section titles, by folder name
  01-foundations: Foundations
draft: true                  # optional: leaves the course and all its lessons out of the built site
                             # (still shown by npm run dev); works on a single lesson too
---
```

**A lesson** is `docs/courses/<course>/<lesson>.md`, or `docs/courses/<course>/<NN-section>/<lesson>.md`
when the course has sections. Sections are one level deep. Every `##` heading shows as a
numbered "Task".

```yaml
---
kind: lesson
title: Injection
description: Optional.
sidebar:
  order: 2                   # position in its course or section
video: /videos/lorem-course-4/02-lorem-lesson-2.mp4          # optional
captions: /captions/lorem-course-4/02-lorem-lesson-2.vtt     # optional WebVTT subtitles for the video,
                                                          # in git under static/captions/ (max 500 KB)
attachments:                 # optional downloads, files under static/files/
  - file: /files/lorem-course-4/cheat-sheet.pdf
    title: Injection cheat sheet
aliases: [/courses/lorem-course-4/01-injection]         # old addresses, if the lesson moved
glossary: false              # optional: don't mark glossary terms on this page
---
```

**A pro lab** is `docs/labs/<lab>.md`, with `kind: lab`, `level`, `environment` (`domain` or
`standalone`), `domain` (for domain labs), `entryPoint`, `flags`, `machines` and `skills`. See
`docs/labs/lorem-lab-1.md`. Use documentation address ranges and `.example` domains in examples.

**A pathway** is `content/pathways/<id>.yml`: `title`, `description`, `level`, `order`, optional
`image`, and `courses` (course folder names, in order).

**A pro lab's flags** are `content/lab-flags/<lab>.yml` (admin editor: Lab flags): `lab` and
`flags`, each with an optional `machine`, a `label` and the `flag` itself. Learners submit flags on
the lab's page to track their progress (in their browser, `lms-lab-flags-v1`). Flag values must
never go in `docs/labs/*.md`, whose frontmatter is copied into the public site's JavaScript: the
build publishes only a salted SHA-256 hash of each (`scripts/lab-flags.mjs`), and the browser hashes
a submitted flag the same way (`src/lib/lab-flags.ts`). With a flags file, the lab page's `flags`
count can go. The files for Lorem Lab 2 and Lorem Lab 1 hold placeholder flags.

**A glossary term** is `content/glossary/<id>.yml`: `term`, optional `aliases`, `definition` and
optional `seeAlso` (other terms' file names).

**Site settings** are `content/settings/theme.yml` (the theme) and `content/settings/banner.yml`
(an announcement bar: on/off, message, colours, size). They take effect with the next build.

**Special blocks** in lessons:

````md
```terminal-red title="Attacker (Kali)"
┌──(kali㉿kali)-[~]
└─$ nmap -sV 192.0.2.10
```

```quiz
title: Check your understanding
questions:
  - question: Which part of the CIA triad does ransomware mainly attack?
    options:
      - Confidentiality
      - text: Availability
        correct: true
    explanation: Shown after the learner checks their answer.
```

```exercise
title: Find the open ports
task: Scan `192.0.2.10` and list its open TCP ports.
hints:
  - Nmap only scans the 1,000 most common ports by default.
solutionCode: nmap -p- 192.0.2.10
```

```asciinema
src: /casts/<course>/<name>.cast
title: Hashing and salting
```

```timeline
layout: horizontal           # optional: vertical (the default), horizontal or snake
style: cards                 # optional: plain (the default) or cards
title: A short history of ransomware
events:
  - date: 1989
    title: AIDS Trojan
    text: Optional; `code`, **bold**, links and lists work.
  - date: May 2017
    title: WannaCry
```
````

Horizontal timelines scroll sideways when the events don't fit; snake timelines wrap into rows
that run alternately left and right instead. Both are shown vertically where there isn't room.

Callouts use `:::note`, `:::tip`, `:::caution` or `:::danger` (optionally `:::tip[Title]`).

**Files:**

- Images go in `static/images/` and downloads in `static/files/`; link them as `/images/…` and
  `/files/…`.
- Downloads are limited to 10 MB and to safe file types (no HTML, SVG or scripts that run in a
  browser).
- Videos go in `static/videos/`, stored with Git LFS; see [Videos](#videos).

### With the admin editor

The admin editor runs at `/admin/` and writes to `docs/`, `content/` and `static/` through GitLab.
It commits to `main`, so each save goes live once the pipeline has run (see
[Publishing](#publishing)). Signing in needs the GitLab application in step 5 of the
[one-time setup](#one-time-setup); the pipeline supplies `CI_PROJECT_PATH` and the GitLab address,
and other builds default to `group/codex` on `https://gitlab.example.com` (see
`scripts/prepare.mjs`). Locally, use "Work with Local Repository" in the editor.

### Videos

Lesson videos live in `static/videos/<course>/<lesson>.mp4` and are published with the site at
`/videos/…`. A lesson points to its video (and optional captions) in its frontmatter:

```yaml
video: /videos/lorem-course-1/01-lorem-lesson-1.mp4
captions: /captions/lorem-course-1/01-lorem-lesson-1.vtt
```

They're stored with **Git LFS** (`.gitattributes`): git keeps a small pointer file and GitLab keeps
the video, so clones stay small and each version of a video is stored once.

**Adding or replacing a video:**

1. Install Git LFS once per machine (`sudo apt install git-lfs`, or from git-lfs.com), then run
   `git lfs install`.
2. Put the file in `static/videos/<course>/`. MP4 (H.264 video, AAC audio) plays in every browser.
3. Commit and push as usual; `git lfs ls-files` lists the videos git is handing to LFS.

Videos can't be added through the admin editor.

**If git-lfs wasn't installed**, `git add` stores the video as an ordinary file. `npm test` (and so
the pipeline, which then doesn't publish) fails with "Not stored with Git LFS". Install git-lfs,
then run `git rm --cached <file>`, `git add <file>` and commit again. If that commit was already
pushed, the full video stays in the repository's history.

**Storage.** Pages publishes the whole site at once, so every deploy (including each admin editor
save) uploads all the videos again. GitLab then holds about three copies of the video library:

- the originals in LFS;
- the live Pages site;
- the latest pipeline artifact. The `pages` job keeps its artifacts for 1 day instead of GitLab's
  default 30, so older deploys don't pile up.

GitLab limits a Pages site to 100 MB by default. A GitLab admin can raise it under Admin → Settings
→ Preferences → Pages ("Maximum size of pages"); the job artifact limit (Admin → Settings → CI/CD)
must allow the same. After each build, `scripts/site-size.mjs` (npm `postbuild`) warns from 80% of
the limit and fails the build above it, listing the largest folders and files, so the deploy never
fails for size with GitLab's vaguer message. If the limit here is raised, set a `PAGES_MAX_MB` CI/CD
variable to match. If the videos grow to several GB, serving them from a separate server is the
better fit.

