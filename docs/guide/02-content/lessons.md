---
title: Lessons
description: Adding a lesson to a course, its settings, and how tasks and order work.
sidebar:
  order: 2
---

A lesson is a Markdown file in its course folder, or in one of the course's section folders: `docs/courses/<course>/<lesson>.md` or `docs/courses/<course>/<NN-section>/<lesson>.md`. The file name becomes its address, `/courses/<course>/<lesson>/`.

## Adding a lesson

**In the admin editor:** **Lessons → New Lesson**, choose the course (or section) folder with the folder picker, fill in the form and save. See [The admin editor](../01-editing/admin-editor.md#adding-a-lesson).

**With git:** create the file, starting with its settings:

```yaml
---
kind: lesson
title: Injection
description: How attackers smuggle commands into queries, and how to stop them.
sidebar:
  order: 2
---

Lesson text starts here.

## Find the vulnerable parameter

Each level-two heading is a task.
```

## Lesson settings

| Setting | Editor field | What it does |
|---|---|---|
| `title` | Title | The lesson name in the page, the lists and the browser tab |
| `description` | Short description | Optional one-line summary of the lesson |
| `sidebar.order` | Lesson number | Position within its course or section: lower first |
| `video`, `captions` | Video path, Video captions | See [Images, downloads and video](images-downloads-video.md) |
| `attachments` | Downloads | Files shown above the lesson and on the course overview (or put one in the text with an `attachment` block: see [Images, downloads and video](images-downloads-video.md#a-download-in-the-page-text)) |
| `glossary` | Mark glossary terms | `false` stops glossary terms being underlined on this page |
| `aliases` | Old addresses | Only after moving or renaming the lesson |
| `draft` | (git only) | `draft: true` leaves the lesson out of the live site |
| `sidebar.hidden` | (git only) | `true` keeps the page reachable by its address but out of the lists and progress |

## How lessons are shown

- **Order:** lessons at the top of the course folder come first, then each section in folder order. Within each, lessons follow their **Lesson number**.
- **Tasks:** every `##` heading is shown as a numbered task ("Task 1", "Task 2"). Use `###` for smaller headings inside a task.
- **Progress:** learners mark each lesson complete. Their progress is saved in their own browser, by the lesson's address, which is why moved lessons need [old addresses](moving-and-deleting.md).
- **Dates:** "Created" and "Last updated" come from the file's history in GitLab, so there's nothing to fill in.

## Writing the lesson

The lesson body is Markdown. For headings, lists, tables, callouts, images, code, terminals, timelines, diagrams, quizzes, exercises and recordings, see [Lesson features](../03-features/text-and-callouts.md), where each one is shown working with the Markdown that produces it.
