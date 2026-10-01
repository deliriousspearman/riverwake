---
title: The admin editor
description: Editing the site in the browser at /admin/, with no tools to install.
sidebar:
  order: 2
---

The admin editor (Sveltia CMS) edits the site's files through GitLab, using forms instead of raw files. Open `/admin/` on the site, for example `https://<site address>/admin/`.

## Signing in

Choose **Sign in with GitLab**. A GitLab window opens; sign in there if you aren't already, and approve access the first time. You need a GitLab account with **Maintainer** access to the `group/codex` project, because the editor saves straight to the published branch. Ask a GitLab admin to add you.

## What you can edit

| Section | What it holds |
|---|---|
| **Courses** | Course overviews: title, description, picture, section titles, course downloads |
| **Lessons** | Lesson pages, in their course or section folder |
| **Pathways** | Groups of courses in a suggested order |
| **Pro Labs** | Lab descriptions: machines, flags, scenario |
| **Glossary** | Security terms and their definitions |
| **Site guide** | These pages |
| **Site settings** | The theme, and the announcement banner |

Each entry is a form. Text fields marked **Lesson content**, **Overview** or **Page content** are Markdown editors: use the toolbar, or switch to raw Markdown to paste in quizzes, exercises, timelines and terminals from [Lesson features](../03-features/text-and-callouts.md).

## The preview

The preview beside the form shows the page as the site will: quizzes, exercises, timelines, recordings and terminal windows look as they do for learners, in the site's colours and fonts. If a block has a mistake that would stop the site publishing, the preview shows the same message the pipeline would, in a red box where the block goes, so fix it before you save. A few things only appear on the published page: Mermaid diagrams (the preview shows their code), syntax colours in code, glossary underlines, and what's added around the text, such as the lesson list on a course overview. Quizzes can't be answered in the preview.

## Saving publishes

**Save** writes the change straight to the `main` branch in GitLab, so it goes live a few minutes later once the pipeline has run. There's no draft stage. Saving several times in a row is fine: only the latest save is built and published, and the earlier ones are skipped. If a save doesn't appear after five minutes, the pipeline probably found a problem: see [Publishing and fixing mistakes](publishing.md).

Saving one entry at a time is fine: each save is a separate change in GitLab's history, which makes it easy to undo just one.

## Adding a lesson

1. Go to **Lessons** and choose **New Lesson**.
2. Pick the course folder (or a section folder inside it) with the folder picker. A lesson saved without a folder fails the build.
3. Fill in the title and **Lesson number** (its position in the course or section), then write the lesson.
4. Save.

See [Lessons](../02-content/lessons.md) for every setting.

## What the editor can't do

Use [git or GitLab's web editor](editing-files.md) for these:

- **Upload videos.** They're stored with Git LFS; see [Images, downloads and video](../02-content/images-downloads-video.md).
- **Delete a course**, or rename its folder. See [Moving, renaming and deleting](../02-content/moving-and-deleting.md).
- **Create a new section folder** inside a course, if the folder picker doesn't offer it.
- **Mark a page as a draft** (`draft: true`), or hide a lesson from the lists (`sidebar.hidden`).

Images, downloads and caption files can be uploaded in the editor: use the upload buttons on those fields.
