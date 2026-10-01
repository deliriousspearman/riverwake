---
title: Courses and sections
description: Creating a course, splitting it into sections, and ordering courses in the catalogue.
sidebar:
  order: 1
---

A course is a folder, `docs/courses/<course>/`. Its `index.md` is the course **overview**: the page learners land on, with the lesson list and **Start** button added automatically below your text. The folder name becomes the course's address, `/courses/<course>/`, so keep it short, lower case and hyphenated, like `lorem-course-4`.

## Creating a course

**In the admin editor:** go to **Courses → New Course**, fill in the form and save. The folder name is made from the title. Then add lessons (see [Lessons](lessons.md)).

**With git:** create `docs/courses/<course>/index.md`:

```yaml
---
kind: course
title: Lorem Ipsum Course 4
description: Find and fix the most common flaws in web applications.
order: 4
image: /images/icons/badge/courses/lorem-course-4.svg
---

A few paragraphs introducing the course: who it's for and what learners will be able to do.
```

A course with no lessons shows an empty list, so add at least one lesson before saving it to `main`, or mark it as a draft (below).

## Course settings

| Setting | Editor field | What it does |
|---|---|---|
| `title` | Title | The course name everywhere |
| `description` | Short description | Shown on the course card in the catalogue |
| `level` | Level | Optional: `Beginner`, `Intermediate` or `Advanced`. Learners can filter the course list by it |
| `order` | Position on home page | Lower numbers come first; courses without one come last, by title |
| `image` | Picture | Square picture on the card, at most 200 KB (256×256 is plenty). A PNG, JPEG or WebP picture is also used when the course is shared in chat or social media; for an SVG, the site's own preview card is used instead |
| `sections` | Section titles | Titles for the section folders (below) |
| `attachments` | Downloads | Files for the whole course (see [Images, downloads and video](images-downloads-video.md)) |
| `aliases` | Old addresses | Only after renaming the course folder (see [Moving, renaming and deleting](moving-and-deleting.md)) |
| `draft` | (git only) | `draft: true` leaves the whole course out of the live site |

## Sections

A long course can be split into sections: subfolders of the course, one level deep, numbered so they sort in order:

```text
docs/courses/lorem-course-4/
├── index.md
├── 01-introduction.md            ← lessons can also sit at the top, before the sections
├── 01-foundations/
│   ├── 01-http-basics.md
│   └── 02-sessions.md
└── 02-attacks/
    ├── 01-injection.md
    └── 02-xss.md
```

Each section's title is its folder name without the number ("Foundations", "Attacks"), unless the overview gives it another:

```yaml
sections:
  02-attacks: Common attacks and their defences
```

Sections can't contain further folders: the build fails if they do. To create a section folder, add its first lesson with git or GitLab's web editor (see [Editing files with git](../01-editing/editing-files.md)); after that, the admin editor's folder picker offers it.

## Drafts

`draft: true` on the overview leaves the course and all its lessons out of the live site, while `npm run dev` still shows them. Use it to build a course over several changes before learners see it. Remove the line (or set it to `false`) to publish.
